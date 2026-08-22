import { prisma } from '../db.ts';
import { HttpError } from '../errors.ts';
import { generateRefreshToken, hashToken, signAccessToken } from './tokens.ts';

const GENERIC_AUTH_ERROR = 'Invalid email or password';
const GENERIC_REFRESH_ERROR = 'Invalid or expired refresh token';

export async function login(input: {
  email: string;
  password: string;
}): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date }> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) {
    throw new HttpError(401, GENERIC_AUTH_ERROR);
  }

  const { raw, hash, expiresAt } = generateRefreshToken();

  await prisma.refreshToken.create({
    data: {
      tokenHash: hash,
      userId: user.id,
      expiresAt,
    },
  });

  const accessToken = signAccessToken(user.id, user.role);
  return { accessToken, refreshToken: raw, expiresAt };
}

export async function rotateRefresh(rawToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}> {
  const hash = hashToken(rawToken);

  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hash },
    include: { user: true },
  });

  if (stored && stored.revokedAt !== null) {
    await revokeFamily(stored.id).catch(() => {
      /* best-effort */
    });
    throw new HttpError(401, GENERIC_REFRESH_ERROR);
  }

  if (!stored || stored.expiresAt.getTime() < Date.now()) {
    throw new HttpError(401, GENERIC_REFRESH_ERROR);
  }

  const { raw, hash: newHash, expiresAt } = generateRefreshToken();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await prisma.$transaction(async (tx: any) => {
    const created = await tx.refreshToken.create({
      data: { tokenHash: newHash, userId: stored.userId, expiresAt },
    });
    await tx.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date(), replacedById: created.id },
    });
    return created;
  });

  const accessToken = signAccessToken(stored.userId, stored.user.role);
  return { accessToken, refreshToken: raw, expiresAt };
}

async function revokeFamily(presentedId: string): Promise<void> {
  const idsToRevoke: string[] = [];
  let currentId: string | null = presentedId;

  while (currentId) {
    const node: { replacedById: string | null } | null =
      await prisma.refreshToken.findUnique({
        where: { id: currentId },
        select: { replacedById: true },
      });
    if (!node || !node.replacedById) break;
    idsToRevoke.push(node.replacedById);
    currentId = node.replacedById;
  }

  if (idsToRevoke.length === 0) return;

  await prisma.refreshToken.updateMany({
    where: { id: { in: idsToRevoke }, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

-- Session 4 starter - migration for the RefreshToken model.
--
-- This is the SQL `npx prisma migrate dev --name add-refresh-token` generates
-- once prisma/refresh-token.model.prisma is pasted into schema.prisma (it
-- lands in prisma/migrations/<timestamp>_add-refresh-token/migration.sql).
-- Read it top to bottom: it is exactly the DDL vocabulary from Session 3 -
-- one table, three indexes, two foreign keys. Note there is no DEFAULT on
-- "id": uuid(7) defaults are generated client-side by Prisma, not by Postgres.

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "replacedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: @unique on tokenHash - the refresh lookup path
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex: @unique on replacedById - a token can be replaced by at most one successor
CREATE UNIQUE INDEX "RefreshToken_replacedById_key" ON "RefreshToken"("replacedById");

-- CreateIndex: @@index([userId]) - logout-everywhere / family revocation queries
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- AddForeignKey: required relation -> RESTRICT delete (Prisma default)
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: optional self-relation -> SET NULL delete (Prisma default)
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_replacedById_fkey"
    FOREIGN KEY ("replacedById") REFERENCES "RefreshToken"("id") ON DELETE SET NULL ON UPDATE CASCADE;

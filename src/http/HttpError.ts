export class HttpError extends Error {
  public statusCode: number;
  public details: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.details = details ?? null;
  }
}

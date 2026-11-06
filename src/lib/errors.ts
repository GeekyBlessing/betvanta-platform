export class AppError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) { super(message); }
}
export const badRequest = (msg: string, details?: unknown) => new AppError(400, "bad_request", msg, details);
export const unauthorized = (msg = "Log in to continue.") => new AppError(401, "unauthorized", msg);
export const forbidden = (msg = "You do not have access to this.") => new AppError(403, "forbidden", msg);
export const notFound = (msg = "Not found.") => new AppError(404, "not_found", msg);
export const conflict = (msg: string) => new AppError(409, "conflict", msg);
export const tooMany = (msg = "Too many attempts. Try again in a few minutes.") => new AppError(429, "rate_limited", msg);
export const unavailable = (msg: string) => new AppError(503, "unavailable", msg);

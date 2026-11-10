export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(message: string, status = 400, code = "BAD_REQUEST", details?: unknown) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function assertFound<T>(value: T | null | undefined, message = "Ресурс не найден."): T {
  if (value === null || value === undefined) {
    throw new AppError(message, 404, "NOT_FOUND");
  }
  return value;
}

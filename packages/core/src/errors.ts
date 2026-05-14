export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const VALIDATION_ERROR = 'VALIDATION_ERROR';
export const NOT_FOUND = 'NOT_FOUND';
export const UNAUTHORIZED = 'UNAUTHORIZED';
export const RATE_LIMITED = 'RATE_LIMITED';
export const INTERNAL_ERROR = 'INTERNAL_ERROR';
export const SECURITY_ERROR = 'SECURITY_ERROR';

export function badRequest(message: string, details?: unknown) {
  return new AppError(message, VALIDATION_ERROR, 400, details);
}

export function notFound(message: string) {
  return new AppError(message, NOT_FOUND, 404);
}

export function unauthorized(message: string) {
  return new AppError(message, UNAUTHORIZED, 401);
}

export function rateLimited(message: string) {
  return new AppError(message, RATE_LIMITED, 429);
}

export function internalError(message: string, details?: unknown) {
  return new AppError(message, INTERNAL_ERROR, 500, details);
}

export function securityError(message: string) {
  return new AppError(message, SECURITY_ERROR, 403);
}

export function formatErrorResponse(error: unknown): { error: string; code: string; details?: unknown } {
  if (error instanceof AppError) {
    return { error: error.message, code: error.code, details: error.details };
  }
  return { error: 'Internal server error', code: 'INTERNAL_ERROR' };
}
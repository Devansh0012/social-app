/**
 * Domain error hierarchy. Mercurius converts thrown errors into GraphQL errors
 * via the `errorFormatter` in graphql/index.ts — codes here become the
 * `extensions.code` on the response, which the frontend can switch on.
 */
export type ErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL'
  | 'VALIDATION'
  | 'COLLEGE_EMAIL_REQUIRED'
  | 'EMAIL_NOT_VERIFIED'
  | 'ACCOUNT_BANNED';

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(code: ErrorCode, message: string, statusCode = 400, details?: unknown) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.name = 'AppError';
  }
}

export const BadRequest = (message: string, details?: unknown) =>
  new AppError('BAD_REQUEST', message, 400, details);
export const Unauthenticated = (message = 'Authentication required') =>
  new AppError('UNAUTHENTICATED', message, 401);
export const Forbidden = (message = 'Forbidden') => new AppError('FORBIDDEN', message, 403);
export const NotFound = (message: string) => new AppError('NOT_FOUND', message, 404);
export const Conflict = (message: string) => new AppError('CONFLICT', message, 409);
export const Validation = (message: string, details?: unknown) =>
  new AppError('VALIDATION', message, 422, details);
export const CollegeEmailRequired = () =>
  new AppError(
    'COLLEGE_EMAIL_REQUIRED',
    'A valid college / university email is required to sign up.',
    422,
  );
export const EmailNotVerified = () =>
  new AppError('EMAIL_NOT_VERIFIED', 'Please verify your college email.', 403);
export const AccountBanned = () =>
  new AppError('ACCOUNT_BANNED', 'This account has been suspended.', 403);

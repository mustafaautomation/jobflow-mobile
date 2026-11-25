export type JobflowErrorCode = 'forbidden' | 'not_found' | 'invalid' | 'conflict' | 'network' | 'auth';

export class JobflowError extends Error {
  readonly name = 'JobflowError';

  constructor(
    readonly code: JobflowErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof JobflowError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return 'Something went wrong. Try again.';
}

export function isNetworkError(error: unknown): boolean {
  return error instanceof JobflowError && error.code === 'network';
}

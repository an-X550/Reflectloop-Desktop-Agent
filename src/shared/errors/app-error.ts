export type AppError =
  | { code: 'INVALID_INPUT'; message: string }
  | { code: 'NOT_FOUND'; entity: string }
  | { code: 'INVALID_API_KEY' }
  | { code: 'MODEL_NOT_FOUND'; model: string }
  | { code: 'RATE_LIMITED'; retryAfter?: number }
  | { code: 'NETWORK_TIMEOUT' }
  | { code: 'INVALID_MODEL_OUTPUT'; message?: string }
  | { code: 'FILE_CONFLICT'; path: string }
  | { code: 'DATA_CORRUPTED'; path: string }
  | { code: 'IMPORT_REJECTED'; reason: string }
  | { code: 'TASK_ALREADY_RUNNING' }
  | { code: 'WEB_SEARCH_FAILED'; message: string }
  | { code: 'WEB_SOURCE_FAILED'; message: string }
  | { code: 'UNKNOWN'; message: string };

export function appError(error: AppError): AppError & Error {
  return Object.assign(new Error('message' in error && error.message ? error.message : error.code), error);
}

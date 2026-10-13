/** Error codes shared by `/api/recognize` and its client, with the HTTP status each maps to. */
export const RECOGNIZE_ERRORS = {
  'not-a-photo': 400,
  'forbidden-origin': 403,
  'too-large': 413,
  'unsupported-type': 415,
  'rate-limited': 429,
  'invalid-model-output': 502,
  upstream: 502,
  unavailable: 503,
  timeout: 504,
} as const;

export type RecognizeErrorCode = keyof typeof RECOGNIZE_ERRORS;

export class RecognizeError extends Error {
  constructor(readonly code: RecognizeErrorCode) {
    super(code);
    this.name = 'RecognizeError';
  }
}

// src/adapters/errors.ts

/** Normalized error structure for consistent handling */
export type NormalizedError = {
  type: string;
  message: string;
  stack?: string;
};

/**
 * Converts any thrown error into a normalized structure
 */
export function normalizeError(err: any, type: string = "Error"): NormalizedError {
  return {
    type,
    message: err?.message || String(err),
    stack: err?.stack
  };
}

// src/adapters/errors.ts

/**
 * Custom error class for Kodelens adapter-related issues.
 * Helps distinguish between our controlled errors and unexpected failures.
 */
export class AdapterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdapterError";
  }
}

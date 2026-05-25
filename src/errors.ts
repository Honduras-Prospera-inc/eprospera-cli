export const ExitCodes = {
  Success: 0,
  Generic: 1,
  Usage: 2,
  Authentication: 3,
  Authorization: 4,
  NotFound: 5,
  Conflict: 6,
  RateLimit: 7,
  Validation: 8,
  Timeout: 9,
  TerminalFailure: 10,
} as const;

export type ExitCode = (typeof ExitCodes)[keyof typeof ExitCodes];

export type ErrorDetails = unknown;

export type ErrorEnvelope = {
  error: {
    code: string;
    message: string;
    httpStatus?: number;
    details?: ErrorDetails;
  };
};

export type ExitErrorOptions = {
  code: string;
  message: string;
  exitCode: ExitCode;
  httpStatus?: number;
  details?: ErrorDetails;
  cause?: unknown;
};

export class ExitError extends Error {
  readonly code: string;
  readonly exitCode: ExitCode;
  readonly httpStatus?: number;
  readonly details?: ErrorDetails;

  constructor(options: ExitErrorOptions) {
    super(options.message, { cause: options.cause });
    this.name = "ExitError";
    this.code = options.code;
    this.exitCode = options.exitCode;
    this.httpStatus = options.httpStatus;
    this.details = options.details;
  }

  toEnvelope(): ErrorEnvelope {
    return {
      error: {
        code: this.code,
        message: this.message,
        httpStatus: this.httpStatus,
        details: this.details,
      },
    };
  }
}

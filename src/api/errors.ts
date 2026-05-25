import { type ExitCode, ExitCodes, ExitError } from "../errors.js";

export type UpstreamErrorBody = {
  error?: unknown;
  error_description?: string;
  errorDescription?: string;
  message?: string;
  details?: unknown;
};

export function mapHttpStatusToExitCode(status: number): ExitCode {
  if (status === 400 || status === 422) {
    return ExitCodes.Validation;
  }
  if (status === 401) {
    return ExitCodes.Authentication;
  }
  if (status === 403) {
    return ExitCodes.Authorization;
  }
  if (status === 404) {
    return ExitCodes.NotFound;
  }
  if (status === 409) {
    return ExitCodes.Conflict;
  }
  if (status === 408 || status === 504) {
    return ExitCodes.Timeout;
  }
  if (status === 429) {
    return ExitCodes.RateLimit;
  }
  return ExitCodes.Generic;
}

export function apiErrorFromResponse(response: Response, body: unknown): ExitError {
  const upstream = normalizeUpstreamError(body);
  return new ExitError({
    code: upstream.code ?? defaultCodeForStatus(response.status),
    message: upstream.message ?? defaultMessageForStatus(response.status),
    exitCode: mapHttpStatusToExitCode(response.status),
    httpStatus: response.status,
    details: upstream.details ?? null,
  });
}

export function networkErrorFromCause(error: unknown): ExitError {
  const message = error instanceof Error ? error.message : "Network request failed";
  const isTimeout =
    error instanceof DOMException
      ? error.name === "AbortError" || error.name === "TimeoutError"
      : error instanceof Error && error.name === "AbortError";

  return new ExitError({
    code: isTimeout ? "TIMEOUT" : "NETWORK_ERROR",
    message,
    exitCode: isTimeout ? ExitCodes.Timeout : ExitCodes.Generic,
    cause: error,
  });
}

function normalizeUpstreamError(body: unknown): {
  code?: string;
  message?: string;
  details?: unknown;
} {
  if (!isRecord(body)) {
    return {};
  }

  const { error } = body;
  if (isRecord(error)) {
    return {
      code: stringValue(error.code) ?? stringValue(error.error),
      message:
        stringValue(error.message) ??
        stringValue(error.error_description) ??
        stringValue(error.errorDescription),
      details: "details" in error ? error.details : body.details,
    };
  }

  return {
    code: stringValue(error),
    message:
      stringValue(body.error_description) ??
      stringValue(body.errorDescription) ??
      stringValue(body.message) ??
      stringValue(error),
    details: body.details,
  };
}

function defaultCodeForStatus(status: number): string {
  if (status === 400 || status === 422) {
    return "VALIDATION_ERROR";
  }
  if (status === 401) {
    return "UNAUTHENTICATED";
  }
  if (status === 403) {
    return "FORBIDDEN";
  }
  if (status === 404) {
    return "NOT_FOUND";
  }
  if (status === 409) {
    return "CONFLICT";
  }
  if (status === 429) {
    return "RATE_LIMITED";
  }
  if (status === 408 || status === 504) {
    return "TIMEOUT";
  }
  return "API_ERROR";
}

function defaultMessageForStatus(status: number): string {
  if (status === 400 || status === 422) {
    return "The API rejected the request as invalid.";
  }
  if (status === 401) {
    return "Authentication failed.";
  }
  if (status === 403) {
    return "The credential is not authorized for this operation.";
  }
  if (status === 404) {
    return "The requested resource was not found.";
  }
  if (status === 409) {
    return "The request conflicts with the current resource state.";
  }
  if (status === 429) {
    return "The API rate limit was exceeded.";
  }
  if (status === 408 || status === 504) {
    return "The request timed out.";
  }
  return `The API returned HTTP ${status}.`;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

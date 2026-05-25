import { ExitCodes, ExitError } from "../errors.js";

export type WatchApplicationState = {
  id?: string;
  statusId?: string;
  [key: string]: unknown;
};

export type WatchApplicationOptions = {
  timeoutMs?: number;
  initialIntervalMs?: number;
  maxIntervalMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  onTransition?: (application: WatchApplicationState) => void | Promise<void>;
};

export type WatchApplicationResult = {
  application: WatchApplicationState;
  terminal: "approved";
};

const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000;
const DEFAULT_INITIAL_INTERVAL_MS = 30 * 1000;
const DEFAULT_MAX_INTERVAL_MS = 5 * 60 * 1000;
const BACKOFF_AFTER_MS = 10 * 60 * 1000;
const SUCCESS_STATUSES = new Set(["Approved"]);
const FAILURE_STATUSES = new Set(["Rejected", "PaymentFailed", "Payment Failed"]);

export async function watchApplication(
  fetchApplication: () => Promise<WatchApplicationState>,
  options: WatchApplicationOptions = {},
): Promise<WatchApplicationResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const initialIntervalMs = options.initialIntervalMs ?? DEFAULT_INITIAL_INTERVAL_MS;
  const maxIntervalMs = options.maxIntervalMs ?? DEFAULT_MAX_INTERVAL_MS;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? defaultSleep;
  const startedAt = now();
  let lastStatus: string | undefined;
  let lastApplication: WatchApplicationState | undefined;

  for (;;) {
    const application = await fetchApplication();
    lastApplication = application;
    const status = application.statusId;

    if (status !== lastStatus) {
      await options.onTransition?.(application);
      lastStatus = status;
    }

    if (status && SUCCESS_STATUSES.has(status)) {
      return { application, terminal: "approved" };
    }

    if (status && FAILURE_STATUSES.has(status)) {
      throw new ExitError({
        code: "TERMINAL_FAILURE_STATE",
        message: `Application entered terminal failure state ${status}.`,
        exitCode: ExitCodes.TerminalFailure,
        details: application,
      });
    }

    const elapsedMs = now() - startedAt;
    if (elapsedMs >= timeoutMs) {
      throw new ExitError({
        code: "WATCH_TIMEOUT",
        message: `Application did not reach a terminal success state within ${formatDuration(timeoutMs)}.`,
        exitCode: ExitCodes.Timeout,
        details: lastApplication ?? null,
      });
    }

    const intervalMs = elapsedMs < BACKOFF_AFTER_MS ? initialIntervalMs : maxIntervalMs;
    await sleep(Math.min(intervalMs, timeoutMs - elapsedMs));
  }
}

export function parseDurationMs(value: string | undefined, fallbackMs: number): number {
  if (!value) {
    return fallbackMs;
  }

  const match = /^(\d+)(ms|s|m|h)$/.exec(value.trim());
  if (!match) {
    throw new ExitError({
      code: "INVALID_DURATION",
      message: `Invalid duration ${value}. Use values such as 30s, 30m, or 1h.`,
      exitCode: ExitCodes.Usage,
    });
  }

  const amount = Number(match[1]);
  const unit = match[2];
  if (unit === "ms") {
    return amount;
  }
  if (unit === "s") {
    return amount * 1000;
  }
  if (unit === "m") {
    return amount * 60 * 1000;
  }
  return amount * 60 * 60 * 1000;
}

function formatDuration(ms: number): string {
  if (ms % (60 * 1000) === 0) {
    return `${ms / (60 * 1000)}m`;
  }
  if (ms % 1000 === 0) {
    return `${ms / 1000}s`;
  }
  return `${ms}ms`;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

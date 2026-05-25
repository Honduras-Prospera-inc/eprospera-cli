import { randomUUID } from "node:crypto";
import createClient, { type Client, type Middleware } from "openapi-fetch";
import { apiErrorFromResponse, networkErrorFromCause } from "./errors.js";
import type { paths } from "./generated.js";

export const PRODUCTION_BASE_URL = "https://portal.eprospera.com";
export const STAGING_BASE_URL = "https://staging-portal.eprospera.com";
export const DEFAULT_MAX_RETRIES = 3;

export type TokenProvider = string | (() => string | Promise<string | undefined>) | undefined;

export type RetryOptions = {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  random?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

export type ApiClientOptions = {
  baseUrl?: string;
  env?: NodeJS.ProcessEnv;
  token?: TokenProvider;
  fetch?: (input: Request) => Promise<Response>;
  idempotencyKey?: () => string;
  retry?: RetryOptions;
};

export type EProsperaApiClient = {
  baseUrl: string;
  raw: Client<paths>;
};

export function resolveBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const explicitBaseUrl = env.EPROSPERA_BASE_URL?.trim();
  if (explicitBaseUrl) {
    return trimTrailingSlash(explicitBaseUrl);
  }

  if (env.EPROSPERA_ENV === "staging") {
    return STAGING_BASE_URL;
  }

  return PRODUCTION_BASE_URL;
}

export function createApiClient(options: ApiClientOptions = {}): EProsperaApiClient {
  const baseUrl = trimTrailingSlash(options.baseUrl ?? resolveBaseUrl(options.env));
  const fetchWithRetry = createRetryingFetch(options.fetch ?? globalThis.fetch, options.retry);
  const raw = createClient<paths>({
    baseUrl,
    fetch: fetchWithRetry,
  });

  raw.use(
    createAuthAndIdempotencyMiddleware({
      token: options.token,
      idempotencyKey: options.idempotencyKey ?? randomUUID,
    }),
    createErrorMiddleware(),
  );

  return { baseUrl, raw };
}

export function parseRetryAfter(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }

  const date = Date.parse(value);
  if (!Number.isNaN(date)) {
    return Math.max(0, date - Date.now());
  }

  return undefined;
}

export function computeRetryDelayMs(
  attempt: number,
  response: Response,
  options: Required<Pick<RetryOptions, "baseDelayMs" | "maxDelayMs" | "random">>,
): number {
  const retryAfterMs = parseRetryAfter(response.headers.get("Retry-After"));
  if (retryAfterMs !== undefined) {
    return retryAfterMs;
  }

  const cap = Math.min(options.maxDelayMs, options.baseDelayMs * 2 ** attempt);
  return Math.floor(options.random() * cap);
}

function createAuthAndIdempotencyMiddleware(options: {
  token: TokenProvider;
  idempotencyKey: () => string;
}): Middleware {
  return {
    async onRequest({ request }) {
      const headers = new Headers(request.headers);
      const token = await resolveToken(options.token);

      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }

      if (requiresIdempotencyKey(request) && !headers.has("Idempotency-Key")) {
        headers.set("Idempotency-Key", options.idempotencyKey());
      }

      return new Request(request, { headers });
    },
  };
}

function createErrorMiddleware(): Middleware {
  return {
    async onResponse({ response }) {
      if (response.ok) {
        return undefined;
      }

      throw apiErrorFromResponse(response, await readResponseBody(response.clone()));
    },
    onError({ error }) {
      return networkErrorFromCause(error);
    },
  };
}

function createRetryingFetch(
  fetchImpl: (input: Request) => Promise<Response>,
  retry: RetryOptions = {},
): (input: Request) => Promise<Response> {
  const retryOptions = {
    maxRetries: retry.maxRetries ?? DEFAULT_MAX_RETRIES,
    baseDelayMs: retry.baseDelayMs ?? 250,
    maxDelayMs: retry.maxDelayMs ?? 4_000,
    random: retry.random ?? Math.random,
    sleep: retry.sleep ?? sleep,
  };

  return async (request) => {
    for (let attempt = 0; ; attempt += 1) {
      const response = await fetchImpl(request.clone());

      if (!shouldRetry(response) || attempt >= retryOptions.maxRetries) {
        return response;
      }

      await retryOptions.sleep(computeRetryDelayMs(attempt, response, retryOptions));
    }
  };
}

async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function resolveToken(provider: TokenProvider): Promise<string | undefined> {
  if (typeof provider === "function") {
    return provider();
  }

  return provider;
}

function shouldRetry(response: Response): boolean {
  return response.status === 429 || response.status >= 500;
}

function requiresIdempotencyKey(request: Request): boolean {
  if (request.method !== "POST") {
    return false;
  }

  return new URL(request.url).pathname.startsWith("/api/v1/legal_entity_applications");
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

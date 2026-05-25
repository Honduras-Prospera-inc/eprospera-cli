import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  computeRetryDelayMs,
  createApiClient,
  PRODUCTION_BASE_URL,
  parseRetryAfter,
  resolveBaseUrl,
  STAGING_BASE_URL,
} from "../../src/api/client.js";
import { mapHttpStatusToExitCode } from "../../src/api/errors.js";
import { ExitCodes, ExitError } from "../../src/errors.js";

const server = setupServer();
const baseUrl = "https://api.test";
const id = "00000000-0000-4000-8000-000000000000";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("resolveBaseUrl", () => {
  it("prefers EPROSPERA_BASE_URL", () => {
    expect(resolveBaseUrl({ EPROSPERA_BASE_URL: "https://custom.test/" })).toBe(
      "https://custom.test",
    );
  });

  it("uses staging when EPROSPERA_ENV is staging", () => {
    expect(resolveBaseUrl({ EPROSPERA_ENV: "staging" })).toBe(STAGING_BASE_URL);
  });

  it("defaults to production", () => {
    expect(resolveBaseUrl({})).toBe(PRODUCTION_BASE_URL);
  });
});

describe("api error mapping", () => {
  it.each([
    [400, ExitCodes.Validation],
    [401, ExitCodes.Authentication],
    [403, ExitCodes.Authorization],
    [404, ExitCodes.NotFound],
    [422, ExitCodes.Validation],
    [409, ExitCodes.Conflict],
    [429, ExitCodes.RateLimit],
    [500, ExitCodes.Generic],
  ])("maps HTTP %i to exit code %i", (status, exitCode) => {
    expect(mapHttpStatusToExitCode(status)).toBe(exitCode);
  });

  it.each([
    [400, ExitCodes.Validation],
    [401, ExitCodes.Authentication],
    [403, ExitCodes.Authorization],
    [404, ExitCodes.NotFound],
    [422, ExitCodes.Validation],
    [409, ExitCodes.Conflict],
    [429, ExitCodes.RateLimit],
    [500, ExitCodes.Generic],
  ])("throws an ExitError for HTTP %i responses", async (status, exitCode) => {
    server.use(
      http.post(`${baseUrl}/api/v1/registries/legal_entities/search`, () =>
        HttpResponse.json(
          {
            error: `code-${status}`,
            error_description: `message ${status}`,
            details: [{ path: ["query"], message: "bad query" }],
          },
          { status },
        ),
      ),
    );

    const api = createApiClient({
      baseUrl,
      token: "ak-test",
      retry: { maxRetries: 0 },
    });

    await expect(
      api.raw.POST("/api/v1/registries/legal_entities/search", {
        body: { query: "Acme" },
      }),
    ).rejects.toMatchObject({
      code: `code-${status}`,
      exitCode,
      httpStatus: status,
      message: `message ${status}`,
    });
  });
});

describe("api request behavior", () => {
  it("injects bearer auth and idempotency key on application writes", async () => {
    const capturedHeaders: Record<string, string | null> = {};

    server.use(
      http.post(`${baseUrl}/api/v1/legal_entity_applications/:id/pay/coupon`, ({ request }) => {
        capturedHeaders.authorization = request.headers.get("authorization");
        capturedHeaders.idempotencyKey = request.headers.get("idempotency-key");
        return HttpResponse.json({ success: true, data: { id, statusId: "Draft" } });
      }),
    );

    const api = createApiClient({
      baseUrl,
      token: "ak-test",
      idempotencyKey: () => "idem-test",
      retry: { maxRetries: 0 },
    });

    await api.raw.POST("/api/v1/legal_entity_applications/{id}/pay/coupon", {
      params: { path: { id } },
      body: { couponCode: "FOUNDER100" },
    });

    expect(capturedHeaders).toEqual({
      authorization: "Bearer ak-test",
      idempotencyKey: "idem-test",
    });
  });

  it("does not inject idempotency keys on read-only POST endpoints", async () => {
    let idempotencyKey: string | null = null;

    server.use(
      http.post(`${baseUrl}/api/v1/verify_rpn`, ({ request }) => {
        idempotencyKey = request.headers.get("idempotency-key");
        return HttpResponse.json({ result: "not_found", active: false });
      }),
    );

    const api = createApiClient({
      baseUrl,
      token: "ak-test",
      idempotencyKey: () => "idem-test",
      retry: { maxRetries: 0 },
    });

    await api.raw.POST("/api/v1/verify_rpn", {
      body: { rpn: "80000000000012" },
    });

    expect(idempotencyKey).toBeNull();
  });

  it("retries 5xx responses with full-jitter backoff", async () => {
    let calls = 0;
    const delays: number[] = [];

    server.use(
      http.get(`${baseUrl}/api/v1/legal_entity_applications/:id`, () => {
        calls += 1;
        if (calls === 1) {
          return HttpResponse.json({ error: "server_error" }, { status: 500 });
        }

        return HttpResponse.json({ data: { id, statusId: "Draft" } });
      }),
    );

    const api = createApiClient({
      baseUrl,
      token: "ak-test",
      retry: {
        maxRetries: 3,
        baseDelayMs: 1_000,
        maxDelayMs: 10_000,
        random: () => 0.5,
        sleep: async (ms) => {
          delays.push(ms);
        },
      },
    });

    const result = await api.raw.GET("/api/v1/legal_entity_applications/{id}", {
      params: { path: { id } },
    });

    expect(result.data?.data?.id).toBe(id);
    expect(calls).toBe(2);
    expect(delays).toEqual([500]);
  });

  it("maps aborted requests to timeout exit errors", async () => {
    const api = createApiClient({
      baseUrl,
      fetch: async () => {
        throw new DOMException("The operation was aborted.", "AbortError");
      },
      retry: { maxRetries: 0 },
    });

    await expect(
      api.raw.GET("/api/v1/legal_entity_applications/{id}", {
        params: { path: { id } },
      }),
    ).rejects.toMatchObject({
      code: "TIMEOUT",
      exitCode: ExitCodes.Timeout,
    });
  });
});

describe("retry timing helpers", () => {
  it("parses numeric Retry-After values as seconds", () => {
    expect(parseRetryAfter("2")).toBe(2_000);
  });

  it("uses Retry-After before jitter", () => {
    const response = new Response(null, {
      status: 429,
      headers: { "Retry-After": "3" },
    });

    expect(
      computeRetryDelayMs(0, response, {
        baseDelayMs: 1_000,
        maxDelayMs: 10_000,
        random: () => 0.5,
      }),
    ).toBe(3_000);
  });

  it("keeps API errors serializable for JSON output", () => {
    const error = new ExitError({
      code: "FORBIDDEN_SCOPE",
      message: "Agent Key lacks agent:entity.read",
      exitCode: ExitCodes.Authorization,
      httpStatus: 403,
      details: null,
    });

    expect(error.toEnvelope()).toEqual({
      error: {
        code: "FORBIDDEN_SCOPE",
        message: "Agent Key lacks agent:entity.read",
        httpStatus: 403,
        details: null,
      },
    });
  });
});

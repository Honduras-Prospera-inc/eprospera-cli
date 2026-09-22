import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RuntimeDependencies } from "../../src/commands/runtime.js";
import { DEFAULT_OAUTH_SCOPES } from "../../src/credentials/oauth.js";
import { runCli } from "../../src/index.js";

const entityId = "11111111-1111-4111-8111-111111111111";
const filingId = "22222222-2222-4222-8222-222222222222";
const requestId = "33333333-3333-4333-8333-333333333333";
const baseUrl = "https://api.test";
const entityPath = `/api/v1/legal_entities/${entityId}`;
const nextSteps = {
  changesRequired: false,
  signatureUrl: "https://portal.eprospera.com/sign/example",
  paymentRequired: true,
  reviewDispatchPending: false,
  submitReady: false,
};
const filing = {
  id: filingId,
  legalEntityId: entityId,
  statusId: "Draft",
  proposedChanges: { updatedName: "New Name" },
  signed: false,
  invoice: null,
  nextSteps,
};
const personalDocuments = {
  data: [{ id: filingId, name: "Agreement", slug: "aoc_example", fileUrl: null }],
  agreementOfCoexistence: {
    aocId: requestId,
    version: "1.0",
    templatePdfUrl: "https://documents.example.test/template.pdf",
    signedDocumentId: filingId,
    signedDocumentUrl: null,
  },
};

type CommandCase = {
  name: string;
  args: string[];
  method: string;
  path: string;
  body?: unknown;
  scope: string;
  response: unknown;
};
const cases: CommandCase[] = [
  {
    name: "amendment list",
    args: ["entity", "amendment", "list", entityId],
    method: "GET",
    path: `${entityPath}/amendments`,
    scope: "agent:entity.filing.read",
    response: { data: [filing] },
  },
  {
    name: "amendment create",
    args: ["entity", "amendment", "create", entityId, "--file", "payload.json"],
    method: "POST",
    path: `${entityPath}/amendments`,
    body: { updatedName: "New Name" },
    scope: "agent:entity.filing.create",
    response: { data: filing, nextSteps },
  },
  {
    name: "amendment get",
    args: ["entity", "amendment", "get", entityId, filingId],
    method: "GET",
    path: `${entityPath}/amendments/${filingId}`,
    scope: "agent:entity.filing.read",
    response: { data: filing },
  },
  {
    name: "amendment update",
    args: ["entity", "amendment", "update", entityId, filingId, "--file", "payload.json"],
    method: "PATCH",
    path: `${entityPath}/amendments/${filingId}`,
    body: { updatedName: "New Name" },
    scope: "agent:entity.filing.create",
    response: { data: filing, nextSteps },
  },
  {
    name: "amendment pay",
    args: ["entity", "amendment", "pay", entityId, filingId, "--voucher", "TEST"],
    method: "POST",
    path: `${entityPath}/amendments/${filingId}/pay/voucher`,
    body: { voucherCode: "TEST" },
    scope: "agent:entity.filing.pay",
    response: {
      success: true,
      data: { ...filing, statusId: "Pending Review", invoice: { id: requestId, statusId: "paid" } },
    },
  },
  {
    name: "amendment submit",
    args: ["entity", "amendment", "submit", entityId, filingId],
    method: "POST",
    path: `${entityPath}/amendments/${filingId}/submit`,
    scope: "agent:entity.filing.pay",
    response: { success: true, data: { ...filing, statusId: "Pending Review" } },
  },
  {
    name: "certificate list",
    args: ["entity", "certificate", "list", entityId],
    method: "GET",
    path: `${entityPath}/certificate_requests`,
    scope: "agent:entity.filing.read",
    response: { data: [], eligibility: { eligible: true, taxCompliant: false, reason: null } },
  },
  {
    name: "certificate create",
    args: ["entity", "certificate", "create", entityId],
    method: "POST",
    path: `${entityPath}/certificate_requests`,
    body: {},
    scope: "agent:entity.filing.create",
    response: {
      data: { id: requestId, statusId: "Pending Payment" },
      nextSteps: { paymentRequired: true },
    },
  },
  {
    name: "certificate get",
    args: ["entity", "certificate", "get", entityId, requestId],
    method: "GET",
    path: `${entityPath}/certificate_requests/${requestId}`,
    scope: "agent:entity.filing.read",
    response: {
      data: {
        id: requestId,
        statusId: "Issued",
        documentUrl: "https://documents.example.test/certificate.pdf",
      },
    },
  },
  {
    name: "certificate pay",
    args: ["entity", "certificate", "pay", entityId, requestId, "--voucher", "TEST"],
    method: "POST",
    path: `${entityPath}/certificate_requests/${requestId}/pay/voucher`,
    body: { voucherCode: "TEST" },
    scope: "agent:entity.filing.pay",
    response: {
      success: true,
      message: "Payment applied",
      data: {
        id: requestId,
        statusId: "Pending Payment",
        invoice: { id: filingId, statusId: "paid" },
        documentUrl: null,
      },
    },
  },
  {
    name: "personal documents",
    args: ["me", "documents"],
    method: "GET",
    path: "/api/v1/me/natural-person/documents",
    scope: "agent:person.documents.read",
    response: personalDocuments,
  },
];
const writes = cases.filter((entry) => entry.method !== "GET");
const reads = cases.filter((entry) => entry.method === "GET");
let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "eprospera-filings-"));
  await writeFile(join(dir, "payload.json"), JSON.stringify({ updatedName: "New Name" }));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("published filing and document commands", () => {
  it.each(cases)("sends $name and preserves its complete response", async (entry) => {
    const token = entry.name === "personal documents" ? "ak-test" : "sk-test";
    const fetch = vi.fn(async (request: Request) => {
      expect(request.url).toBe(`${baseUrl}${entry.path}`);
      expect(request.method).toBe(entry.method);
      expect(request.headers.get("authorization")).toBe(`Bearer ${token}`);
      expect(request.headers.has("idempotency-key")).toBe(false);
      const text = await request.text();
      expect(text ? JSON.parse(text) : undefined).toEqual(entry.body);
      return Response.json(entry.response);
    });
    const result = await run(["--json", "--yes", ...entry.args], {
      fetch,
      env: { EPROSPERA_API_KEY: token },
    });
    expect(result.exitCode).toBe(0);
    expect(result.json()).toEqual(entry.response);
    expect(result.stderr).toBe("");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each(cases)("allows the correct cached Agent Key scope for $name", async (entry) => {
    const result = await run(["--json", "--yes", ...entry.args], {
      env: { EPROSPERA_API_KEY: "" },
      loadStoredCredential: async () => ({ kind: "ak", token: "ak-test", scopes: [entry.scope] }),
      fetch: async () => Response.json(entry.response),
    });
    expect(result.exitCode).toBe(0);
  });

  it.each(cases)("rejects missing cached scopes for $name before sending", async (entry) => {
    const fetch = vi.fn();
    const result = await run(["--json", "--yes", ...entry.args], {
      env: { EPROSPERA_API_KEY: "" },
      loadStoredCredential: async () => ({ kind: "ak", token: "ak-test", scopes: [] }),
      fetch,
    });
    expect(result.exitCode).toBe(4);
    expect(result.json().error.details.missing).toBe(entry.scope);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(
    cases,
  )("rejects unsupported credentials for $name even with skip-scope-check", async (entry) => {
    const fetch = vi.fn();
    const kind = entry.name === "personal documents" ? "sk" : "oauth";
    const result = await run(["--json", "--yes", "--skip-scope-check", ...entry.args], {
      env: { EPROSPERA_API_KEY: "" },
      loadStoredCredential: async () => ({ kind, token: "test", scopes: [] }),
      fetch,
    });
    expect(result.exitCode).toBe(4);
    expect(result.json().error.code).toBe("UNSUPPORTED_CREDENTIAL_TYPE");
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(writes)("dry-runs $name without credentials, prompts, or requests", async (entry) => {
    const fetch = vi.fn();
    const loadStoredCredential = vi.fn();
    const promptConfirm = vi.fn();
    const result = await run(["--json", "--dry-run", ...entry.args], {
      env: { EPROSPERA_API_KEY: "" },
      fetch,
      loadStoredCredential,
      promptConfirm,
    });
    expect(result.exitCode).toBe(0);
    expect(result.json()).toEqual({
      dryRun: true,
      request: {
        method: entry.method,
        path: entry.path,
        ...(entry.body === undefined ? {} : { body: entry.body }),
      },
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(loadStoredCredential).not.toHaveBeenCalled();
    expect(promptConfirm).not.toHaveBeenCalled();
  });

  it.each(writes)("cancels $name when interactive confirmation is declined", async (entry) => {
    const fetch = vi.fn();
    const promptConfirm = vi.fn(async () => false);
    const result = await run(entry.args, { fetch, promptConfirm }, true);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");
    expect(promptConfirm).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(writes)("does not retry $name on a server failure", async (entry) => {
    const fetch = vi.fn(async () => Response.json({ error: "Outcome unknown" }, { status: 500 }));
    const sleep = vi.fn(async () => {});
    const result = await run(["--json", "--yes", ...entry.args], {
      fetch,
      retry: { maxRetries: 3, sleep },
    });
    expect(result.exitCode).toBe(1);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it.each(reads)("retains read retries for $name", async (entry) => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ error: "Wait" }, { status: 429, headers: { "Retry-After": "2" } }),
      )
      .mockResolvedValueOnce(Response.json(entry.response));
    const sleep = vi.fn(async () => {});
    const result = await run(["--json", ...entry.args], {
      env: { EPROSPERA_API_KEY: "ak-test" },
      fetch,
      retry: { sleep },
    });
    expect(result.exitCode).toBe(0);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it("honors --yes on a human terminal without prompting", async () => {
    const promptConfirm = vi.fn(async () => false);
    const result = await run(
      ["--yes", "entity", "certificate", "create", entityId],
      {
        promptConfirm,
        fetch: async () => Response.json({ data: { id: requestId } }),
      },
      true,
    );
    expect(result.exitCode).toBe(0);
    expect(promptConfirm).not.toHaveBeenCalled();
  });
});

describe("filing input validation", () => {
  it.each([
    ["create", {}],
    ["create", { updatedName: null }],
    ["create", { updatedName: "  " }],
    ["create", { updatedName: "x".repeat(201) }],
    ["create", { updatedExtension: "x".repeat(51) }],
    ["create", { updatedAddress: { line1: "Street" } }],
    ["create", { unknown: "name" }],
    ["update", {}],
    ["update", { updatedNameStartsWithExtension: "false" }],
  ])("rejects invalid amendment %s input %j before network", async (action, body) => {
    await writeFile(join(dir, "payload.json"), JSON.stringify(body));
    const fetch = vi.fn();
    const args = ["--json", "--dry-run", "entity", "amendment", String(action), entityId];
    if (action === "update") args.push(filingId);
    const result = await run([...args, "--file", "payload.json"], { fetch });
    expect(result.exitCode).toBe(2);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    "create",
    "update",
  ])("preserves omitted fields and false for amendment %s", async (action) => {
    const body = { updatedNameStartsWithExtension: false };
    await writeFile(join(dir, "payload.json"), JSON.stringify(body));
    const args = ["--json", "--dry-run", "entity", "amendment", action, entityId];
    if (action === "update") args.push(filingId);
    const result = await run([...args, "--file", "payload.json"]);
    expect(result.exitCode).toBe(0);
    expect(result.json().request.body).toEqual(body);
  });

  it("sends explicit null without adding omitted proposal fields on PATCH", async () => {
    await writeFile(join(dir, "payload.json"), JSON.stringify({ updatedName: null }));
    const fetch = vi.fn(async (request: Request) => {
      expect(await request.json()).toEqual({ updatedName: null });
      return Response.json({ data: { ...filing, proposedChanges: {} } });
    });
    const result = await run(
      [
        "--json",
        "--yes",
        "entity",
        "amendment",
        "update",
        entityId,
        filingId,
        "--file",
        "payload.json",
      ],
      { fetch },
    );
    expect(result.exitCode).toBe(0);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("validates and sends a complete principal-office address", async () => {
    const updatedAddress = {
      line1: "Street",
      line2: null,
      city: "Roatan",
      state: null,
      postalCode: "34101",
      country: "Honduras",
    };
    await writeFile(join(dir, "payload.json"), JSON.stringify({ updatedAddress }));
    const result = await run([
      "--json",
      "--dry-run",
      "entity",
      "amendment",
      "create",
      entityId,
      "--file",
      "payload.json",
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.json().request.body).toEqual({ updatedAddress });
  });

  it.each([
    { contest: {} },
    { contest: { note: " ", proofUrl: "https://example.test/proof" } },
    { contest: { note: "x".repeat(2001), proofUrl: "https://example.test/proof" } },
    { contest: { note: "Review", proofUrl: "not a url" } },
    { contest: { note: "Review", proofUrl: `https://example.test/${"x".repeat(2048)}` } },
  ])("rejects invalid certificate contest %j", async (body) => {
    await writeFile(join(dir, "payload.json"), JSON.stringify(body));
    const result = await run([
      "--json",
      "--dry-run",
      "entity",
      "certificate",
      "create",
      entityId,
      "--file",
      "payload.json",
    ]);
    expect(result.exitCode).toBe(2);
  });

  it.each([
    {
      name: "misspelled contest",
      body: { contset: { note: "Review", proofUrl: "https://example.test/proof" } },
    },
    {
      name: "unknown contest field",
      body: {
        contest: {
          note: "Review",
          proofUrl: "https://example.test/proof",
          proofURL: "https://example.test/other",
        },
      },
    },
  ])("rejects $name before credentials, confirmation, or a write", async ({ body }) => {
    await writeFile(join(dir, "payload.json"), JSON.stringify(body));
    const fetch = vi.fn();
    const loadStoredCredential = vi.fn();
    const promptConfirm = vi.fn();
    for (const mode of ["--yes", "--dry-run"]) {
      const result = await run(
        ["--json", mode, "entity", "certificate", "create", entityId, "--file", "payload.json"],
        { env: { EPROSPERA_API_KEY: "" }, fetch, loadStoredCredential, promptConfirm },
      );
      expect(result.exitCode).toBe(2);
      expect(result.json().error).toMatchObject({
        code: "INVALID_USAGE",
        details: [expect.objectContaining({ code: "unrecognized_keys" })],
      });
    }
    expect(fetch).not.toHaveBeenCalled();
    expect(loadStoredCredential).not.toHaveBeenCalled();
    expect(promptConfirm).not.toHaveBeenCalled();
  });

  it("sends valid contest evidence and leaves host approval to the API", async () => {
    const body = {
      contest: { note: "Review payment", proofUrl: "https://documents.example.test/proof.pdf" },
    };
    await writeFile(join(dir, "payload.json"), JSON.stringify(body));
    const fetch = vi.fn(async (request: Request) => {
      expect(await request.json()).toEqual(body);
      return Response.json({ data: { id: requestId, contested: true } });
    });
    const result = await run(
      ["--json", "--yes", "entity", "certificate", "create", entityId, "--file", "payload.json"],
      { fetch },
    );
    expect(result.exitCode).toBe(0);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["entity", "amendment", "list", "invalid"],
    ["entity", "amendment", "get", entityId, "invalid"],
    ["entity", "certificate", "get", entityId, "invalid"],
    ["entity", "amendment", "create", entityId],
    ["entity", "amendment", "pay", entityId, filingId],
    ["entity", "certificate", "pay", entityId, requestId, "--voucher", " "],
  ])("rejects invalid arguments %j", async (...args) => {
    const fetch = vi.fn();
    const result = await run(["--json", ...args], { fetch });
    expect(result.exitCode).toBe(2);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    "missing.json",
    "payload.json",
  ])("rejects unreadable/malformed JSON in %s", async (file) => {
    await writeFile(join(dir, "payload.json"), "not JSON");
    const result = await run([
      "--json",
      "--dry-run",
      "entity",
      "amendment",
      "create",
      entityId,
      "--file",
      file,
    ]);
    expect(result.exitCode).toBe(8);
    expect(result.json().error.code).toBe("INVALID_JSON_FILE");
  });
});

describe("filing recovery and output", () => {
  it.each([
    "pay",
    "submit",
  ])("preserves settled-payment recovery context from amendment %s", async (action) => {
    const recovery = {
      invoiceId: requestId,
      filingId,
      data: { invoice: { statusId: "paid" }, statusId: "Pending Review" },
      nextSteps: { reviewDispatchPending: true },
    };
    const fetch = vi.fn(async () =>
      Response.json(
        { error: "Submission saved; retry dispatch", code: "submission_not_queued", ...recovery },
        { status: 503 },
      ),
    );
    const args = ["--json", "--yes", "entity", "amendment", action, entityId, filingId];
    if (action === "pay") args.push("--voucher", "TEST");
    const result = await run(args, { fetch });
    expect(result.exitCode).toBe(1);
    expect(result.json().error).toMatchObject({
      code: "submission_not_queued",
      message: "Submission saved; retry dispatch",
      httpStatus: 503,
      details: null,
      recovery,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("preserves certificate conflict codes", async () => {
    const result = await run(["--json", "--yes", "entity", "certificate", "create", entityId], {
      fetch: async () =>
        Response.json({ error: "Taxes overdue", code: "certificate.tax_overdue" }, { status: 409 }),
    });
    expect(result.exitCode).toBe(6);
    expect(result.json().error.code).toBe("certificate.tax_overdue");
  });

  it("does not retry an uncertain payment timeout", async () => {
    const fetch = vi.fn(async () => {
      throw new DOMException("Timed out", "TimeoutError");
    });
    const result = await run(
      ["--json", "--yes", "entity", "amendment", "pay", entityId, filingId, "--voucher", "TEST"],
      { fetch },
    );
    expect(result.exitCode).toBe(9);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("supports raw field selection on complete envelopes", async () => {
    const result = await run(
      [
        "--raw",
        "--fields",
        "data.id,data.nextSteps.signatureUrl",
        "entity",
        "amendment",
        "get",
        entityId,
        filingId,
      ],
      {
        fetch: async () => Response.json({ data: filing }),
      },
    );
    expect(result.stdout).toBe(
      `${JSON.stringify({ data: { id: filingId, nextSteps: { signatureUrl: nextSteps.signatureUrl } } })}\n`,
    );
    expect(result.stderr).toBe("");
  });

  it.each([
    {
      args: ["entity", "amendment", "get", entityId, filingId],
      response: { data: filing },
      visible: ["Draft", nextSteps.signatureUrl, "submitReady"],
    },
    {
      args: ["entity", "certificate", "list", entityId],
      response: { data: [], eligibility: { eligible: true, taxCompliant: false } },
      visible: ["(empty)", "Eligibility", "taxCompliant", "false"],
    },
    {
      args: ["me", "documents"],
      response: personalDocuments,
      visible: ["Agreement of Coexistence", "signedDocumentUrl", "templatePdfUrl", "aoc_example"],
    },
  ])("shows workflow metadata in human output for $args", async ({ args, response, visible }) => {
    const result = await run(["--no-auto-json", ...args], {
      env: { EPROSPERA_API_KEY: "ak-test" },
      fetch: async () => Response.json(response),
    });
    expect(result.exitCode).toBe(0);
    for (const text of visible) expect(result.stdout).toContain(text);
  });
});

describe("personal documents", () => {
  it.each([
    { scopes: [] },
    { scopes: ["eprospera:person.documents.read"] },
  ])("enforces OAuth document consent $scopes", async ({ scopes }) => {
    const fetch = vi.fn(async () => Response.json(personalDocuments));
    const result = await run(["--json", "me", "documents"], {
      env: { EPROSPERA_API_KEY: "" },
      loadStoredCredential: async () => ({ kind: "oauth", token: "oauth-test", scopes }),
      fetch,
    });
    expect(result.exitCode).toBe(scopes.length ? 0 : 4);
    expect(fetch).toHaveBeenCalledTimes(scopes.length ? 1 : 0);
    expect(DEFAULT_OAUTH_SCOPES).not.toContain("eprospera:person.documents.read");
  });

  it.each([
    { data: [], agreementOfCoexistence: null },
    { data: personalDocuments.data, agreementOfCoexistence: null },
    personalDocuments,
  ])("preserves empty, historical, and pending documents %j", async (response) => {
    const fetch = vi.fn(async () => Response.json(response));
    const result = await run(["--json", "me", "documents"], {
      env: { EPROSPERA_API_KEY: "ak-test" },
      fetch,
    });
    expect(result.exitCode).toBe(0);
    expect(result.json()).toEqual(response);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

async function run(args: string[], deps: RuntimeDependencies = {}, tty = false) {
  let stdout = "";
  let stderr = "";
  const exitCode = await runCli(["node", "eprospera", ...args], {
    cwd: dir,
    configStore: { homeDir: dir, env: {} },
    loadStoredCredential: async () => undefined,
    fetch: async () => {
      throw new Error("Unexpected network request");
    },
    ...deps,
    env: { EPROSPERA_BASE_URL: baseUrl, EPROSPERA_API_KEY: "sk-test", ...deps.env },
    streams: {
      stdin: { isTTY: tty },
      stdout: {
        isTTY: tty,
        write: (chunk: string) => {
          stdout += chunk;
        },
      },
      stderr: {
        isTTY: tty,
        write: (chunk: string) => {
          stderr += chunk;
        },
      },
    },
  });
  return { exitCode, stdout, stderr, json: () => JSON.parse(stdout) };
}

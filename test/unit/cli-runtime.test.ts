import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execa } from "execa";
import { afterEach, describe, expect, it } from "vitest";
import { runCli } from "../../src/index.js";
import type { OutputWriter } from "../../src/output/format.js";

const tempDirs: string[] = [];
const require = createRequire(import.meta.url);
const tsxCliPath = require.resolve("tsx/cli");
const packageJson = require("../../package.json") as { version: string };

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("CLI runtime", () => {
  it("prints version through the executable entrypoint", async () => {
    const result = await execa(process.execPath, [tsxCliPath, "src/index.ts", "--version"], {
      cwd: process.cwd(),
    });

    expect(result.stdout).toBe(packageJson.version);
  });

  it("prints the OpenCLI schema as JSON when requested", async () => {
    const result = await runCommand(["--json", "schema"]);

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      command: {
        name: "eprospera",
      },
    });
  });

  it("runs entity verify with JSON stdout and bearer auth", async () => {
    let authorization: string | null = null;
    const result = await runCommand(["--json", "entity", "verify", "80000000000012"], {
      env: { EPROSPERA_API_KEY: "sk-test", EPROSPERA_BASE_URL: "https://api.test" },
      fetch: async (request) => {
        authorization = request.headers.get("authorization");
        return Response.json({ result: "found_legal_entity", active: true });
      },
    });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      result: "found_legal_entity",
      active: true,
    });
    expect(result.stderr).toBe("");
    expect(authorization).toBe("Bearer sk-test");
  });

  it("runs me profile with stored Agent Key scopes", async () => {
    const result = await runCommand(["--json", "me", "profile"], {
      env: { EPROSPERA_BASE_URL: "https://api.test" },
      loadStoredCredential: async () => ({
        kind: "ak",
        token: "ak-test",
        scopes: ["agent:person.details.read"],
        source: "file",
      }),
      fetch: async () => Response.json({ name: "Ada Lovelace" }),
    });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ name: "Ada Lovelace" });
  });

  it("applies raw mode and fields at the CLI boundary", async () => {
    const result = await runCommand(
      ["--raw", "--fields", "active", "entity", "verify", "80000000000012"],
      {
        env: { EPROSPERA_API_KEY: "sk-test", EPROSPERA_BASE_URL: "https://api.test" },
        fetch: async () =>
          Response.json({
            result: "found_legal_entity",
            active: true,
            ignored: "value",
          }),
      },
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('{"active":true}\n');
    expect(result.stderr).toBe("");
  });

  it("renders human tables without writing diagnostics to stdout", async () => {
    const result = await runCommand(
      ["--no-auto-json", "application", "list"],
      {
        env: { EPROSPERA_API_KEY: "sk-test", EPROSPERA_BASE_URL: "https://api.test" },
        fetch: async () =>
          Response.json({
            data: [
              {
                id: "app-1",
                statusId: "Draft",
                legalEntityId: "entity-1",
                createdAt: "2026-05-25T00:00:00.000Z",
              },
            ],
          }),
      },
      { stdoutTty: true },
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Draft");
    expect(result.stdout).toContain("entity-1");
    expect(result.stderr).toBe("");
  });

  it("fails with JSON usage errors before making invalid requests", async () => {
    const result = await runCommand(["--json", "entity", "verify", "bad-rpn"], {
      env: { EPROSPERA_API_KEY: "sk-test" },
      fetch: async () => {
        throw new Error("network should not be called");
      },
    });

    expect(result.exitCode).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
      error: {
        code: "INVALID_USAGE",
      },
    });
  });

  it("returns missing credential errors before calling the API", async () => {
    const result = await runCommand(["--json", "entity", "verify", "80000000000012"], {
      env: {},
      loadStoredCredential: async () => undefined,
      fetch: async () => {
        throw new Error("network should not be called");
      },
    });

    expect(result.exitCode).toBe(3);
    expect(JSON.parse(result.stdout)).toMatchObject({
      error: {
        code: "NO_CREDENTIAL",
      },
    });
  });

  it("returns missing scope errors before calling the API", async () => {
    const result = await runCommand(["--json", "application", "list"], {
      env: {},
      loadStoredCredential: async () => ({
        kind: "ak",
        token: "ak-test",
        scopes: ["agent:entity.application.create"],
      }),
      fetch: async () => {
        throw new Error("network should not be called");
      },
    });

    expect(result.exitCode).toBe(4);
    expect(JSON.parse(result.stdout)).toMatchObject({
      error: {
        code: "MISSING_SCOPE",
      },
    });
  });

  it("lets environment Agent Keys without cached scopes reach the API", async () => {
    let called = false;
    const result = await runCommand(["--json", "application", "list"], {
      env: { EPROSPERA_API_KEY: "ak-test", EPROSPERA_BASE_URL: "https://api.test" },
      fetch: async () => {
        called = true;
        return Response.json({ data: [] });
      },
    });

    expect(result.exitCode).toBe(0);
    expect(called).toBe(true);
    expect(JSON.parse(result.stdout)).toEqual({ data: [] });
  });

  it("lets flag Agent Keys without cached scopes reach the API", async () => {
    let authorization: string | null = null;
    const result = await runCommand(
      ["--json", "--api-key", "ak-test", "entity", "search", "prospera"],
      {
        env: { EPROSPERA_BASE_URL: "https://api.test" },
        fetch: async (request) => {
          authorization = request.headers.get("authorization");
          return Response.json({ results: [] });
        },
      },
    );

    expect(result.exitCode).toBe(0);
    expect(authorization).toBe("Bearer ak-test");
    expect(JSON.parse(result.stdout)).toEqual({ results: [] });
  });

  it("allows skip-scope-check for one-off Agent Keys", async () => {
    const result = await runCommand(["--json", "--skip-scope-check", "application", "list"], {
      env: { EPROSPERA_BASE_URL: "https://api.test" },
      loadStoredCredential: async () => ({
        kind: "ak",
        token: "ak-test",
        scopes: [],
      }),
      fetch: async () => Response.json({ data: [] }),
    });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ data: [] });
  });

  it("supports config set, get, list, and unset", async () => {
    const xdgConfigHome = await createTempDir();
    const env = { XDG_CONFIG_HOME: xdgConfigHome };

    await expect(
      runCommand(["--json", "config", "set", "api.baseUrl", "https://api.example.test"], { env }),
    ).resolves.toMatchObject({ exitCode: 0 });

    const getResult = await runCommand(["--json", "config", "get", "api.baseUrl"], { env });
    expect(JSON.parse(getResult.stdout)).toEqual({
      key: "api.baseUrl",
      value: "https://api.example.test",
    });

    const listResult = await runCommand(["--json", "config", "list"], { env });
    expect(JSON.parse(listResult.stdout)).toEqual({
      "api.baseUrl": "https://api.example.test",
    });

    const unsetResult = await runCommand(["--json", "config", "unset", "api.baseUrl"], { env });
    expect(JSON.parse(unsetResult.stdout)).toEqual({
      key: "api.baseUrl",
      deleted: true,
    });
  });

  it("stores Agent Key login metadata without echoing tokens", async () => {
    const saved: unknown[] = [];
    const result = await runCommand(
      [
        "--json",
        "--api-key",
        "ak-secret",
        "auth",
        "login",
        "--agent-key",
        "--scopes",
        "agent:verify_rpn",
      ],
      {
        saveStoredCredential: async (credential) => {
          saved.push(credential);
          return "file";
        },
      },
    );

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      kind: "ak",
      source: "file",
      scopes: ["agent:verify_rpn"],
      saved: true,
    });
    expect(result.stdout).not.toContain("ak-secret");
    expect(saved).toEqual([
      {
        kind: "ak",
        token: "ak-secret",
        scopes: ["agent:verify_rpn"],
      },
    ]);
  });

  it("shows when one-off Agent Key scopes are not cached", async () => {
    const result = await runCommand(["--json", "auth", "whoami"], {
      env: { EPROSPERA_API_KEY: "ak-test" },
      fetch: async () => {
        throw new Error("network should not be called");
      },
    });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      kind: "ak",
      source: "env",
      scopes: [],
      cachedScopes: {
        known: false,
        source: "unavailable",
      },
    });
    expect(result.stdout).not.toContain("ak-test");
  });

  it("verifies Agent Key identity through the current user endpoint", async () => {
    let requestUrl: string | undefined;
    const result = await runCommand(["--json", "auth", "whoami", "--verify"], {
      env: { EPROSPERA_API_KEY: "ak-test", EPROSPERA_BASE_URL: "https://api.test" },
      fetch: async (request) => {
        requestUrl = request.url;
        return Response.json({
          name: "Ada Lovelace",
          givenName: "Ada",
          surname: "Lovelace",
          residentPermitNumber: "80000000000012",
          address: { country: "HN" },
        });
      },
    });

    expect(result.exitCode).toBe(0);
    expect(requestUrl).toBe("https://api.test/api/v1/me/natural-person");
    expect(JSON.parse(result.stdout)).toMatchObject({
      kind: "ak",
      source: "env",
      verification: {
        status: "verified",
        endpoint: "GET /api/v1/me/natural-person",
        identity: {
          name: "Ada Lovelace",
          givenName: "Ada",
          surname: "Lovelace",
          residentPermitNumber: "80000000000012",
        },
      },
    });
    expect(result.stdout).not.toContain("address");
    expect(result.stdout).not.toContain("ak-test");
  });

  it("reports Agent Key identity verification as unavailable when identity scope is missing", async () => {
    const result = await runCommand(["--json", "auth", "whoami", "--verify"], {
      env: { EPROSPERA_API_KEY: "ak-test", EPROSPERA_BASE_URL: "https://api.test" },
      fetch: async () =>
        Response.json(
          {
            error: {
              code: "MISSING_SCOPE",
              message: "Missing required scope.",
            },
          },
          { status: 403 },
        ),
    });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      kind: "ak",
      verification: {
        status: "unavailable",
        endpoint: "GET /api/v1/me/natural-person",
      },
    });
    expect(result.stdout).not.toContain("ak-test");
  });

  it("reports Agent Key identity verification authentication failures", async () => {
    const result = await runCommand(["--json", "auth", "whoami", "--verify"], {
      env: { EPROSPERA_API_KEY: "ak-test", EPROSPERA_BASE_URL: "https://api.test" },
      fetch: async () =>
        Response.json(
          {
            error: {
              code: "UNAUTHENTICATED",
              message: "Authentication failed.",
            },
          },
          { status: 401 },
        ),
    });

    expect(result.exitCode).toBe(3);
    expect(JSON.parse(result.stdout)).toMatchObject({
      error: {
        code: "UNAUTHENTICATED",
        httpStatus: 401,
      },
    });
    expect(result.stdout).not.toContain("ak-test");
  });

  it("verifies OAuth identity through userinfo", async () => {
    let authorization: string | null = null;
    let requestUrl: string | undefined;
    const result = await runCommand(["--json", "auth", "whoami", "--verify"], {
      env: { EPROSPERA_BASE_URL: "https://api.test" },
      loadStoredCredential: async () => ({
        kind: "oauth",
        token: "oauth-test",
        scopes: ["openid", "profile"],
      }),
      fetch: async (request) => {
        authorization = request.headers.get("authorization");
        requestUrl = request.url;
        return Response.json({
          sub: "person-1",
          name: "Ada Lovelace",
          email: "ada@example.test",
          email_verified: true,
          picture: "https://example.test/avatar.png",
        });
      },
    });

    expect(result.exitCode).toBe(0);
    expect(authorization).toBe("Bearer oauth-test");
    expect(requestUrl).toBe("https://api.test/api/oauth/userinfo");
    expect(JSON.parse(result.stdout)).toMatchObject({
      kind: "oauth",
      source: "keytar",
      verification: {
        status: "verified",
        endpoint: "GET /api/oauth/userinfo",
        identity: {
          sub: "person-1",
          name: "Ada Lovelace",
          email: "ada@example.test",
          email_verified: true,
        },
      },
    });
    expect(result.stdout).not.toContain("picture");
    expect(result.stdout).not.toContain("oauth-test");
  });

  it("reports standard API key identity verification as unavailable", async () => {
    const result = await runCommand(["--json", "auth", "whoami", "--verify"], {
      env: { EPROSPERA_API_KEY: "sk-test", EPROSPERA_BASE_URL: "https://api.test" },
      fetch: async () => {
        throw new Error("network should not be called");
      },
    });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      kind: "sk",
      cachedScopes: {
        known: false,
        source: "not-applicable",
      },
      verification: {
        status: "unavailable",
        reason: "Standard API keys do not expose an owner identity endpoint.",
      },
    });
    expect(result.stdout).not.toContain("sk-test");
  });

  it("uses --yes to bypass interactive write confirmations", async () => {
    let prompted = false;
    let paid = false;
    const result = await runCommand(
      [
        "--json",
        "--yes",
        "application",
        "pay",
        "00000000-0000-4000-8000-000000000000",
        "--coupon",
        "FOUNDER100",
      ],
      {
        env: { EPROSPERA_API_KEY: "sk-test", EPROSPERA_BASE_URL: "https://api.test" },
        promptConfirm: async () => {
          prompted = true;
          return false;
        },
        fetch: async () => {
          paid = true;
          return Response.json({ data: { id: "app-1", statusId: "Paid" } });
        },
      },
      { stdinTty: true, stdoutTty: true, stderrTty: true },
    );

    expect(result.exitCode).toBe(0);
    expect(prompted).toBe(false);
    expect(paid).toBe(true);
  });

  it("prints application create dry-runs without credentials or network", async () => {
    const dir = await createTempDir();
    const filePath = join(dir, "application.json");
    await writeFile(
      filePath,
      JSON.stringify({
        applicationData: {
          residencyType: "e-Resident",
          entityType: "llc",
          name: "Acme",
          extension: "LLC",
          principalOffice: { country: "HN" },
          contactEmail: "ops@example.test",
        },
      }),
    );

    const result = await runCommand(
      ["--json", "application", "create", "--file", filePath, "--dry-run"],
      {
        fetch: async () => {
          throw new Error("network should not be called");
        },
      },
    );

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      dryRun: true,
      request: {
        method: "POST",
        path: "/api/v1/legal_entity_applications",
      },
    });
  });

  it("watches application state transitions as NDJSON", async () => {
    const responses = [
      { data: { id: "00000000-0000-4000-8000-000000000000", statusId: "Draft" } },
      { data: { id: "00000000-0000-4000-8000-000000000000", statusId: "Approved" } },
    ];

    const result = await runCommand(
      [
        "--json",
        "application",
        "watch",
        "00000000-0000-4000-8000-000000000000",
        "--initial-interval",
        "1ms",
      ],
      {
        env: { EPROSPERA_API_KEY: "sk-test", EPROSPERA_BASE_URL: "https://api.test" },
        sleep: async () => {},
        fetch: async () => Response.json(responses.shift() ?? responses[0]),
      },
    );

    expect(result.exitCode).toBe(0);
    expect(
      result.stdout
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line)),
    ).toEqual([
      { data: { id: "00000000-0000-4000-8000-000000000000", statusId: "Draft" } },
      { data: { id: "00000000-0000-4000-8000-000000000000", statusId: "Approved" } },
    ]);
  });

  it("reports application watch terminal failure states", async () => {
    const result = await runCommand(
      ["--json", "application", "watch", "00000000-0000-4000-8000-000000000000"],
      {
        env: { EPROSPERA_API_KEY: "sk-test", EPROSPERA_BASE_URL: "https://api.test" },
        fetch: async () =>
          Response.json({
            data: { id: "00000000-0000-4000-8000-000000000000", statusId: "Rejected" },
          }),
      },
    );

    expect(result.exitCode).toBe(10);
    expect(JSON.parse(lastErrorEnvelope(result.stdout))).toMatchObject({
      error: {
        code: "TERMINAL_FAILURE_STATE",
      },
    });
  });

  it("reports application watch timeouts", async () => {
    let currentMs = 0;
    const result = await runCommand(
      [
        "--json",
        "application",
        "watch",
        "00000000-0000-4000-8000-000000000000",
        "--timeout",
        "1ms",
        "--initial-interval",
        "1ms",
      ],
      {
        env: { EPROSPERA_API_KEY: "sk-test", EPROSPERA_BASE_URL: "https://api.test" },
        now: () => currentMs,
        sleep: async (ms) => {
          currentMs += ms;
        },
        fetch: async () =>
          Response.json({
            data: { id: "00000000-0000-4000-8000-000000000000", statusId: "Draft" },
          }),
      },
    );

    expect(result.exitCode).toBe(9);
    expect(JSON.parse(lastErrorEnvelope(result.stdout))).toMatchObject({
      error: {
        code: "WATCH_TIMEOUT",
      },
    });
  });
});

async function runCommand(
  args: string[],
  deps: Parameters<typeof runCli>[1] = {},
  streamOptions: { stdinTty?: boolean; stdoutTty?: boolean; stderrTty?: boolean } = {},
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const stdout = new BufferWriter(streamOptions.stdoutTty ?? false);
  const stderr = new BufferWriter(streamOptions.stderrTty ?? false);
  const exitCode = await runCli(["node", "eprospera", ...args], {
    ...deps,
    streams: {
      stdin: { isTTY: streamOptions.stdinTty ?? false },
      stdout,
      stderr,
    },
  });

  return {
    exitCode,
    stdout: stdout.text(),
    stderr: stderr.text(),
  };
}

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "eprospera-cli-"));
  tempDirs.push(dir);
  return dir;
}

function lastErrorEnvelope(stdout: string): string {
  const index = stdout.lastIndexOf('{\n  "error"');
  expect(index).toBeGreaterThanOrEqual(0);
  return stdout.slice(index);
}

class BufferWriter implements OutputWriter {
  readonly #chunks: string[] = [];
  readonly isTTY: boolean;

  constructor(isTTY: boolean) {
    this.isTTY = isTTY;
  }

  write(chunk: string): boolean {
    this.#chunks.push(chunk);
    return true;
  }

  text(): string {
    return this.#chunks.join("");
  }
}

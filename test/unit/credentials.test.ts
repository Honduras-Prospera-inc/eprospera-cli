import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveCredential } from "../../src/credentials/resolve.js";
import {
  CREDENTIAL_ACCOUNT,
  CREDENTIAL_SERVICE,
  deleteCredential,
  getCredentialFilePath,
  type KeytarAdapter,
  loadCredential,
  saveCredential,
} from "../../src/credentials/store.js";
import type { StoredCredential } from "../../src/credentials/types.js";
import { ExitCodes } from "../../src/errors.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("credential store", () => {
  it("writes and reads plaintext fallback credentials", async () => {
    const xdgConfigHome = await createTempDir();
    const credential = storedCredential({ kind: "ak", token: "ak-test" });

    await expect(
      saveCredential(credential, { env: { XDG_CONFIG_HOME: xdgConfigHome }, keytar: null }),
    ).resolves.toBe("file");

    await expect(
      loadCredential({ env: { XDG_CONFIG_HOME: xdgConfigHome }, keytar: null }),
    ).resolves.toMatchObject({
      kind: "ak",
      token: "ak-test",
      scopes: ["agent:verify_rpn"],
      source: "file",
    });
  });

  it.skipIf(process.platform === "win32")(
    "writes plaintext fallback credentials with safe POSIX permissions",
    async () => {
      const xdgConfigHome = await createTempDir();
      const credential = storedCredential({ kind: "ak", token: "ak-test" });

      await saveCredential(credential, {
        env: { XDG_CONFIG_HOME: xdgConfigHome },
        keytar: null,
      });

      const filePath = getCredentialFilePath({ env: { XDG_CONFIG_HOME: xdgConfigHome } });
      await expect(modeOf(dirname(filePath))).resolves.toBe(0o700);
      await expect(modeOf(filePath)).resolves.toBe(0o600);
    },
  );

  it("prefers keytar credentials over the plaintext fallback", async () => {
    const xdgConfigHome = await createTempDir();
    const keytar = new MemoryKeytar();

    await saveCredential(storedCredential({ kind: "sk", token: "sk-file" }), {
      env: { XDG_CONFIG_HOME: xdgConfigHome },
      keytar: null,
    });
    await keytar.setPassword(
      CREDENTIAL_SERVICE,
      CREDENTIAL_ACCOUNT,
      JSON.stringify(storedCredential({ kind: "ak", token: "ak-keytar" })),
    );

    await expect(
      loadCredential({ env: { XDG_CONFIG_HOME: xdgConfigHome }, keytar }),
    ).resolves.toMatchObject({
      kind: "ak",
      token: "ak-keytar",
      source: "keytar",
    });
  });

  it("falls back to the plaintext store when keytar writes fail", async () => {
    const xdgConfigHome = await createTempDir();
    const keytar = new MemoryKeytar({ failSet: true });

    await expect(
      saveCredential(storedCredential({ kind: "ak", token: "ak-fallback" }), {
        env: { XDG_CONFIG_HOME: xdgConfigHome },
        keytar,
      }),
    ).resolves.toBe("file");

    await expect(
      loadCredential({ env: { XDG_CONFIG_HOME: xdgConfigHome }, keytar: null }),
    ).resolves.toMatchObject({
      token: "ak-fallback",
      source: "file",
    });
  });

  it("deletes keytar and plaintext fallback credentials", async () => {
    const xdgConfigHome = await createTempDir();
    const keytar = new MemoryKeytar();

    await saveCredential(storedCredential({ kind: "sk", token: "sk-file" }), {
      env: { XDG_CONFIG_HOME: xdgConfigHome },
      keytar: null,
    });
    await keytar.setPassword(
      CREDENTIAL_SERVICE,
      CREDENTIAL_ACCOUNT,
      JSON.stringify(storedCredential({ kind: "ak", token: "ak-keytar" })),
    );

    await expect(
      deleteCredential({ env: { XDG_CONFIG_HOME: xdgConfigHome }, keytar }),
    ).resolves.toBe(true);
    await expect(keytar.getPassword(CREDENTIAL_SERVICE, CREDENTIAL_ACCOUNT)).resolves.toBeNull();
    await expect(
      loadCredential({ env: { XDG_CONFIG_HOME: xdgConfigHome }, keytar: null }),
    ).resolves.toBeUndefined();
  });

  it("rejects malformed fallback credentials", async () => {
    const xdgConfigHome = await createTempDir();
    const filePath = getCredentialFilePath({ env: { XDG_CONFIG_HOME: xdgConfigHome } });
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, "{not-json", { mode: 0o600 });

    await expect(
      loadCredential({ env: { XDG_CONFIG_HOME: xdgConfigHome }, keytar: null }),
    ).rejects.toMatchObject({
      code: "INVALID_CREDENTIAL",
      exitCode: ExitCodes.Authentication,
    });
  });
});

describe("credential resolution", () => {
  it("prefers explicit API keys over env and stored credentials", async () => {
    await expect(
      resolveCredential({
        apiKey: "ak-flag",
        env: { EPROSPERA_API_KEY: "sk-env" },
        loadStoredCredential: async () => storedCredential({ kind: "sk", token: "sk-store" }),
      }),
    ).resolves.toMatchObject({
      kind: "ak",
      token: "ak-flag",
      source: "flag",
      scopes: [],
    });
  });

  it("uses EPROSPERA_API_KEY before stored credentials", async () => {
    await expect(
      resolveCredential({
        env: { EPROSPERA_API_KEY: "sk-env" },
        loadStoredCredential: async () => storedCredential({ kind: "ak", token: "ak-store" }),
      }),
    ).resolves.toMatchObject({
      kind: "sk",
      token: "sk-env",
      source: "env",
    });
  });

  it("defaults unknown bearer token prefixes to standard-key credentials", async () => {
    await expect(resolveCredential({ apiKey: "opaque-token" })).resolves.toMatchObject({
      kind: "sk",
      token: "opaque-token",
    });
  });

  it("returns stored credential metadata and source", async () => {
    await expect(
      resolveCredential({
        loadStoredCredential: async () => ({
          ...storedCredential({ kind: "oauth", token: "oauth-token" }),
          source: "file",
        }),
      }),
    ).resolves.toMatchObject({
      kind: "oauth",
      owner: "Owner",
      source: "file",
    });
  });

  it("rejects missing credentials", async () => {
    await expect(
      resolveCredential({ env: {}, loadStoredCredential: async () => undefined }),
    ).rejects.toMatchObject({
      code: "NO_CREDENTIAL",
      exitCode: ExitCodes.Authentication,
    });
  });

  it("rejects expired stored credentials", async () => {
    await expect(
      resolveCredential({
        now: () => 2_000,
        loadStoredCredential: async () =>
          storedCredential({ kind: "oauth", token: "oauth-token", expiresAt: 1_000 }),
      }),
    ).rejects.toMatchObject({
      code: "EXPIRED_CREDENTIAL",
      exitCode: ExitCodes.Authentication,
    });
  });
});

function storedCredential(
  overrides: Partial<StoredCredential> & Pick<StoredCredential, "kind" | "token">,
): StoredCredential {
  return {
    kind: overrides.kind,
    token: overrides.token,
    refreshToken: overrides.refreshToken,
    scopes: overrides.scopes ?? ["agent:verify_rpn"],
    expiresAt: overrides.expiresAt,
    owner: overrides.owner ?? "Owner",
  };
}

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "eprospera-cli-"));
  tempDirs.push(dir);
  return dir;
}

async function modeOf(path: string): Promise<number> {
  return (await stat(path)).mode & 0o777;
}

class MemoryKeytar implements KeytarAdapter {
  readonly #passwords = new Map<string, string>();
  readonly #failSet: boolean;

  constructor(options: { failSet?: boolean } = {}) {
    this.#failSet = options.failSet ?? false;
  }

  async getPassword(service: string, account: string): Promise<string | null> {
    return this.#passwords.get(key(service, account)) ?? null;
  }

  async setPassword(service: string, account: string, password: string): Promise<void> {
    if (this.#failSet) {
      throw new Error("keytar unavailable");
    }
    this.#passwords.set(key(service, account), password);
  }

  async deletePassword(service: string, account: string): Promise<boolean> {
    return this.#passwords.delete(key(service, account));
  }
}

function key(service: string, account: string): string {
  return `${service}:${account}`;
}

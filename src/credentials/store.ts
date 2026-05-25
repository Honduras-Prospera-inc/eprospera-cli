import { constants } from "node:fs";
import { access, chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { ExitCodes, ExitError } from "../errors.js";
import { type CredentialSource, isCredentialKind, type StoredCredential } from "./types.js";

export const CREDENTIAL_SERVICE = "eprospera-cli";
export const CREDENTIAL_ACCOUNT = "default";
export const CREDENTIAL_FILE_NAME = "credentials.json";

export type KeytarAdapter = {
  getPassword(service: string, account: string): Promise<string | null>;
  setPassword(service: string, account: string, password: string): Promise<void>;
  deletePassword(service: string, account: string): Promise<boolean>;
};

export type CredentialStoreOptions = {
  env?: NodeJS.ProcessEnv;
  homeDir?: string;
  keytar?: KeytarAdapter | null;
};

export type LoadedCredential = StoredCredential & {
  source: Extract<CredentialSource, "keytar" | "file">;
};

export async function loadCredential(
  options: CredentialStoreOptions = {},
): Promise<LoadedCredential | undefined> {
  const keytar = await resolveKeytar(options);
  if (keytar) {
    const encoded = await loadKeytarCredential(keytar);
    if (encoded) {
      return { ...parseStoredCredential(encoded, "keytar"), source: "keytar" };
    }
  }

  const encoded = await loadFileCredential(options);
  return encoded ? { ...parseStoredCredential(encoded, "file"), source: "file" } : undefined;
}

export async function saveCredential(
  credential: StoredCredential,
  options: CredentialStoreOptions = {},
): Promise<CredentialSource> {
  const encoded = `${JSON.stringify(normalizeStoredCredential(credential), null, 2)}\n`;
  const keytar = await resolveKeytar(options);

  if (keytar) {
    try {
      await keytar.setPassword(CREDENTIAL_SERVICE, CREDENTIAL_ACCOUNT, encoded);
      await deleteFileCredential(options);
      return "keytar";
    } catch {
      // Fall through to the plaintext store when the OS keychain is unavailable.
    }
  }

  await saveFileCredential(encoded, options);
  return "file";
}

export async function deleteCredential(options: CredentialStoreOptions = {}): Promise<boolean> {
  let deleted = false;
  const keytar = await resolveKeytar(options);

  if (keytar) {
    try {
      deleted = (await keytar.deletePassword(CREDENTIAL_SERVICE, CREDENTIAL_ACCOUNT)) || deleted;
    } catch {
      // Still attempt to clean up the fallback file.
    }
  }

  return (await deleteFileCredential(options)) || deleted;
}

export function getCredentialConfigDir(options: CredentialStoreOptions = {}): string {
  const xdgConfigHome = options.env?.XDG_CONFIG_HOME?.trim();
  return join(xdgConfigHome || join(options.homeDir ?? homedir(), ".config"), CREDENTIAL_SERVICE);
}

export function getCredentialFilePath(options: CredentialStoreOptions = {}): string {
  return join(getCredentialConfigDir(options), CREDENTIAL_FILE_NAME);
}

async function resolveKeytar(options: CredentialStoreOptions): Promise<KeytarAdapter | undefined> {
  if (options.keytar !== undefined) {
    return options.keytar ?? undefined;
  }

  try {
    // Keep keytar optional in ncc bundles so standalone artifacts can use file fallback.
    const keytarPackageName = ["keytar"].join("");
    const keytarModule = (await import(keytarPackageName)) as unknown;
    return unwrapKeytarModule(keytarModule);
  } catch {
    return undefined;
  }
}

function unwrapKeytarModule(module: unknown): KeytarAdapter | undefined {
  if (isKeytarAdapter(module)) {
    return module;
  }
  if (isRecord(module) && isKeytarAdapter(module.default)) {
    return module.default;
  }
  return undefined;
}

async function loadKeytarCredential(keytar: KeytarAdapter): Promise<string | undefined> {
  try {
    return (await keytar.getPassword(CREDENTIAL_SERVICE, CREDENTIAL_ACCOUNT)) ?? undefined;
  } catch {
    return undefined;
  }
}

async function loadFileCredential(options: CredentialStoreOptions): Promise<string | undefined> {
  const filePath = getCredentialFilePath(options);
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return undefined;
    }
    throw credentialError(
      "CREDENTIAL_STORE_UNREADABLE",
      "Stored credentials could not be read.",
      error,
    );
  }
}

async function saveFileCredential(encoded: string, options: CredentialStoreOptions): Promise<void> {
  const filePath = getCredentialFilePath(options);
  await ensureCredentialDirectory(dirname(filePath));
  await writeFile(filePath, encoded, { mode: 0o600 });
  await chmod(filePath, 0o600);
}

async function deleteFileCredential(options: CredentialStoreOptions): Promise<boolean> {
  const filePath = getCredentialFilePath(options);
  try {
    await access(filePath, constants.F_OK);
    await rm(filePath);
    return true;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return false;
    }
    throw credentialError(
      "CREDENTIAL_STORE_UNWRITABLE",
      "Stored credentials could not be deleted.",
      error,
    );
  }
}

async function ensureCredentialDirectory(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true, mode: 0o700 });
  await chmod(dirPath, 0o700);
}

function parseStoredCredential(encoded: string, source: CredentialSource): StoredCredential {
  let parsed: unknown;
  try {
    parsed = JSON.parse(encoded);
  } catch (error) {
    throw credentialError(
      "INVALID_CREDENTIAL",
      `Stored ${source} credential is not valid JSON.`,
      error,
    );
  }

  return normalizeStoredCredential(parsed);
}

function normalizeStoredCredential(value: unknown): StoredCredential {
  if (!isRecord(value) || !isCredentialKind(value.kind) || !nonEmptyString(value.token)) {
    throw credentialError(
      "INVALID_CREDENTIAL",
      "Stored credential is malformed. Run eprospera auth login again.",
    );
  }

  return {
    kind: value.kind,
    token: value.token.trim(),
    refreshToken: optionalString(value.refreshToken),
    scopes: stringArray(value.scopes),
    expiresAt: optionalFiniteNumber(value.expiresAt),
    owner: optionalString(value.owner),
  };
}

function credentialError(code: string, message: string, cause?: unknown): ExitError {
  return new ExitError({
    code,
    message,
    exitCode: ExitCodes.Authentication,
    cause,
  });
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function optionalFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function isKeytarAdapter(value: unknown): value is KeytarAdapter {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.getPassword === "function" &&
    typeof value.setPassword === "function" &&
    typeof value.deletePassword === "function"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNodeError(value: unknown): value is NodeJS.ErrnoException {
  return value instanceof Error && "code" in value;
}

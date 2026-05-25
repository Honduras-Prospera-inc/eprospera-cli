import { ExitCodes, ExitError } from "../errors.js";
import { type CredentialStoreOptions, loadCredential } from "./store.js";
import type { CredentialKind, ResolvedCredential, StoredCredential } from "./types.js";

type LoadableCredential = StoredCredential & {
  source?: Extract<ResolvedCredential["source"], "keytar" | "file">;
};

export type ResolveCredentialOptions = {
  apiKey?: string;
  env?: NodeJS.ProcessEnv;
  now?: () => number;
  store?: CredentialStoreOptions;
  loadStoredCredential?: () => Promise<LoadableCredential | undefined>;
};

export async function resolveCredential(
  options: ResolveCredentialOptions = {},
): Promise<ResolvedCredential> {
  const env = options.env ?? process.env;
  const flagToken = normalizeToken(options.apiKey);
  if (flagToken) {
    return credentialFromToken(flagToken, "flag");
  }

  const envToken = normalizeToken(env.EPROSPERA_API_KEY);
  if (envToken) {
    return credentialFromToken(envToken, "env");
  }

  const stored = await loadStoredCredential(options);
  if (!stored) {
    throw new ExitError({
      code: "NO_CREDENTIAL",
      message:
        "No API credential configured. Pass --api-key, set EPROSPERA_API_KEY, or run eprospera auth login.",
      exitCode: ExitCodes.Authentication,
    });
  }

  if (isExpired(stored, options.now ?? Date.now)) {
    throw new ExitError({
      code: "EXPIRED_CREDENTIAL",
      message: "Stored credential has expired. Run eprospera auth login again.",
      exitCode: ExitCodes.Authentication,
    });
  }

  return {
    ...stored,
    source: stored.source ?? "keytar",
  };
}

export function inferCredentialKind(token: string): CredentialKind {
  if (token.startsWith("ak-")) {
    return "ak";
  }
  if (token.startsWith("sk-")) {
    return "sk";
  }
  return "sk";
}

function credentialFromToken(token: string, source: "flag" | "env"): ResolvedCredential {
  return {
    kind: inferCredentialKind(token),
    token,
    scopes: [],
    source,
  };
}

async function loadStoredCredential(
  options: ResolveCredentialOptions,
): Promise<LoadableCredential | undefined> {
  if (options.loadStoredCredential) {
    return options.loadStoredCredential();
  }

  return loadCredential(options.store);
}

function normalizeToken(value: string | undefined): string | undefined {
  const token = value?.trim();
  return token && token.length > 0 ? token : undefined;
}

function isExpired(credential: StoredCredential, now: () => number): boolean {
  return credential.expiresAt !== undefined && credential.expiresAt <= now();
}

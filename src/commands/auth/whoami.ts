import { createApiClient } from "../../api/client.js";
import { loadConfig } from "../../config/store.js";
import { resolveCredential } from "../../credentials/resolve.js";
import type {
  CredentialKind,
  CredentialSource,
  ResolvedCredential,
} from "../../credentials/types.js";
import { ExitError } from "../../errors.js";
import { print } from "../../output/format.js";
import {
  configStoreOptions,
  type GlobalOptions,
  outputOptions,
  type RuntimeDependencies,
  resolveRuntimeBaseUrl,
} from "../runtime.js";

export type WhoamiOptions = {
  verify?: boolean;
};

export async function runAuthWhoami(
  options: WhoamiOptions,
  globals: GlobalOptions,
  deps: RuntimeDependencies = {},
): Promise<void> {
  const env = deps.env ?? process.env;
  const credential = await resolveCredential({
    apiKey: globals.apiKey,
    env,
    store: configStoreOptions(deps),
    loadStoredCredential: deps.loadStoredCredential,
  });
  const output = {
    ...credentialSummary(credential),
    ...(options.verify ? { verification: await verifyCredential(credential, env, deps) } : {}),
  };

  print(output, outputOptions(globals, deps));
}

function credentialSummary(credential: ResolvedCredential): {
  kind: CredentialKind;
  source: CredentialSource;
  owner: string | null;
  scopes: readonly string[];
  cachedScopes: {
    known: boolean;
    source: "cached" | "unavailable" | "not-applicable";
  };
  expiresAt: number | null;
} {
  return {
    kind: credential.kind,
    source: credential.source,
    owner: credential.owner ?? null,
    scopes: credential.scopes,
    cachedScopes: cachedScopesSummary(credential),
    expiresAt: credential.expiresAt ?? null,
  };
}

function cachedScopesSummary(credential: ResolvedCredential): {
  known: boolean;
  source: "cached" | "unavailable" | "not-applicable";
} {
  if (credential.kind === "sk") {
    return { known: false, source: "not-applicable" };
  }

  if (
    credential.kind === "ak" &&
    credential.scopes.length === 0 &&
    (credential.source === "env" || credential.source === "flag")
  ) {
    return { known: false, source: "unavailable" };
  }

  return { known: true, source: "cached" };
}

async function verifyCredential(
  credential: ResolvedCredential,
  env: NodeJS.ProcessEnv,
  deps: RuntimeDependencies,
): Promise<
  | {
      status: "verified";
      endpoint: string;
      identity: unknown;
    }
  | {
      status: "unavailable";
      endpoint?: string;
      reason: string;
    }
> {
  if (credential.kind === "sk") {
    return {
      status: "unavailable",
      reason: "Standard API keys do not expose an owner identity endpoint.",
    };
  }

  const config = await loadConfig(configStoreOptions(deps));
  const api = createApiClient({
    baseUrl: resolveRuntimeBaseUrl(env, config),
    env,
    token: credential.token,
    fetch: deps.fetch,
    retry: deps.retry,
    idempotencyKey: deps.idempotencyKey,
  });

  if (credential.kind === "oauth") {
    const response = await api.raw.GET("/api/oauth/userinfo");
    return {
      status: "verified",
      endpoint: "GET /api/oauth/userinfo",
      identity: oauthIdentity(response.data ?? null),
    };
  }

  const endpoint = "GET /api/v1/me/natural-person";
  try {
    const response = await api.raw.GET("/api/v1/me/natural-person");
    return {
      status: "verified",
      endpoint,
      identity: naturalPersonIdentity(response.data ?? null),
    };
  } catch (error) {
    if (error instanceof ExitError && error.httpStatus === 403) {
      return {
        status: "unavailable",
        endpoint,
        reason:
          "The identity endpoint is not available for this Agent Key or scope set. The credential may still be valid for other authorized commands.",
      };
    }
    throw error;
  }
}

function oauthIdentity(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }

  return pickDefined(value, ["sub", "name", "email", "email_verified"]);
}

function naturalPersonIdentity(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }

  return pickDefined(value, ["name", "givenName", "surname", "residentPermitNumber"]);
}

function pickDefined(
  value: Record<string, unknown>,
  keys: readonly string[],
): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const key of keys) {
    if (value[key] !== undefined) {
      output[key] = value[key];
    }
  }
  return output;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

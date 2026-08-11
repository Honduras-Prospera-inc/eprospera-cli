import type { EProsperaApiClient } from "../../api/client.js";
import type {
  CredentialKind,
  CredentialSource,
  ResolvedCredential,
} from "../../credentials/types.js";
import { ExitError } from "../../errors.js";
import { print } from "../../output/format.js";
import { authenticatedContext, type GlobalOptions, type RuntimeDependencies } from "../runtime.js";

export type WhoamiOptions = {
  verify?: boolean;
};

export async function runAuthWhoami(
  options: WhoamiOptions,
  globals: GlobalOptions,
  deps: RuntimeDependencies = {},
): Promise<void> {
  const context = await authenticatedContext("auth.whoami", globals, deps);
  const credential = context.credential;
  const output = {
    ...credentialSummary(credential),
    ...(options.verify ? { verification: await verifyCredential(credential, context.api) } : {}),
  };

  print(output, context.output);
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
  api: EProsperaApiClient,
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

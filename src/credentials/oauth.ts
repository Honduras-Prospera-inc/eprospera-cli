import type { EProsperaApiClient } from "../api/client.js";
import type { components } from "../api/generated.js";
import { ExitCodes, ExitError } from "../errors.js";
import type { ResolvedCredential, StoredCredential } from "./types.js";

export const EPROSPERA_CLI_OAUTH_CLIENT_ID = "eprospera-cli";
export const OAUTH_DEVICE_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:device_code";
export const OAUTH_REFRESH_WINDOW_MS = 60_000;
export const DEFAULT_OAUTH_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "eprospera:person.details.read",
  "eprospera:person.residency.read",
  "eprospera:person.id_verification.read",
  "eprospera:entity.read",
  "eprospera:entity.documents.read",
  "eprospera:person.tax.read",
  "eprospera:entity.tax.read",
] as const;

export type DeviceAuthorization = components["schemas"]["OAuthDeviceAuthorizationResponse"];

type OAuthTokenResponse = components["schemas"]["OAuthTokenResponse"];

type OAuthTimingOptions = {
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

export async function startDeviceAuthorization(
  api: EProsperaApiClient,
  scopes: readonly string[],
): Promise<DeviceAuthorization> {
  const response = await api.raw.POST("/api/oauth/device_authorization", {
    headers: formHeaders(),
    body: {
      client_id: EPROSPERA_CLI_OAUTH_CLIENT_ID,
      scope: scopes.join(" "),
    },
  });

  if (!response.data) {
    throw oauthProtocolError("The device authorization response was empty.");
  }
  return response.data;
}

export async function pollDeviceAuthorization(
  api: EProsperaApiClient,
  authorization: DeviceAuthorization,
  fallbackScopes: readonly string[],
  options: OAuthTimingOptions = {},
): Promise<StoredCredential> {
  const now = options.now ?? Date.now;
  const wait = options.sleep ?? sleep;
  const expiresAt = now() + authorization.expires_in * 1_000;
  let intervalMs = Math.max(1, authorization.interval) * 1_000;

  while (now() < expiresAt) {
    await wait(intervalMs);
    if (now() >= expiresAt) {
      break;
    }

    try {
      const response = await api.raw.POST("/api/oauth/token", {
        headers: formHeaders(),
        body: {
          grant_type: OAUTH_DEVICE_GRANT_TYPE,
          device_code: authorization.device_code,
          client_id: EPROSPERA_CLI_OAUTH_CLIENT_ID,
        },
      });
      if (!response.data) {
        throw oauthProtocolError("The OAuth token response was empty.");
      }
      return credentialFromTokenResponse(response.data, fallbackScopes, now);
    } catch (error) {
      if (error instanceof ExitError && error.code === "authorization_pending") {
        continue;
      }
      if (error instanceof ExitError && error.code === "slow_down") {
        intervalMs += 5_000;
        continue;
      }
      if (error instanceof ExitError && error.code === "access_denied") {
        throw new ExitError({
          code: "OAUTH_ACCESS_DENIED",
          message: "OAuth authorization was denied in the browser.",
          exitCode: ExitCodes.Authentication,
          cause: error,
        });
      }
      if (error instanceof ExitError && error.code === "expired_token") {
        throw oauthExpiredError(error);
      }
      throw error;
    }
  }

  throw oauthExpiredError();
}

export function shouldRefreshOAuthCredential(
  credential: ResolvedCredential,
  now: () => number = Date.now,
): boolean {
  return (
    credential.kind === "oauth" &&
    credential.expiresAt !== undefined &&
    credential.expiresAt <= now() + OAUTH_REFRESH_WINDOW_MS
  );
}

export async function refreshOAuthCredential(
  api: EProsperaApiClient,
  credential: ResolvedCredential,
  options: Pick<OAuthTimingOptions, "now"> = {},
): Promise<ResolvedCredential> {
  if (credential.kind !== "oauth" || !credential.refreshToken) {
    throw new ExitError({
      code: "OAUTH_REFRESH_UNAVAILABLE",
      message: "The OAuth session cannot be refreshed. Run eprospera auth login --oauth again.",
      exitCode: ExitCodes.Authentication,
    });
  }

  try {
    const response = await api.raw.POST("/api/oauth/token", {
      headers: formHeaders(),
      body: {
        grant_type: "refresh_token",
        refresh_token: credential.refreshToken,
        client_id: credential.clientId ?? EPROSPERA_CLI_OAUTH_CLIENT_ID,
      },
    });
    if (!response.data) {
      throw oauthProtocolError("The OAuth refresh response was empty.");
    }

    return {
      ...credentialFromTokenResponse(response.data, credential.scopes, options.now ?? Date.now),
      refreshToken: response.data.refresh_token ?? credential.refreshToken,
      owner: credential.owner,
      source: credential.source,
    };
  } catch (error) {
    if (
      error instanceof ExitError &&
      (error.code === "invalid_grant" || error.code === "invalid_client")
    ) {
      throw new ExitError({
        code: "OAUTH_REFRESH_FAILED",
        message: "The OAuth session has expired or was revoked. Run eprospera auth login --oauth.",
        exitCode: ExitCodes.Authentication,
        cause: error,
      });
    }
    throw error;
  }
}

export async function revokeOAuthCredential(
  api: EProsperaApiClient,
  credential: StoredCredential,
): Promise<void> {
  const clientId = credential.clientId ?? EPROSPERA_CLI_OAUTH_CLIENT_ID;
  const tokens = [
    credential.refreshToken
      ? { token: credential.refreshToken, tokenType: "refresh_token" as const }
      : undefined,
    { token: credential.token, tokenType: "access_token" as const },
  ].filter((value): value is { token: string; tokenType: "access_token" | "refresh_token" } =>
    Boolean(value),
  );

  const results = await Promise.allSettled(
    tokens.map(({ token, tokenType }) =>
      api.raw.POST("/api/oauth/revoke", {
        headers: formHeaders(),
        body: {
          token,
          token_type_hint: tokenType,
          client_id: clientId,
        },
      }),
    ),
  );
  const failure = results.find(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  if (failure) {
    throw failure.reason;
  }
}

function credentialFromTokenResponse(
  response: OAuthTokenResponse,
  fallbackScopes: readonly string[],
  now: () => number,
): StoredCredential {
  return {
    kind: "oauth",
    token: response.access_token,
    clientId: EPROSPERA_CLI_OAUTH_CLIENT_ID,
    refreshToken: response.refresh_token,
    scopes: response.scope ? parseScopes(response.scope) : [...fallbackScopes],
    expiresAt: now() + response.expires_in * 1_000,
  };
}

function parseScopes(value: string): string[] {
  return [...new Set(value.split(/\s+/).filter(Boolean))];
}

function formHeaders(): { "Content-Type": string } {
  return { "Content-Type": "application/x-www-form-urlencoded" };
}

function oauthProtocolError(message: string): ExitError {
  return new ExitError({
    code: "INVALID_OAUTH_RESPONSE",
    message,
    exitCode: ExitCodes.Authentication,
  });
}

function oauthExpiredError(cause?: unknown): ExitError {
  return new ExitError({
    code: "OAUTH_DEVICE_CODE_EXPIRED",
    message: "OAuth authorization expired before it was completed. Run the login command again.",
    exitCode: ExitCodes.Timeout,
    cause,
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

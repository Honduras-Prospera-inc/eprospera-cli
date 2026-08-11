import type { CredentialKind, CredentialSource } from "../credentials/types.js";
import { ExitCodes, ExitError } from "../errors.js";
import { getCommandScope } from "./map.js";

export const SCOPE_REFERENCE_URL = "https://docs.eprospera.com/agent-keys.html#scope-reference";

export type ScopeCredential = {
  kind: CredentialKind;
  scopes: readonly string[];
  source?: CredentialSource;
};

export type ScopeCheckOptions = {
  skipScopeCheck?: boolean;
};

export type ScopeCheckResult = { ok: true } | { ok: false; missing: string };

export function checkCommandScope(
  commandId: string,
  credential: ScopeCredential | undefined,
  options: ScopeCheckOptions = {},
): ScopeCheckResult {
  const requirement = getCommandScope(commandId);
  if (!requirement || !requiresCredential(requirement)) {
    return { ok: true };
  }

  if (!credential) {
    throw new ExitError({
      code: "NO_CREDENTIAL",
      message: "No API credential configured.",
      exitCode: ExitCodes.Authentication,
    });
  }

  if (requirement.credentialTypes && !requirement.credentialTypes.includes(credential.kind)) {
    throw new ExitError({
      code: "UNSUPPORTED_CREDENTIAL_TYPE",
      message: `Command ${commandId} does not support ${credential.kind} credentials.`,
      exitCode: ExitCodes.Authorization,
      details: {
        command: commandId,
        credentialKind: credential.kind,
        allowedCredentialTypes: requirement.credentialTypes,
      },
    });
  }

  if (options.skipScopeCheck) {
    return { ok: true };
  }

  if (hasUncachedOneOffAgentKeyScopes(credential)) {
    return { ok: true };
  }

  const requiredScopes = requiredScopesForCredential(credential.kind, requirement);
  if (
    requiredScopes.length > 0 &&
    !requiredScopes.some((scope) => credential.scopes.includes(scope))
  ) {
    return { ok: false, missing: requiredScopes.join(" or ") };
  }

  return { ok: true };
}

function hasUncachedOneOffAgentKeyScopes(credential: ScopeCredential): boolean {
  return (
    credential.kind === "ak" &&
    credential.scopes.length === 0 &&
    (credential.source === "flag" || credential.source === "env")
  );
}

export function assertCommandScope(
  commandId: string,
  credential: ScopeCredential | undefined,
  options: ScopeCheckOptions = {},
): void {
  const result = checkCommandScope(commandId, credential, options);
  if (!result.ok) {
    throw new ExitError({
      code: "MISSING_SCOPE",
      message: `Credential is missing required scope ${result.missing}. See ${SCOPE_REFERENCE_URL}.`,
      exitCode: ExitCodes.Authorization,
      details: {
        command: commandId,
        missing: result.missing,
        scopeReference: SCOPE_REFERENCE_URL,
      },
    });
  }
}

function requiresCredential(requirement: {
  requiredScope?: string;
  oauthScope?: string;
  oauthScopes?: readonly string[];
  credentialTypes?: readonly CredentialKind[];
}): boolean {
  return Boolean(
    requirement.requiredScope ||
      requirement.oauthScope ||
      requirement.oauthScopes?.length ||
      requirement.credentialTypes?.length,
  );
}

function requiredScopesForCredential(
  kind: CredentialKind,
  requirement: {
    requiredScope?: string;
    oauthScope?: string;
    oauthScopes?: readonly string[];
  },
): readonly string[] {
  if (kind === "ak") {
    return requirement.requiredScope ? [requirement.requiredScope] : [];
  }
  if (kind === "oauth") {
    if (requirement.oauthScopes) {
      return requirement.oauthScopes;
    }
    return requirement.oauthScope ? [requirement.oauthScope] : [];
  }
  return [];
}

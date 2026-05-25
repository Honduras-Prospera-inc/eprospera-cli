import type { CredentialKind } from "../credentials/types.js";
import { ExitCodes, ExitError } from "../errors.js";
import { getCommandScope } from "./map.js";

export const SCOPE_REFERENCE_URL = "https://docs.eprospera.com/agent-keys.html#scope-reference";

export type ScopeCredential = {
  kind: CredentialKind;
  scopes: readonly string[];
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

  const requiredScope = requiredScopeForCredential(credential.kind, requirement);
  if (requiredScope && !credential.scopes.includes(requiredScope)) {
    return { ok: false, missing: requiredScope };
  }

  return { ok: true };
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
  credentialTypes?: readonly CredentialKind[];
}): boolean {
  return Boolean(
    requirement.requiredScope || requirement.oauthScope || requirement.credentialTypes?.length,
  );
}

function requiredScopeForCredential(
  kind: CredentialKind,
  requirement: {
    requiredScope?: string;
    oauthScope?: string;
  },
): string | undefined {
  if (kind === "ak") {
    return requirement.requiredScope;
  }
  if (kind === "oauth") {
    return requirement.oauthScope;
  }
  return undefined;
}

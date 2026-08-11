import { revokeOAuthCredential } from "../../credentials/oauth.js";
import { deleteCredential, loadCredential } from "../../credentials/store.js";
import type { StoredCredential } from "../../credentials/types.js";
import { print } from "../../output/format.js";
import { confirmAction } from "../../prompts/confirm.js";
import {
  configStoreOptions,
  type GlobalOptions,
  outputOptions,
  type RuntimeDependencies,
  unauthenticatedContext,
} from "../runtime.js";

export async function runAuthLogout(
  globals: GlobalOptions,
  deps: RuntimeDependencies = {},
): Promise<void> {
  let credential: StoredCredential | undefined;
  try {
    credential =
      (await deps.loadStoredCredential?.()) ?? (await loadCredential(configStoreOptions(deps)));
  } catch {
    if (!globals.quiet) {
      (deps.streams?.stderr ?? process.stderr).write(
        "Warning: Stored credential metadata could not be read; local cleanup will still be attempted.\n",
      );
    }
  }
  const isOAuth = credential?.kind === "oauth";
  const confirmed = await confirmAction(
    isOAuth
      ? "Revoke the OAuth session and delete locally stored credentials?"
      : "Delete locally stored credentials?",
    globals,
    deps,
  );
  if (!confirmed) {
    print({ deleted: false }, outputOptions(globals, deps));
    return;
  }

  let remoteRevoked = false;
  if (isOAuth && credential) {
    try {
      const context = await unauthenticatedContext(globals, deps);
      await revokeOAuthCredential(context.api, credential);
      remoteRevoked = true;
    } catch {
      if (!globals.quiet) {
        (deps.streams?.stderr ?? process.stderr).write(
          "Warning: The remote OAuth session could not be revoked; local credentials will still be deleted.\n",
        );
      }
    }
  }

  const deleted =
    (await deps.deleteStoredCredential?.()) ?? (await deleteCredential(configStoreOptions(deps)));
  print({ deleted, ...(isOAuth ? { remoteRevoked } : {}) }, outputOptions(globals, deps));
}

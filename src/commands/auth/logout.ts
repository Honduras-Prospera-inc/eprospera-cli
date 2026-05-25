import { deleteCredential } from "../../credentials/store.js";
import { print } from "../../output/format.js";
import { confirmAction } from "../../prompts/confirm.js";
import {
  configStoreOptions,
  type GlobalOptions,
  outputOptions,
  type RuntimeDependencies,
} from "../runtime.js";

export async function runAuthLogout(
  globals: GlobalOptions,
  deps: RuntimeDependencies = {},
): Promise<void> {
  const confirmed = await confirmAction("Delete locally stored credentials?", globals, deps);
  if (!confirmed) {
    print({ deleted: false }, outputOptions(globals, deps));
    return;
  }

  const deleted =
    (await deps.deleteStoredCredential?.()) ?? (await deleteCredential(configStoreOptions(deps)));
  print({ deleted }, outputOptions(globals, deps));
}

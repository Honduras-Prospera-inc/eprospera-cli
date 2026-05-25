import { resolveCredential } from "../../credentials/resolve.js";
import { print } from "../../output/format.js";
import {
  configStoreOptions,
  type GlobalOptions,
  outputOptions,
  type RuntimeDependencies,
} from "../runtime.js";

export async function runAuthWhoami(
  globals: GlobalOptions,
  deps: RuntimeDependencies = {},
): Promise<void> {
  const credential = await resolveCredential({
    apiKey: globals.apiKey,
    env: deps.env ?? process.env,
    store: configStoreOptions(deps),
    loadStoredCredential: deps.loadStoredCredential,
  });

  print(
    {
      kind: credential.kind,
      source: credential.source,
      owner: credential.owner ?? null,
      scopes: credential.scopes,
      expiresAt: credential.expiresAt ?? null,
    },
    outputOptions(globals, deps),
  );
}

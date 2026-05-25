import { loadConfig } from "../../config/store.js";
import { print } from "../../output/format.js";
import {
  configStoreOptions,
  type GlobalOptions,
  outputOptions,
  type RuntimeDependencies,
} from "../runtime.js";

export async function runConfigList(
  globals: GlobalOptions,
  deps: RuntimeDependencies = {},
): Promise<void> {
  print(await loadConfig(configStoreOptions(deps)), outputOptions(globals, deps));
}

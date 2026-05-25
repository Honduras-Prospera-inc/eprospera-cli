import { assertConfigKey, loadConfig } from "../../config/store.js";
import { print } from "../../output/format.js";
import {
  configStoreOptions,
  type GlobalOptions,
  outputOptions,
  type RuntimeDependencies,
} from "../runtime.js";

export async function runConfigGet(
  key: string,
  globals: GlobalOptions,
  deps: RuntimeDependencies = {},
): Promise<void> {
  const configKey = assertConfigKey(key);
  const config = await loadConfig(configStoreOptions(deps));
  print({ key: configKey, value: config[configKey] ?? null }, outputOptions(globals, deps));
}

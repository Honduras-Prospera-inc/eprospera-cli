import { assertConfigKey, unsetConfigValue } from "../../config/store.js";
import { print } from "../../output/format.js";
import {
  configStoreOptions,
  type GlobalOptions,
  outputOptions,
  type RuntimeDependencies,
} from "../runtime.js";

export async function runConfigUnset(
  key: string,
  globals: GlobalOptions,
  deps: RuntimeDependencies = {},
): Promise<void> {
  const configKey = assertConfigKey(key);
  const deleted = await unsetConfigValue(configKey, configStoreOptions(deps));
  print({ key: configKey, deleted }, outputOptions(globals, deps));
}

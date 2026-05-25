import { assertConfigKey, setConfigValue } from "../../config/store.js";
import { print } from "../../output/format.js";
import {
  configStoreOptions,
  type GlobalOptions,
  nonEmptyStringSchema,
  outputOptions,
  parseInput,
  type RuntimeDependencies,
} from "../runtime.js";

export async function runConfigSet(
  key: string,
  value: string,
  globals: GlobalOptions,
  deps: RuntimeDependencies = {},
): Promise<void> {
  const configKey = assertConfigKey(key);
  const config = await setConfigValue(
    configKey,
    parseInput(nonEmptyStringSchema, value),
    configStoreOptions(deps),
  );
  print({ key: configKey, value: config[configKey] ?? null }, outputOptions(globals, deps));
}

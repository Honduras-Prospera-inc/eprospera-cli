import { parse } from "yaml";
import { print } from "../output/format.js";
import { readPackageFile } from "./files.js";
import { type GlobalOptions, outputOptions, type RuntimeDependencies } from "./runtime.js";

export async function runSchema(
  globals: GlobalOptions,
  deps: RuntimeDependencies = {},
): Promise<void> {
  const source = await readPackageFile("cli.ocs.yaml", import.meta.url);
  if (globals.json || globals.raw) {
    print(parse(source), outputOptions(globals, deps));
    return;
  }

  (deps.streams?.stdout ?? process.stdout).write(source.endsWith("\n") ? source : `${source}\n`);
}

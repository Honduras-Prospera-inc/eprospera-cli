import { confirm } from "@inquirer/prompts";
import type { GlobalOptions, RuntimeDependencies } from "../commands/runtime.js";
import { terminalCapabilities } from "../output/tty.js";

export async function confirmAction(
  message: string,
  globals: GlobalOptions,
  deps: RuntimeDependencies = {},
): Promise<boolean> {
  if (globals.yes) {
    return true;
  }

  const capabilities = terminalCapabilities(
    {
      json: globals.json,
      raw: globals.raw,
      noAutoJson: globals.autoJson === false,
      quiet: globals.quiet,
      env: deps.env,
    },
    deps.streams,
  );

  if (!capabilities.interactive) {
    return true;
  }

  return deps.promptConfirm?.(message) ?? confirm({ message, default: false });
}

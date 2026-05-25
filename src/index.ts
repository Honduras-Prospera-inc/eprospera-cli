import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Command, CommanderError } from "commander";
import { runApplicationCreate } from "./commands/application/create.js";
import { runApplicationGet } from "./commands/application/get.js";
import { runApplicationList } from "./commands/application/list.js";
import { runApplicationPay } from "./commands/application/pay.js";
import { runApplicationWatch } from "./commands/application/watch.js";
import { runAuthLogin } from "./commands/auth/login.js";
import { runAuthLogout } from "./commands/auth/logout.js";
import { runAuthWhoami } from "./commands/auth/whoami.js";
import { runCompletion } from "./commands/completion.js";
import { runConfigGet } from "./commands/config/get.js";
import { runConfigList } from "./commands/config/list.js";
import { runConfigSet } from "./commands/config/set.js";
import { runConfigUnset } from "./commands/config/unset.js";
import { runEntityDocuments } from "./commands/entity/documents.js";
import { runEntityGet } from "./commands/entity/get.js";
import { runEntitySearch } from "./commands/entity/search.js";
import { runEntityVerify } from "./commands/entity/verify.js";
import { runMeIdVerification } from "./commands/me/id-verification.js";
import { runMeProfile } from "./commands/me/profile.js";
import { runMeResidency } from "./commands/me/residency.js";
import type { GlobalOptions, RuntimeDependencies } from "./commands/runtime.js";
import { runSchema } from "./commands/schema.js";
import { ExitCodes, ExitError } from "./errors.js";
import { printError } from "./output/format.js";
import { VERSION } from "./version.js";

export function createProgram(deps: RuntimeDependencies = {}): Command {
  const program = new Command();
  const stdout = deps.streams?.stdout ?? process.stdout;
  const stderr = deps.streams?.stderr ?? process.stderr;

  program
    .name("eprospera")
    .description("Command-line wrapper over the e-Prospera public API.")
    .version(VERSION)
    .showHelpAfterError()
    .exitOverride()
    .configureOutput({
      writeOut: (value) => stdout.write(value),
      writeErr: (value) => stderr.write(value),
    })
    .option("--json", "Pretty-print JSON to stdout and suppress incidental output.")
    .option("--raw", "Print compact single-line JSON to stdout.")
    .option("--fields <keys>", "Restrict output keys for read commands.")
    .option("--quiet", "Suppress incidental human output.")
    .option("-y, --yes", "Skip confirmation prompts.")
    .option(
      "--api-key <value>",
      "Use this bearer token instead of environment or stored credentials.",
    )
    .option("--dry-run", "Validate locally and print the request that would be sent.")
    .option("--no-auto-json", "Disable automatic JSON output when stdout is not a TTY.")
    .option("--skip-scope-check", "Skip cached local Agent Key scope preflight.");

  const entity = program
    .command("entity")
    .description("Verify, search, inspect, and fetch documents.");
  entity
    .command("verify")
    .argument("<rpn>")
    .action(function (this: Command, rpn: string) {
      return runApplicationSafe(() => runEntityVerify(rpn, globals(this), deps));
    });
  entity
    .command("search")
    .argument("<query>")
    .action(function (this: Command, query: string) {
      return runApplicationSafe(() => runEntitySearch(query, globals(this), deps));
    });
  entity
    .command("get")
    .argument("<id>")
    .action(function (this: Command, id: string) {
      return runApplicationSafe(() => runEntityGet(id, globals(this), deps));
    });
  entity
    .command("documents")
    .argument("<id>")
    .action(function (this: Command, id: string) {
      return runApplicationSafe(() => runEntityDocuments(id, globals(this), deps));
    });

  const application = program
    .command("application")
    .description("Create, pay, list, inspect, and watch applications.");
  application.command("list").action(function (this: Command) {
    return runApplicationSafe(() => runApplicationList(globals(this), deps));
  });
  application
    .command("create")
    .requiredOption("--file <path>", "Read the application request body from a JSON file.")
    .action(function (this: Command) {
      return runApplicationSafe(() => runApplicationCreate(this.opts(), globals(this), deps));
    });
  application
    .command("get")
    .argument("<id>")
    .action(function (this: Command, id: string) {
      return runApplicationSafe(() => runApplicationGet(id, globals(this), deps));
    });
  application
    .command("pay")
    .argument("<id>")
    .requiredOption("--coupon <code>", "Coupon code to apply.")
    .action(function (this: Command, id: string) {
      return runApplicationSafe(() => runApplicationPay(id, this.opts(), globals(this), deps));
    });
  application
    .command("watch")
    .argument("<id>")
    .option("--timeout <duration>", "Hard polling timeout.")
    .option("--initial-interval <duration>", "Polling interval before backoff.")
    .option("--max-interval <duration>", "Maximum polling interval after backoff.")
    .action(function (this: Command, id: string) {
      return runApplicationSafe(() => runApplicationWatch(id, this.opts(), globals(this), deps));
    });

  const me = program.command("me").description("Read profile data for the credential owner.");
  me.command("profile").action(function (this: Command) {
    return runApplicationSafe(() => runMeProfile(globals(this), deps));
  });
  me.command("residency").action(function (this: Command) {
    return runApplicationSafe(() => runMeResidency(globals(this), deps));
  });
  me.command("id-verification").action(function (this: Command) {
    return runApplicationSafe(() => runMeIdVerification(globals(this), deps));
  });

  const auth = program
    .command("auth")
    .description("Log in, inspect, and remove local credentials.");
  auth
    .command("login")
    .option("--agent-key", "Prompt for an ak- Agent Key and validate it.")
    .option("--standard-key", "Prompt for an sk- standard API key.")
    .option("--scopes <csv>", "Comma-separated Agent Key scopes to cache.")
    .action(function (this: Command) {
      return runApplicationSafe(() => runAuthLogin(this.opts(), globals(this), deps));
    });
  auth.command("whoami").action(function (this: Command) {
    return runApplicationSafe(() => runAuthWhoami(globals(this), deps));
  });
  auth.command("logout").action(function (this: Command) {
    return runApplicationSafe(() => runAuthLogout(globals(this), deps));
  });

  const config = program.command("config").description("Read and write local CLI configuration.");
  config
    .command("get")
    .argument("<key>")
    .action(function (this: Command, key: string) {
      return runApplicationSafe(() => runConfigGet(key, globals(this), deps));
    });
  config
    .command("set")
    .argument("<key>")
    .argument("<value>")
    .action(function (this: Command, key: string, value: string) {
      return runApplicationSafe(() => runConfigSet(key, value, globals(this), deps));
    });
  config.command("list").action(function (this: Command) {
    return runApplicationSafe(() => runConfigList(globals(this), deps));
  });
  config
    .command("unset")
    .argument("<key>")
    .action(function (this: Command, key: string) {
      return runApplicationSafe(() => runConfigUnset(key, globals(this), deps));
    });

  const completion = program
    .command("completion")
    .description("Generate shell completion scripts.");
  for (const shell of ["bash", "zsh", "fish"] as const) {
    completion.command(shell).action(function (this: Command) {
      return runApplicationSafe(() => runCompletion(shell, globals(this), deps));
    });
  }
  completion.command("powershell").action(function (this: Command) {
    return runApplicationSafe(() => runCompletion("powershell", globals(this), deps));
  });

  program
    .command("schema")
    .description("Print this OpenCLI document to stdout.")
    .action(function (this: Command) {
      return runApplicationSafe(() => runSchema(globals(this), deps));
    });

  return program;
}

export async function runCli(
  argv: readonly string[] = process.argv,
  deps: RuntimeDependencies = {},
): Promise<number> {
  const program = createProgram(deps);

  try {
    await program.parseAsync([...argv], { from: "node" });
    return ExitCodes.Success;
  } catch (error) {
    if (error instanceof CommanderError && error.exitCode === ExitCodes.Success) {
      return ExitCodes.Success;
    }

    const globalsFromArgv = argvGlobals(argv);
    if (error instanceof CommanderError) {
      const result = printError(
        new ExitError({
          code: "INVALID_USAGE",
          message: error.message,
          exitCode: ExitCodes.Usage,
          cause: error,
        }),
        {
          json: globalsFromArgv.json,
          raw: globalsFromArgv.raw,
          noAutoJson: globalsFromArgv.autoJson === false,
          streams: deps.streams,
          env: deps.env,
        },
      );
      return result.exitCode;
    }

    const result = printError(error, {
      json: globalsFromArgv.json,
      raw: globalsFromArgv.raw,
      noAutoJson: globalsFromArgv.autoJson === false,
      streams: deps.streams,
      env: deps.env,
    });
    return result.exitCode;
  }
}

function globals(command: Command): GlobalOptions {
  const opts = command.optsWithGlobals<{
    json?: boolean;
    raw?: boolean;
    fields?: string;
    quiet?: boolean;
    yes?: boolean;
    apiKey?: string;
    dryRun?: boolean;
    autoJson?: boolean;
    skipScopeCheck?: boolean;
  }>();

  return {
    json: opts.json,
    raw: opts.raw,
    fields: opts.fields,
    quiet: opts.quiet,
    yes: opts.yes,
    apiKey: opts.apiKey,
    dryRun: opts.dryRun,
    autoJson: opts.autoJson,
    skipScopeCheck: opts.skipScopeCheck,
  };
}

function argvGlobals(argv: readonly string[]): GlobalOptions {
  return {
    json: argv.includes("--json"),
    raw: argv.includes("--raw"),
    autoJson: argv.includes("--no-auto-json") ? false : undefined,
  };
}

async function runApplicationSafe(action: () => Promise<void>): Promise<void> {
  await action();
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = await runCli();
}

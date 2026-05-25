export type OutputMode = "human" | "json" | "raw";

export type OutputModeOptions = {
  json?: boolean;
  raw?: boolean;
  noAutoJson?: boolean;
};

export type TerminalCapabilityOptions = OutputModeOptions & {
  mode?: OutputMode;
  quiet?: boolean;
  env?: NodeJS.ProcessEnv;
};

export type TerminalLike = {
  isTTY?: boolean;
};

export type TerminalStreams = {
  stdin?: TerminalLike;
  stdout?: TerminalLike;
  stderr?: TerminalLike;
};

export type TerminalCapabilities = {
  color: boolean;
  spinner: boolean;
  interactive: boolean;
};

export function resolveOutputMode(
  options: OutputModeOptions = {},
  streams: TerminalStreams = {},
): OutputMode {
  if (options.raw) {
    return "raw";
  }
  if (options.json) {
    return "json";
  }

  const stdout = streams.stdout ?? process.stdout;
  if (!options.noAutoJson && !isTty(stdout)) {
    return "json";
  }

  return "human";
}

export function terminalCapabilities(
  options: TerminalCapabilityOptions = {},
  streams: TerminalStreams = {},
): TerminalCapabilities {
  const mode = options.mode ?? resolveOutputMode(options, streams);
  const stdout = streams.stdout ?? process.stdout;
  const stderr = streams.stderr ?? process.stderr;
  const stdin = streams.stdin ?? process.stdin;
  const env = options.env ?? process.env;
  const machineMode = mode !== "human";
  const quiet = options.quiet ?? false;
  const decorationsAllowed = !machineMode && !quiet && isTty(stdout);
  const noColor = isSet(env.NO_COLOR);
  const forceColor = isEnabled(env.FORCE_COLOR);
  const ci = isEnabled(env.CI);

  return {
    color: decorationsAllowed && !noColor && (!ci || forceColor),
    spinner: decorationsAllowed && isTty(stderr) && !ci,
    interactive: !machineMode && !quiet && isTty(stdin),
  };
}

function isTty(stream: TerminalLike): boolean {
  return stream.isTTY === true;
}

function isSet(value: string | undefined): boolean {
  return value !== undefined && value !== "";
}

function isEnabled(value: string | undefined): boolean {
  return value !== undefined && value !== "" && value !== "0" && value.toLowerCase() !== "false";
}

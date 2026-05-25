import { ExitCodes, ExitError } from "../../errors.js";
import { print } from "../../output/format.js";
import { resolveOutputMode } from "../../output/tty.js";
import { parseDurationMs, watchApplication } from "../../polling/watch.js";
import {
  authenticatedContext,
  type GlobalOptions,
  parseInput,
  type RuntimeDependencies,
  uuidSchema,
} from "../runtime.js";

const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000;
const DEFAULT_INITIAL_INTERVAL_MS = 30 * 1000;
const DEFAULT_MAX_INTERVAL_MS = 5 * 60 * 1000;

export type WatchApplicationOptions = {
  timeout?: string;
  initialInterval?: string;
  maxInterval?: string;
};

export async function runApplicationWatch(
  id: string,
  options: WatchApplicationOptions,
  globals: GlobalOptions,
  deps: RuntimeDependencies = {},
): Promise<void> {
  const applicationId = parseInput(uuidSchema, id);
  const context = await authenticatedContext("application.watch", globals, deps);
  const mode = resolveOutputMode(context.output, deps.streams);
  const stdout = deps.streams?.stdout ?? process.stdout;

  const result = await watchApplication(
    async () => {
      const response = await context.api.raw.GET("/api/v1/legal_entity_applications/{id}", {
        params: { path: { id: applicationId } },
      });
      return response.data?.data ?? {};
    },
    {
      timeoutMs: parseDurationMs(options.timeout, DEFAULT_TIMEOUT_MS),
      initialIntervalMs: parseDurationMs(options.initialInterval, DEFAULT_INITIAL_INTERVAL_MS),
      maxIntervalMs: parseDurationMs(options.maxInterval, DEFAULT_MAX_INTERVAL_MS),
      now: deps.now,
      sleep: deps.sleep,
      onTransition: (application) => {
        if (mode === "json" || mode === "raw") {
          stdout.write(`${JSON.stringify({ data: application })}\n`);
          return;
        }
        print({ data: application }, { ...context.output, table: "applications" });
      },
    },
  );

  if (result.terminal !== "approved") {
    throw new ExitError({
      code: "WATCH_FAILED",
      message: "Application watch ended unexpectedly.",
      exitCode: ExitCodes.Generic,
      details: result,
    });
  }
}

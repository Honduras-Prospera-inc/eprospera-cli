import { describe, expect, it } from "vitest";
import { runCli } from "../../src/index.js";

const runE2E = process.env.EPROSPERA_E2E === "1" && Boolean(process.env.EPROSPERA_API_KEY);

describe.skipIf(!runE2E)("staging read-only commands", () => {
  it("runs me profile against the configured API", async () => {
    const exitCode = await runCli(["node", "eprospera", "--json", "me", "profile"], {
      env: {
        ...process.env,
        EPROSPERA_ENV: process.env.EPROSPERA_BASE_URL ? process.env.EPROSPERA_ENV : "staging",
      },
    });

    expect(exitCode).toBe(0);
  });
});

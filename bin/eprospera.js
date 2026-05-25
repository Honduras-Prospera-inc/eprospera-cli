#!/usr/bin/env node
const { runCli } = await import("../dist/src/index.js");
process.exitCode = await runCli();

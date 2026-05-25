import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const input = process.env.EPROSPERA_OPENAPI_URL ?? "https://docs.eprospera.com/openapi.yaml";
const output = "src/api/generated.ts";

await mkdir(dirname(output), { recursive: true });
await run("pnpm", ["exec", "openapi-typescript", input, "-o", output]);
await run("pnpm", ["exec", "biome", "format", "--write", output]);

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

import { spawn } from "node:child_process";
import { chmod, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

const outDir = "dist/bundle";
const nccOutput = join(outDir, "index.js");
const nccPackageMarker = join(outDir, "package.json");
const executable = join(outDir, "eprospera.mjs");

await rm(outDir, { recursive: true, force: true });
await run("pnpm", [
  "exec",
  "ncc",
  "build",
  "dist/src/index.js",
  "-o",
  outDir,
  "--target",
  "es2022",
  "--no-cache",
  "--quiet",
]);

const emitted = await listFiles(outDir);
const extraFiles = emitted.filter((file) => !["index.js", "package.json"].includes(file));
if (extraFiles.length > 0) {
  throw new Error(`Expected a single-file bundle, but ncc emitted: ${extraFiles.join(", ")}`);
}

const packageJson = JSON.parse(await readFile("package.json", "utf8")) as { version: string };
const source = (await readFile(nccOutput, "utf8")).replaceAll(
  "__EPROSPERA_CLI_VERSION__",
  packageJson.version,
);
await writeFile(executable, source.startsWith("#!") ? source : `#!/usr/bin/env node\n${source}`, {
  mode: 0o755,
});
await chmod(executable, 0o755);
await rm(nccOutput);
await rm(nccPackageMarker, { force: true });

console.log(`Wrote ${executable}`);

async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        return listFiles(path);
      }
      return [relative(outDir, path)];
    }),
  );

  return files.flat();
}

function run(command: string, args: readonly string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...args], { stdio: "inherit" });
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

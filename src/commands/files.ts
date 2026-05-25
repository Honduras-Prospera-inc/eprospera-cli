import { access, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export async function findPackageRoot(fromUrl: string = import.meta.url): Promise<string> {
  let current = dirname(fileURLToPath(fromUrl));

  for (;;) {
    try {
      await access(join(current, "package.json"));
      await access(join(current, "cli.ocs.yaml"));
      return current;
    } catch {
      const parent = dirname(current);
      if (parent === current) {
        return process.cwd();
      }
      current = parent;
    }
  }
}

export async function readPackageFile(
  path: string,
  fromUrl: string = import.meta.url,
): Promise<string> {
  return readFile(join(await findPackageRoot(fromUrl), path), "utf8");
}

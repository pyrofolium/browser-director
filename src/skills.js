import { readFile, mkdir, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
const hash = (x) => createHash("sha256").update(x).digest("hex");
async function files(dir, prefix = "") {
  const result = [];
  for (const entry of await readdir(join(dir, prefix), {
    withFileTypes: true,
  })) {
    const name = join(prefix, entry.name);
    if (entry.isDirectory()) result.push(...(await files(dir, name)));
    else if (entry.isFile()) result.push(name);
  }
  return result;
}
export async function installSkill(source, dest, { force = false } = {}) {
  const names = await files(source);
  const contents = new Map();
  let old = {};
  try {
    old = JSON.parse(
      await readFile(join(dest, ".browser-director-install.json"), "utf8"),
    );
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  // Check every file before writing any: a refusal never leaves a partial update.
  for (const name of names) {
    const data = await readFile(join(source, name));
    contents.set(name, data);
    try {
      const existing = await readFile(join(dest, name));
      if (
        !force &&
        hash(existing) !== hash(data) &&
        old[name] !== hash(existing)
      )
        throw new Error(
          `Edited skill file: ${join(dest, name)}. Back it up or use --force.`,
        );
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
  }
  const hashes = {};
  for (const [name, data] of contents) {
    await mkdir(join(dest, name, ".."), { recursive: true });
    await writeFile(join(dest, name), data);
    hashes[name] = hash(data);
  }
  await writeFile(
    join(dest, ".browser-director-install.json"),
    JSON.stringify(hashes, null, 2) + "\n",
  );
  return dest;
}

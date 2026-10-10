import { readFile, writeFile, access, unlink } from "node:fs/promises";
import { resolve, dirname, join } from "node:path";
import { spawn } from "node:child_process";
import { expression } from "./camera.js";
import { run } from "./process.js";

export async function syncOffset(video) {
  // Average each frame; only the full-frame magenta calibration marker matches.
  const bytes = await new Promise((res, rej) => {
    const p = spawn("ffmpeg", [
      "-v",
      "error",
      "-i",
      video,
      "-vf",
      "fps=30,scale=1:1",
      "-pix_fmt",
      "rgb24",
      "-f",
      "rawvideo",
      "pipe:1",
    ]);
    const chunks = [];
    let error = "";
    p.stdout.on("data", (x) => chunks.push(x));
    p.stderr.on("data", (x) => (error += x));
    p.on("error", rej);
    p.on("close", (c) =>
      c === 0 ? res(Buffer.concat(chunks)) : rej(new Error(error)),
    );
  });
  let runLength = 0;
  for (let i = 0; i < bytes.length; i += 3) {
    const marker = bytes[i] > 230 && bytes[i + 1] < 25 && bytes[i + 2] > 230;
    if (marker) runLength++;
    else if (runLength >= 5) return i / 3 / 30;
    else runLength = 0;
  }
  throw new Error(
    "Video synchronization marker not found; refusing an unaligned render",
  );
}
export async function render(file, output) {
  const manifest = JSON.parse(await readFile(file, "utf8"));
  if (manifest.status !== "complete")
    throw new Error("Cannot render an incomplete/failed recording");
  output = resolve(output);
  try {
    await access(output);
    throw new Error(`Output already exists: ${output}`);
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  const offset = await syncOffset(manifest.video);
  const { width, height } = manifest.viewport;
  const args = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-n",
    "-i",
    manifest.video,
  ];
  for (const a of manifest.audio) args.push("-i", a.file);
  const z = expression(manifest.cues, "zoom"),
    x = expression(manifest.cues, "x"),
    y = expression(manifest.cues, "y");
  // Supersampling removes the 2px chroma-grid jitter of small moving crops.
  const filters = [
    `[0:v]trim=start=${offset}:duration=${manifest.duration},setpts=PTS-STARTPTS,fps=30,scale=iw*2:ih*2,zoompan=z='${z}':x='2*(${x})':y='2*(${y})':d=1:s=${width}x${height}:fps=30,format=yuv420p[v]`,
  ];
  if (manifest.audio.length) {
    manifest.audio.forEach((a, i) =>
      filters.push(
        `[${i + 1}:a]aresample=48000,asetpts=PTS-STARTPTS,adelay=${Math.round(a.at * 1000)}:all=1[a${i}]`,
      ),
    );
    filters.push(
      `${manifest.audio.map((_, i) => `[a${i}]`).join("")}amix=inputs=${manifest.audio.length}:normalize=0,apad,atrim=duration=${manifest.duration}[a]`,
    );
  }
  const script = join(dirname(file), "render.ffgraph");
  await writeFile(script, filters.join(";\n"));
  args.push("-filter_complex", filters.join(";"), "-map", "[v]");
  if (manifest.audio.length)
    args.push("-map", "[a]", "-c:a", "aac", "-b:a", "192k");
  args.push(
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "18",
    "-movflags",
    "+faststart",
    "-t",
    String(manifest.duration),
    output,
  );
  try {
    await run("ffmpeg", args);
  } catch (e) {
    await unlink(output).catch(() => {});
    throw e;
  }
  const chapters = manifest.steps.map((s) => ({
    title: s.label,
    start: s.actionAt,
    end: s.end,
  }));
  await writeFile(
    `${output}.chapters.json`,
    JSON.stringify(chapters, null, 2) + "\n",
  );
  return { output, offset, duration: manifest.duration };
}

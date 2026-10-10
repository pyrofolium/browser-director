import { z } from "zod";
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
const target = z.string().min(1);
const camera = z.union([
  z.literal("wide"),
  z
    .object({
      target,
      padding: z.number().min(0).max(500).default(70),
      maxZoom: z.number().min(1).max(3).default(1.8),
      durationMs: z.number().min(0).max(3000).default(650),
    })
    .strict(),
]);
const common = {
  label: z.string().optional(),
  camera: camera.optional(),
  holdMs: z.number().min(0).max(120000).default(1200),
  audio: z.string().optional(),
  expect: z.object({ target, text: z.string().optional() }).strict().optional(),
};
export const stepSchema = z.discriminatedUnion("action", [
  z.object({ ...common, action: z.literal("click"), target }).strict(),
  z
    .object({
      ...common,
      action: z.literal("type"),
      target,
      text: z.string(),
      delayMs: z.number().min(0).max(1000).default(45),
    })
    .strict(),
  z
    .object({ ...common, action: z.literal("press"), key: z.string().min(1) })
    .strict(),
  z.object({ ...common, action: z.literal("focus"), target }).strict(),
  z
    .object({
      ...common,
      action: z.literal("wait"),
      target,
      text: z.string().optional(),
    })
    .strict(),
  z.object({ ...common, action: z.literal("pause") }).strict(),
  z.object({ ...common, action: z.literal("scroll"), target }).strict(),
]);
export const planSchema = z
  .object({
    version: z.literal(1),
    url: z.string().min(1),
    viewport: z
      .object({
        width: z.number().int().min(640).max(3840).multipleOf(2).default(1440),
        height: z.number().int().min(480).max(2160).multipleOf(2).default(900),
      })
      .strict()
      .default({ width: 1440, height: 900 }),
    timeoutMs: z.number().min(100).max(120000).default(15000),
    ready: target.optional(),
    prepare: z.array(stepSchema).max(100).default([]),
    steps: z.array(stepSchema).min(1).max(100),
    tailMs: z.number().min(650).max(10000).default(1000),
  })
  .strict();
export async function loadPlan(file, env = process.env) {
  const plan = planSchema.parse(JSON.parse(await readFile(file, "utf8")));
  plan.url = plan.url.replace(/\$\{([A-Z_][A-Z0-9_]*)\}/g, (_, key) => {
    if (!env[key]) throw new Error(`Missing environment variable ${key}`);
    return env[key];
  });
  if (!["http:", "https:", "file:"].includes(new URL(plan.url).protocol))
    throw new Error("URL must use http, https, or file");
  for (const step of [...plan.prepare, ...plan.steps])
    if (step.audio) step.audio = resolve(dirname(file), step.audio);
  return plan;
}

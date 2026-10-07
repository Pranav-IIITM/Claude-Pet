import { build, context } from "esbuild";
import { cpSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const watch = process.argv.includes("--watch") || process.argv.includes("--watch-run");

/** @type {import('esbuild').BuildOptions[]} */
const targets = [
  {
    entryPoints: [resolve(root, "src/main/index.ts")],
    outfile: resolve(root, "dist/main/index.js"),
    platform: "node",
    format: "cjs",
    target: "node20",
    external: ["electron", "chokidar"],
  },
  {
    entryPoints: [resolve(root, "src/preload/index.ts")],
    outfile: resolve(root, "dist/preload/index.js"),
    platform: "node",
    format: "cjs",
    target: "node20",
    external: ["electron"],
  },
  {
    entryPoints: [resolve(root, "src/renderer/pet.ts")],
    outfile: resolve(root, "dist/renderer/pet.js"),
    platform: "browser",
    format: "iife",
    target: "chrome120",
  },
];

const common = { bundle: true, sourcemap: true, logLevel: "info", minify: false };

function copyStatic() {
  mkdirSync(resolve(root, "dist/renderer"), { recursive: true });
  cpSync(resolve(root, "src/renderer/index.html"), resolve(root, "dist/renderer/index.html"));
  cpSync(resolve(root, "src/renderer/styles.css"), resolve(root, "dist/renderer/styles.css"));
}

if (watch) {
  copyStatic();
  const ctxs = await Promise.all(targets.map((t) => context({ ...common, ...t })));
  await Promise.all(ctxs.map((c) => c.watch()));
  console.log("esbuild watching...");
  if (process.argv.includes("--watch-run")) {
    const { spawn } = await import("node:child_process");
    const electron = (await import("electron")).default;
    spawn(electron, [root], { stdio: "inherit" }).on("close", () => process.exit(0));
  }
} else {
  await Promise.all(targets.map((t) => build({ ...common, ...t })));
  copyStatic();
  console.log("build complete");
}

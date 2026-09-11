import * as esbuild from "esbuild";

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

const context = await esbuild.context({
  entryPoints: ["src/extension.ts"],
  bundle: true,
  format: "cjs",
  minify: production,
  sourcemap: !production,
  platform: "node",
  target: "node20",
  outfile: "dist/extension.js",
  // Bundle the SDK client code, but use a separately installed official
  // Copilot CLI at runtime. This keeps the VSIX free of the ~110 MB agent
  // runtime that a quota-only extension does not need to redistribute.
  external: ["vscode"],
  logLevel: "info"
});

if (watch) {
  await context.watch();
} else {
  await context.rebuild();
  await context.dispose();
}

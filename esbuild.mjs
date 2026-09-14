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
  // Bundle the SDK client code. Its platform-specific official runtime remains
  // a packaged production dependency that the SDK resolves at runtime.
  external: ["vscode"],
  logLevel: "info"
});

if (watch) {
  await context.watch();
} else {
  await context.rebuild();
  await context.dispose();
}

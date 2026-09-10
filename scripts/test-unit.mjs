// Resolves test/unit/*.test.ts ourselves instead of passing the glob straight to `node --test`:
// cmd.exe (Windows CI's npm script shell) never expands wildcards, and the Node version pinned
// in CI predates `--test` resolving glob patterns itself, so the literal "*.test.ts" argument
// fails to resolve there even though it works under bash or a newer local Node.
import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const testDir = "test/unit";
const files = readdirSync(testDir)
  .filter((name) => name.endsWith(".test.ts"))
  .map((name) => join(testDir, name));

const child = spawn(process.execPath, ["--import", "tsx", "--test", ...files], { stdio: "inherit" });
child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));

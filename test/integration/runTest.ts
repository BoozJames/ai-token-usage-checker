import { resolve } from "node:path";
import { runTests } from "@vscode/test-electron";

async function main(): Promise<void> {
  // Some parent tools launch through Electron-as-Node. VS Code's test host must run as Electron.
  delete process.env.ELECTRON_RUN_AS_NODE;
  await runTests({
    version: "1.95.3",
    extensionDevelopmentPath: resolve(__dirname, "../../.."),
    extensionTestsPath: resolve(__dirname, "./suite/index")
  });
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Extension integration tests failed");
  process.exit(1);
});

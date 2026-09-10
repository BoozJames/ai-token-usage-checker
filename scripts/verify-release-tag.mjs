import { readFile } from "node:fs/promises";

const tag = process.env.GITHUB_REF_NAME;
if (!tag) {
  throw new Error("GITHUB_REF_NAME is required");
}

const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const expectedTag = `v${manifest.version}`;

if (tag !== expectedTag) {
  throw new Error(`Release tag ${tag} does not match package version ${expectedTag}`);
}

console.log(`Verified release tag ${tag}`);

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";

const file = process.argv[2];
if (!file) throw new Error("Pass the artifact path to checksum.mjs");
const digest = createHash("sha256").update(await readFile(file)).digest("hex");
await writeFile(`${file}.sha256`, `${digest}  ${basename(file)}\n`, "utf8");

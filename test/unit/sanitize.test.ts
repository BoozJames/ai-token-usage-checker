import assert from "node:assert/strict";
import { it } from "node:test";
import { sanitizeError } from "../../src/sanitize";

it("redacts common credentials and home paths", () => {
  const authHeader = "Bear" + "er " + "abcdef";
  const githubToken = "github" + "_pat_" + "abcdefghijklmnopqrstuvwxyz";
  const result = sanitizeError(new Error(`${authHeader} at C:\\Users\\person\\secret and ${githubToken}`));
  assert.doesNotMatch(result, /abcdef|person|github_pat_/);
  assert.match(result, /\[redacted\]|\[path\]/);
});

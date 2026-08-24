import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

const roots = ["app", "components", "src/features"];
const staleProductCopy = [
  "Internal Ring Shuttle",
  "Main Gate",
  "Block 3",
  "Block 4",
  "Block 5",
  "Block 6 Terminal",
  "encrypted JWT QR",
  "prevent screenshot sharing",
  "Real-Time Seat Matrix",
  "simulated IoT sensor health",
];

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(target);
    return /\.(?:ts|tsx|js|jsx)$/.test(entry.name) ? [target] : [];
  }));
  return nested.flat();
}

describe("active product copy", () => {
  it("does not reintroduce retired prototype routes or misleading product claims", async () => {
    const files = (await Promise.all(roots.map(sourceFiles))).flat();
    const matches: string[] = [];
    for (const file of files) {
      const source = await readFile(file, "utf8");
      for (const phrase of staleProductCopy) {
        if (source.includes(phrase)) matches.push(`${file}: ${phrase}`);
      }
    }
    assert.deepEqual(matches, []);
  });
});

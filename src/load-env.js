import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

try {
  const path = fileURLToPath(new URL("../.env", import.meta.url));
  const source = readFileSync(path, "utf8");
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || match[2] === "" || process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

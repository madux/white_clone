import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "out");
const DEST = path.resolve(ROOT, "..", "static", "src", "nextapp");

function rmrf(target) {
  if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
}

function copy(source, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(source, destination, { recursive: true });
}

if (!fs.existsSync(OUT)) {
  console.error("✗ Build output not found. Run `npm run build` first.");
  process.exit(1);
}

rmrf(DEST);
copy(OUT, DEST);
console.log("✓ Next.js export synced to", path.relative(process.cwd(), DEST));

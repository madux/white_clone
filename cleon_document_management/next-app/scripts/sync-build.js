// cleon_document_management/next-app/scripts/sync-build.js
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "out");
const DEST = path.resolve(ROOT, "..", "static", "src", "nextapp");

function rmrf(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}
function cp(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
}

if (!fs.existsSync(OUT)) {
  console.error("✗ Build output not found. Run `npm run build` first.");
  process.exit(1);
}

rmrf(DEST);
cp(OUT, DEST);
console.log("✓ Next.js export synced to", path.relative(process.cwd(), DEST));

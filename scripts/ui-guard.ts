// Fails when a design-system-replaced pattern reappears (pnpm ui:guard [paths…]).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { checkSource, GUARD_RULES } from "../src/lib/design/uiGuard";

const SKIP = ["src/components/ui", "src/components/graphics", "src/app/(overlay)"];
const roots = process.argv.slice(2).length ? process.argv.slice(2) : ["src/app", "src/components"];

function* files(p: string): Generator<string> {
  if (SKIP.some((s) => p.startsWith(s))) return;
  if (statSync(p).isDirectory()) for (const f of readdirSync(p)) yield* files(join(p, f));
  else if (/\.(tsx|ts)$/.test(p) && !/\.test\.tsx?$/.test(p)) yield p;
}

const violations = roots.flatMap((r) =>
  [...files(r)].flatMap((f) => checkSource(f, readFileSync(f, "utf8"))),
);
const message = Object.fromEntries(GUARD_RULES.map((r) => [r.id, r.message]));
for (const v of violations)
  console.log(`${v.file}:${v.line}  [${v.rule}] ${message[v.rule]}\n    ${v.text}`);
console.log(violations.length ? `\n${violations.length} violation(s).` : "ui-guard: clean");
process.exit(violations.length ? 1 : 0);

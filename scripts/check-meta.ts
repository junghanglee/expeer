#!/usr/bin/env bun
/**
 * Pre-build validator for src/routes/__root.tsx.
 *
 * Catches the recurring class of failures where SEO meta strings get
 * silently wrapped onto a second line, producing TS1002/TS1005
 * "Unterminated string constant" errors deep inside the Vite/Babel
 * pipeline.
 *
 * Checks:
 *   1. No string literal in the file spans more than one line.
 *   2. SEO description ≤ 160 chars, title ≤ 60 chars (best-practice).
 *   3. TypeScript parser accepts the file (catches TS1002/TS1005 early
 *      with the exact line number, before vite build runs).
 *
 * Exits non-zero on any violation so CI / `bun run check` fails fast.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const ROOT = resolve(process.cwd(), "src/routes/__root.tsx");

if (!existsSync(ROOT)) {
  console.error(`[check-meta] ${ROOT} not found`);
  process.exit(1);
}

const source = readFileSync(ROOT, "utf8");
const errors: string[] = [];

// --- 1. Parse with the TypeScript compiler to surface TS1002/TS1005 early.
const sf = ts.createSourceFile(ROOT, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
// `parseDiagnostics` is on the SourceFile but not in the public types.
const diags = (sf as unknown as { parseDiagnostics?: ts.Diagnostic[] }).parseDiagnostics ?? [];
for (const d of diags) {
  const { line, character } = ts.getLineAndCharacterOfPosition(sf, d.start ?? 0);
  const msg = ts.flattenDiagnosticMessageText(d.messageText, "\n");
  errors.push(`__root.tsx:${line + 1}:${character + 1}  TS${d.code}  ${msg}`);
}

// --- 2. Detect multi-line string literals (the actual root cause).
const lines = source.split("\n");
let inString: '"' | "'" | "`" | null = null;
let stringStartLine = 0;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  for (let j = 0; j < line.length; j++) {
    const ch = line[j];
    const prev = j > 0 ? line[j - 1] : "";
    if (inString) {
      if (ch === inString && prev !== "\\") {
        inString = null;
      }
    } else if (ch === '"' || ch === "'" || ch === "`") {
      // Skip if inside a // line comment.
      const before = line.slice(0, j);
      if (before.includes("//") && !before.includes("://") && !before.match(/["'`].*\/\//))
        continue;
      inString = ch;
      stringStartLine = i + 1;
    }
  }
  // At end of line, " or ' literals must have closed (template literals may span lines).
  if (inString === '"' || inString === "'") {
    errors.push(
      `__root.tsx:${stringStartLine}  Unterminated ${inString} string literal — meta string wrapped to a new line. Keep all SEO meta values on a single line.`,
    );
    inString = null;
  }
}

// --- 3. Best-practice length checks for SEO meta.
const titleMatch = source.match(/SITE_TITLE\s*=\s*"([^"]*)"/);
const descMatch = source.match(/SITE_DESC\s*=\s*"([^"]*)"/);
if (titleMatch && titleMatch[1].length > 60) {
  errors.push(`SITE_TITLE is ${titleMatch[1].length} chars (recommend ≤ 60)`);
}
if (descMatch && descMatch[1].length > 160) {
  errors.push(`SITE_DESC is ${descMatch[1].length} chars (recommend ≤ 160)`);
}

if (errors.length > 0) {
  console.error("\n✗ check-meta failed:\n");
  for (const e of errors) console.error("  " + e);
  console.error("");
  process.exit(1);
}

console.log("✓ check-meta: __root.tsx meta tags valid");

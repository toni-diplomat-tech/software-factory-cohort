// Fails when a file uses a word GLOSSARY.md says to avoid.
// Usage: node scripts/check-glossary.js [file]...
// With no files, checks every tracked file under app/ and docs/, and the
// Markdown at the repository root.
//
// Only the Avoid words that never mean anything else here are checked.
// "User", "Access", "Progress", "Question" and the rest are ordinary words in
// code (a `users` table, a quiz question), so those stay a review judgement.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const AVOID = [
  { pattern: /\blearners?('s|s')?\b/gi, use: "Student" },
  { pattern: /\bteachers?('s|s')?\b/gi, use: "Instructor" },
];

const CHECKED = /^(app\/|docs\/|[^/]+\.md$)/;
// instructor-analytics.ts is over the 5000-token limit, so no commit can
// touch it until it is split. Remove it from this list once #20 lands.
const IGNORED =
  /^(GLOSSARY\.md|app\/modules\/instructor-analytics\/lib\/instructor-analytics\.ts)$/;

const tracked = () =>
  execFileSync("git", ["ls-files", "app", "docs", "*.md"], { encoding: "utf8" })
    .split("\n")
    .filter(Boolean);

const args = process.argv.slice(2);
const files = (args.length > 0 ? args : tracked())
  .map((file) =>
    file
      .replaceAll("\\", "/")
      .replace(`${process.cwd().replaceAll("\\", "/")}/`, "")
  )
  .filter((file) => CHECKED.test(file) && !IGNORED.test(file));

const hits = files.flatMap((file) =>
  readFileSync(file, "utf8")
    .split("\n")
    .flatMap((text, index) =>
      AVOID.flatMap(({ pattern, use }) =>
        [...text.matchAll(pattern)].map(
          ([word]) => `  ${file}:${index + 1}: "${word}" → ${use}`
        )
      )
    )
);

if (hits.length > 0) {
  console.error(
    `These words are on GLOSSARY.md's Avoid list:\n\n${hits.join("\n")}\n`
  );
  process.exit(1);
}

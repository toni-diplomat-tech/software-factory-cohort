import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import * as path from "node:path";
import * as sandcastle from "@ai-hero/sandcastle";
import { noSandbox } from "@ai-hero/sandcastle/sandboxes/no-sandbox";
import type { z } from "zod/v4";
import { claudeAgent, required, writeJson } from "../shared/common";
import { extractionPrompt } from "../shared/extraction-prompt";
import { runWithExtraction } from "../shared/run-with-extraction";
import { diffLines } from "./diff-lines";
import { reviewSchema } from "./review-schema";

const BASE_REF = required("BASE_REF");
// The prompt names this path; the workflow posts it as the verdict comment.
const VERDICT = "/tmp/review-verdict.md";

// The agent fixes and commits, writes the verdict file, and hands back the
// findings it left. The workflow pushes the commits, posts the verdict and
// the inline comments, and marks the PR ready.
const result = await runWithExtraction({
  name: "review",
  agent: claudeAgent(),
  sandbox: noSandbox(),
  logging: { type: "stdout" },
  promptFile: path.join(import.meta.dirname, "prompt.md"),
  promptArgs: {
    PR_NUMBER: required("PR_NUMBER"),
    BRANCH: required("BRANCH"),
    BASE_REF,
  },
  output: sandcastle.Output.object({ tag: "comments", schema: reviewSchema }),
  extractionPrompt: extractionPrompt("comments", reviewSchema),
});

const git = (...args: string[]): string =>
  execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

// The diff after the agent's commits: the comments land on that.
const hunks = diffLines(git("diff", `origin/${BASE_REF}...HEAD`));
const { comments: found }: z.infer<typeof reviewSchema> = result.output;
const inDiff = ({ path: file, line }: { path: string; line: number }) =>
  hunks.get(file)?.has(line) ?? false;
const comments = found.filter(inDiff);

// GitHub rejects a review with a comment outside the diff, and the verdict
// holds only a count of the left findings, so a comment GitHub cannot take
// goes into the verdict instead of disappearing.
const outside = found.filter((comment) => !inDiff(comment));
if (outside.length > 0) {
  console.error(
    `${outside.length} comment(s) outside the diff go in the verdict.`
  );
  appendFileSync(
    VERDICT,
    [
      "\n## Findings outside the diff\n",
      ...outside.map(
        ({ path: file, line, body }) => `- \`${file}:${line}\`: ${body}`
      ),
      "",
    ].join("\n")
  );
}

// The request body for POST /repos/{owner}/{repo}/pulls/{n}/reviews.
writeJson("review-comments.json", {
  commit_id: git("rev-parse", "HEAD").trim(),
  event: "COMMENT",
  body: "The findings this review left for you, on their lines. The verdict is in its own comment.",
  comments: comments.map((comment) => ({ ...comment, side: "RIGHT" })),
});

/**
 * Write-commit workflow: analyze staged diff, suggest commit message, prompt user, commit.
 */

import { createInterface } from "node:readline/promises";
import { getStagedAsCommit, runGit } from "../git.ts";
import { analyzeCommitsWithLLM } from "../llm_analyzer.ts";

const LINE = "━━━━━━━━━━━━━━━━━━━━━━━━━━━━";

export async function runWrite(cwd: string): Promise<void> {
  const staged = getStagedAsCommit(cwd);
  if (!staged) {
    console.error("Nothing staged. Stage changes with `git add` then run again.");
    process.exit(1);
  }

  console.log("\nAnalyzing staged diff...\n");

  const evaluations = await analyzeCommitsWithLLM([staged], { includeDiff: true });
  const e = evaluations[0];

  if (!e) {
    console.error("No evaluation returned.");
    process.exit(1);
  }

  const changesSummary = e.changesSummary?.length ? e.changesSummary : ["Staged changes"];
  const suggestedMessage = e.better ?? "";

  console.log("Changes detected:");
  for (const bullet of changesSummary) {
    console.log(`- ${bullet}`);
  }
  console.log();
  console.log("Suggested commit message:");
  console.log(LINE);
  console.log(suggestedMessage || "(no suggestion)");
  console.log(LINE);
  console.log();
  console.log("Press Enter to accept, or type your own message:");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const raw = await rl.question("> ");
  rl.close();
  const userMessage = raw.trim();
  const finalMessage = userMessage === "" ? suggestedMessage : userMessage;

  if (!finalMessage) {
    console.log("No message provided. Exiting without committing.");
    process.exit(0);
  }

  const commitArgs = ["commit", ...finalMessage.split("\n").flatMap((l) => ["-m", l])];
  const result = runGit(cwd, ...commitArgs);
  if (result.code !== 0) {
    console.error(result.stderr || result.stdout || "git commit failed");
    process.exit(1);
  }
  console.log(result.stdout || "Committed successfully.");
  process.exit(0);
}

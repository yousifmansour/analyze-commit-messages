/**
 * Report formatting and evaluation helpers for commit analysis output.
 */

import type { Commit } from "./git.ts";
import type { CommitEvaluation } from "./llm_analyzer.ts";

const LINE = "━━━━━━━━━━━━━━━━━━━━━━━━━━━━";

export function isOneWordCommit(message: string): boolean {
  return message.trim().split(/\s+/).filter(Boolean).length <= 1;
}

export function isVagueCommit(e: CommitEvaluation): boolean {
  if (typeof e.isVague === "boolean") return e.isVague;
  return e.score <= 4 || !e.good;
}

export function printReport(commits: Commit[], evaluations: CommitEvaluation[]): void {
  const needWork = evaluations.filter((e) => !e.good);
  const wellWritten = evaluations.filter((e) => e.good);

  console.log(`\n${LINE}`);
  console.log("💩 COMMITS THAT NEED WORK");
  console.log(LINE);

  if (needWork.length === 0) {
    console.log("(none)\n");
  } else {
    for (const e of needWork) {
      const c = commits[e.index];
      if (!c) continue;
      console.log(`\nCommit: "${c.message.split("\n")[0]}"`);
      console.log(`Score: ${e.score}/10`);
      console.log(`Issue: ${e.issue ?? "No details"}`);
      console.log(`Better: ${e.better ?? "Describe what changed and why"}`);
    }
    console.log();
  }

  console.log(`${LINE}`);
  console.log("💎 WELL-WRITTEN COMMITS");
  console.log(LINE);

  if (wellWritten.length === 0) {
    console.log("(none)\n");
  } else {
    for (const e of wellWritten) {
      const c = commits[e.index];
      if (!c) continue;
      const firstLine = c.message.split("\n")[0];
      const rest = c.message.split("\n").slice(1).filter(Boolean);
      const displayMessage = rest.length > 0
        ? `${firstLine}\n         ${rest.join("\n         ")}`
        : firstLine;
      console.log(`\nCommit: "${displayMessage}"`);
      console.log(`Score: ${e.score}/10`);
    }
    console.log();
  }

  const avg = evaluations.length
    ? evaluations.reduce((s, e) => s + e.score, 0) / evaluations.length
    : 0;
  const vagueCount = evaluations.filter(isVagueCommit).length;
  const oneWordCount = commits.filter((c) => isOneWordCommit(c.message)).length;
  const vaguePct = evaluations.length ? ((vagueCount / evaluations.length) * 100).toFixed(1) : "0";
  const oneWordPct = commits.length ? ((oneWordCount / commits.length) * 100).toFixed(1) : "0";

  console.log(`${LINE}`);
  console.log("📊 YOUR STATS");
  console.log(LINE);
  console.log(`Average score: ${avg.toFixed(1)}/10`);
  console.log(`Vague commits: ${vagueCount} (${vaguePct}%)`);
  console.log(`One-word commits: ${oneWordCount} (${oneWordPct}%)`);
  console.log();
}

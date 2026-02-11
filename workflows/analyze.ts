/**
 * Analyze workflow: fetch commits (local or remote), run LLM evaluation, print report.
 */

import { DEFAULT_MAX_COMMITS, analyzeRemote, analyzeLocal, type Commit } from "../git.ts";
import { analyzeCommitsWithLLM } from "../llm_analyzer.ts";
import { printReport } from "../report.ts";

export type AnalyzeWorkflowOptions = {
  url?: string;
  branch: string;
  maxCommits: number;
};

export async function runAnalyze(cwd: string, options: AnalyzeWorkflowOptions): Promise<void> {
  const { url, branch, maxCommits = DEFAULT_MAX_COMMITS } = options;

  console.log(`\nAnalyzing last ${maxCommits} commits...\n`);

  const commits: Commit[] = url
    ? analyzeRemote(url, branch, maxCommits)
    : analyzeLocal(cwd, maxCommits);

  const evaluations = await analyzeCommitsWithLLM(commits, { includeDiff: false });
  printReport(commits, evaluations);
}

/**
 * Analyze commit messages with OpenAI via Vercel AI SDK.
 * - Committed commits: judge based on message only (no diff).
 * - Write mode (staged): judge message + diff and suggest a commit message.
 */

import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import type { Commit } from "./git.ts";
import { SYSTEM_PROMPT_MESSAGE_ONLY } from "./prompts/message-only.ts";
import { SYSTEM_PROMPT_WITH_DIFF } from "./prompts/with-diff.ts";

/** Per-commit evaluation from the LLM. */
export type CommitEvaluation = {
  index: number;
  good: boolean;
  score: number;
  /** Whether the message is vague (e.g. "fixed bug", "wip", uninformative). */
  isVague?: boolean;
  issue?: string;
  better?: string;
  /** Short bullet summary of what changed (write mode only). */
  changesSummary?: string[];
};

function buildCommitBlock(commit: Commit, index: number, includeDiff: boolean): string {
  const header = `--- COMMIT ${index} ---\nMessage: ${commit.message}`;
  if (!includeDiff) return header + "\n";
  return header + `\n\nDiff:\n${commit.diff || "(no diff)"}\n`;
}

function buildPrompt(commits: Commit[], includeDiff: boolean): string {
  return commits.map((c, i) => buildCommitBlock(c, i, includeDiff)).join("\n");
}

function parseCommitEvaluations(text: string): CommitEvaluation[] | null {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try {
    const data = JSON.parse(trimmed) as { commits?: unknown[] };
    if (!data || !Array.isArray(data.commits)) return null;
    return data.commits.map((item) => {
      const o = item as Record<string, unknown>;
      const changes = o.changes;
      const changesSummary = Array.isArray(changes)
        ? (changes as unknown[]).filter((x): x is string => typeof x === "string")
        : undefined;
      return {
        index: typeof o.index === "number" ? o.index : 0,
        good: typeof o.good === "boolean" ? o.good : false,
        score: typeof o.score === "number" ? Math.max(1, Math.min(10, o.score)) : 5,
        isVague: typeof o.isVague === "boolean" ? o.isVague : undefined,
        issue: typeof o.issue === "string" ? o.issue : undefined,
        better: typeof o.better === "string" ? o.better : undefined,
        changesSummary: changesSummary?.length ? changesSummary : undefined,
      } satisfies CommitEvaluation;
    });
  } catch {
    return null;
  }
}

export type AnalyzeOptions = {
  /** Include diff in the prompt (use true for write mode / staged analysis). */
  includeDiff?: boolean;
};

function analyzeOneCommit(
  commit: Commit,
  index: number,
  systemPrompt: string,
  includeDiff: boolean
): Promise<CommitEvaluation> {
  const prompt = buildPrompt([commit], includeDiff);
  const userPrompt = `Evaluate this commit. Return JSON with a "commits" array containing one object (index: 0).\n\n${prompt}`;

  return generateText({
    model: openai("gpt-5.2"),
    system: systemPrompt,
    prompt: userPrompt,
  }).then(({ text }) => {
    const evaluations = parseCommitEvaluations(text);
    const evaluation = evaluations?.[0];
    if (!evaluation) {
      return {
        index,
        good: false,
        score: 5,
        issue: "Could not parse evaluation",
      };
    }
    return { ...evaluation, index };
  });
}

/**
 * Analyze commits with the LLM.
 * - One API call per commit, all run in parallel for speed.
 * - includeDiff: false (default) — judge by message only (for already committed commits).
 * - includeDiff: true — include diff and suggest message (for write mode / staged changes).
 */
export async function analyzeCommitsWithLLM(
  commits: Commit[],
  options: AnalyzeOptions = {}
): Promise<CommitEvaluation[]> {
  const { includeDiff = false } = options;
  if (commits.length === 0) return [];

  const systemPrompt = includeDiff ? SYSTEM_PROMPT_WITH_DIFF : SYSTEM_PROMPT_MESSAGE_ONLY;

  const evaluations = await Promise.all(
    commits.map((commit, index) =>
      analyzeOneCommit(commit, index, systemPrompt, includeDiff)
    )
  );

  return evaluations.sort((a, b) => a.index - b.index);
}

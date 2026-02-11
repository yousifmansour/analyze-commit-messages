#!/usr/bin/env node
/**
 * Commit Critic — Analyze recent commits (remote or local repo) with GPT.
 *
 * Run:
 *   npx . analyze [--url URL] [-n N]
 *   npx . write
 *
 * Requires OPENAI_API_KEY in the environment.
 */

import { DEFAULT_MAX_COMMITS } from "./git.ts";
import { runAnalyze } from "./workflows/analyze.ts";
import { runWrite } from "./workflows/write_commit.ts";

function parseArgs(): {
  analyze: boolean;
  write: boolean;
  url?: string;
  branch: string;
  maxCommits: number;
} {
  const argv = process.argv.slice(2);
  let analyze = false;
  let write = false;
  let url: string | undefined;
  let branch = "main";
  let maxCommits = DEFAULT_MAX_COMMITS;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "analyze" || arg === "--analyze") analyze = true;
    else if (arg === "write" || arg === "--write") write = true;
    else if (arg === "--url") url = argv[++i];
    else if (arg === "--branch") branch = argv[++i];
    else if (arg === "-n" || arg === "--max-commits") maxCommits = parseInt(argv[++i], 10);
  }

  return { analyze, write, url, branch, maxCommits };
}

function printUsage(): void {
  console.log(`
Commit Critic — Analyze recent commits from a remote or local repo.

Usage:
  node commit_critic.ts analyze [options]
  node commit_critic.ts analyze --url <URL> [options]
  node commit_critic.ts write

Modes:
  analyze                 Analyze the local repository
  analyze --url URL       Analyze a remote repository
  write                   Analyze current staged diff (suggests a commit message)

Options:
  --url URL               Repo URL for remote mode (e.g. https://github.com/user/repo.git)
  -n, --max-commits N     Max commits to fetch (default: ${DEFAULT_MAX_COMMITS})

Requires OPENAI_API_KEY in the environment.
`);
}

function main(): number {
  const args = parseArgs();

  if (!args.analyze && !args.write) {
    printUsage();
    return 0;
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error("Error: OPENAI_API_KEY is not set.");
    return 1;
  }

  void (async () => {
    try {
      const cwd = process.cwd();
      if (args.write) {
        await runWrite(cwd);
      } else {
        await runAnalyze(cwd, {
          url: args.url,
          branch: args.branch,
          maxCommits: args.maxCommits,
        });
        process.exit(0);
      }
    } catch (e) {
      console.error("Error:", e instanceof Error ? e.message : e);
      process.exit(1);
    }
  })();

  return -1; // async handler will call process.exit
}

const code = main();
if (code >= 0) process.exit(code);

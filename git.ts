/**
 * Git operations and commit data (remote or local repo).
 * Run git commands, fetch commit history, and read staged changes.
 */

export const DEFAULT_MAX_COMMITS = 10;

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface Commit {
  hash: string;
  message: string;
  diff: string;
}

export function runGit(cwd: string, ...args: string[]): { stdout: string; stderr: string; code: number } {
  try {
    const stdout = execFileSync("git", args, {
      cwd,
      encoding: "utf-8",
      maxBuffer: DEFAULT_MAX_COMMITS * 1024 * 1024,
    });
    return { stdout: stdout ?? "", stderr: "", code: 0 };
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: (err.stdout ?? "") as string,
      stderr: (err.stderr ?? "") as string,
      code: err.status ?? 1,
    };
  }
}

export function cloneRepo(url: string, branch: string = "main", depth: number = DEFAULT_MAX_COMMITS): string {
  const prefix = join(tmpdir(), "commit_critic_");
  const cloneDir = mkdtempSync(prefix);
  const result = runGit(process.cwd(), "clone", "--depth", String(depth), "--single-branch", "--branch", branch, url, cloneDir);
  if (result.code !== 0) {
    rmSync(cloneDir, { recursive: true, force: true });
    throw new Error(`git clone failed: ${(result.stderr || result.stdout).trim()}`);
  }
  return cloneDir;
}

export function getCommitHashes(repoDir: string, n: number = DEFAULT_MAX_COMMITS): string[] {
  const result = runGit(repoDir, "log", "-n", String(n), "--format=%H");
  if (result.code !== 0) throw new Error(`git log failed: ${result.stderr.trim()}`);
  return result.stdout
    .trim()
    .split("\n")
    .map((h) => h.trim())
    .filter(Boolean);
}

export function getCommitMessageAndDiff(repoDir: string, commitHash: string): { message: string; diff: string } {
  const msgResult = runGit(repoDir, "log", "-1", "--format=%B", commitHash);
  const diffResult = runGit(repoDir, "show", "-p", commitHash);
  const message = (msgResult.stdout ?? "").trim();
  const diff = (diffResult.stdout ?? "").trim();
  return { message, diff };
}

/** Analyze a remote repo: clone, read last N commits, remove clone. */
export function analyzeRemote(url: string, branch: string = "main", maxCommits: number = DEFAULT_MAX_COMMITS): Commit[] {
  let cloneDir: string | null = null;
  try {
    cloneDir = cloneRepo(url, branch, maxCommits);
    const hashes = getCommitHashes(cloneDir, maxCommits);
    const commits: Commit[] = [];
    for (const h of hashes) {
      const { message, diff } = getCommitMessageAndDiff(cloneDir, h);
      commits.push({ hash: h, message, diff });
    }
    return commits;
  } finally {
    if (cloneDir && existsSync(cloneDir)) {
      rmSync(cloneDir, { recursive: true, force: true });
    }
  }
}

/** Analyze the repo at the given directory (local repo). */
export function analyzeLocal(repoDir: string, maxCommits: number = DEFAULT_MAX_COMMITS): Commit[] {
  const hashes = getCommitHashes(repoDir, maxCommits);
  const commits: Commit[] = [];
  for (const h of hashes) {
    const { message, diff } = getCommitMessageAndDiff(repoDir, h);
    commits.push({ hash: h, message, diff });
  }
  return commits;
}

/** Get the staged diff in the repo at cwd (empty string if nothing staged). */
export function getStagedDiff(cwd: string): string {
  const result = runGit(cwd, "diff", "--staged");
  if (result.code !== 0) return "";
  return (result.stdout ?? "").trim();
}

/**
 * Treat current staged changes as one pseudo-commit for analysis.
 * Returns null if there are no staged changes.
 */
export function getStagedAsCommit(cwd: string): Commit | null {
  const diff = getStagedDiff(cwd);
  if (!diff) return null;
  return {
    hash: "staged",
    message: "(no message yet)",
    diff,
  };
}

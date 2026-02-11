# Commit Critic

Analyze and improve Git commit messages with an LLM (OpenAI). Node.js v24 required.

**Setup:** Export your OpenAI API key (create one at [OpenAI dashboard](https://platform.openai.com/api-keys)):

```bash
export OPENAI_API_KEY=sk-your-key-here
```

Or add that line to `~/.bashrc` or `~/.zshrc` so it’s set in every session.

---

## What you can run

From the project dir (after `npm install`):

| Command | What it does |
|---------|----------------|
| `node commit_critic.ts --analyze` | Score and critique last N commits in current repo. |
| `node commit_critic.ts --analyze --url https://github.com/user/repo.git` | Same, on a cloned remote repo. |
| `node commit_critic.ts --write` | Suggest a commit message from staged diff, then run `git commit` with it (or your edit). |

**Analyze options:** `--branch BRANCH` (default `main`), `-n N` / `--max-commits N` (default 10).

**Write:** Stage with `git add` first; if nothing staged, it exits.

**Run from outside the project:** Use the full path to the script. You still need `npm install` once in the project dir.

```bash
node /path/to/analyze-commit-messages/commit_critic.ts --analyze
node /path/to/analyze-commit-messages/commit_critic.ts --write
```

- **--analyze:** Can run from anywhere; use `--url https://github.com/user/repo.git` to analyze a remote repo.
- **write:** Run from inside the repo you’re committing in (it uses the current working directory for Git).

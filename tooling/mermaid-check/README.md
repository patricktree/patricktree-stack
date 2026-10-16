# @patricktree-stack/mermaid-check

Parses every fenced `mermaid` block in a repository's Markdown with Mermaid's own parser, so a diagram that GitHub would render as "Parse error" fails validation instead. Markdown linting does not parse diagrams. A common failure is a `;` in a sequence-diagram message label: Mermaid treats it as the end of the statement, so `A->>B: x; y` fails.

## Usage

Add the project to the consuming repository's `pnpm-workspace.yaml` and the root `package.json`, then call the `mermaid-check` binary from a root script that validation runs:

```json
{
  "scripts": {
    "docs:check:mermaid": "mermaid-check"
  },
  "devDependencies": {
    "@patricktree-stack/mermaid-check": "workspace:*"
  }
}
```

The project runs its own tests with Vitest, so the consumer also needs `.patricktree-stack/tooling/config-vitest` in its workspace and `vite` and `vitest` entries in its default catalog, like the other catalog dependencies of stack projects.

Without arguments, `mermaid-check` checks every Markdown file below the current directory that Git tracks or would track, skipping ignored and deleted files; Git lists a submodule as a single entry, so `.patricktree-stack` itself is skipped. Pass file paths to check only those files.

Each failure prints `file:line: parser error`, where the line points into the Markdown file, and the command exits with status 1. Errors without a line, such as an unknown diagram type, point at the opening fence.

## Limits

The check proves that Mermaid parses the diagram, not that it lays out or reads well. GitHub may run a different Mermaid version than the one in this package, so syntax added in a newer release can pass here and still fail on GitHub. Mermaid sanitizes labels while parsing and needs a DOM for that, so the check installs a [happy-dom](https://github.com/capricorn86/happy-dom) window before loading Mermaid; no browser or Docker is involved.

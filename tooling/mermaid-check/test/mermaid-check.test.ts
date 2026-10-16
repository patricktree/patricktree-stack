import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import type { TestContext } from "node:test";
import util from "node:util";

import { runCli } from "#src/cli.ts";
import { findMermaidBlocks } from "#src/mermaid-blocks.ts";

const VALID_DOCUMENT = [
  "# Valid",
  "",
  "```mermaid",
  "sequenceDiagram",
  "  A->>B: x, y",
  "```",
  "",
  "```mermaid",
  "flowchart TD",
  "  A[Start: <b>bold</b>] -->|label| B",
  "```",
].join("\n");
const SEMICOLON_DOCUMENT = [
  "# Semicolon",
  "",
  "Some text.",
  "",
  "```mermaid",
  "sequenceDiagram",
  "  participant A",
  "  A->>B: x; y",
  "```",
].join("\n");

async function runCapturingOutput(args: string[], root: string) {
  const stderr: string[] = [];
  const status = await runCli(args, root, {
    ...console,
    error: (message: string) => {
      stderr.push(message);
    },
  });
  return { status, stderr: stderr.join("\n") };
}

async function createGitRepository(t: TestContext, files: Record<string, string>): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mermaid-check-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  for (const [file, content] of Object.entries(files)) {
    await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await fs.writeFile(path.join(root, file), content);
  }
  const git = util.promisify(childProcess.execFile);
  await git("git", ["init", "--quiet"], { cwd: root });
  await git("git", ["add", "."], { cwd: root });
  return root;
}

await test("reports a semicolon in a sequence message with the Markdown line", async (t) => {
  const root = await createGitRepository(t, { "docs/broken.md": SEMICOLON_DOCUMENT });

  const { status, stderr } = await runCapturingOutput(["docs/broken.md"], root);

  assert.equal(status, 1);
  assert.match(stderr, /^docs\/broken\.md:8: Parse error on line 3:/mu);
  assert.match(stderr, /1 Mermaid diagram\(s\) failed to parse\./u);
});

await test("passes valid sequence diagrams and flowcharts with HTML labels", async (t) => {
  const root = await createGitRepository(t, { "valid.md": VALID_DOCUMENT });

  const { status, stderr } = await runCapturingOutput(["valid.md"], root);

  assert.equal(stderr, "");
  assert.equal(status, 0);
});

await test("checks every tracked Markdown file when no files are given", async (t) => {
  const root = await createGitRepository(t, {
    "README.md": VALID_DOCUMENT,
    "docs/nested/broken.md": SEMICOLON_DOCUMENT,
    "notes.txt": SEMICOLON_DOCUMENT,
  });

  const { status, stderr } = await runCapturingOutput([], root);

  assert.equal(status, 1);
  assert.match(stderr, /^docs\/nested\/broken\.md:8:/mu);
  assert.doesNotMatch(stderr, /README\.md|notes\.txt/u);
});

await test("reports unknown diagram types at the opening fence", async (t) => {
  const root = await createGitRepository(t, {
    "unknown.md": "Intro\n\n```mermaid\nnotADiagram\n```\n",
  });

  const { status, stderr } = await runCapturingOutput(["unknown.md"], root);

  assert.equal(status, 1);
  assert.match(stderr, /^unknown\.md:3: No diagram type detected/mu);
});

await test("ignores Mermaid fences nested inside another code block", () => {
  const markdown = [
    "````md",
    "```mermaid",
    "not checked",
    "```",
    "````",
    "",
    "~~~ mermaid",
    "flowchart TD",
    "~~~",
  ].join("\n");

  assert.deepEqual(findMermaidBlocks(markdown), [{ fenceLine: 7, source: "flowchart TD" }]);
});

await test("removes list indentation from fenced blocks and closes unclosed fences at the end", () => {
  const markdown = [
    "- Item",
    "",
    "  ```mermaid",
    "  flowchart TD",
    "    A --> B",
    "  ```",
    "",
    "```mermaid",
    "pie",
  ].join("\n");

  assert.deepEqual(findMermaidBlocks(markdown), [
    { fenceLine: 3, source: "flowchart TD\n  A --> B" },
    { fenceLine: 8, source: "pie" },
  ]);
});

await test("does not treat a backtick line with backticks in its info string as a fence", () => {
  const markdown = ["``` `inline` ```", "```mermaid", "flowchart TD", "```"].join("\n");

  assert.deepEqual(findMermaidBlocks(markdown), [{ fenceLine: 2, source: "flowchart TD" }]);
});

await test("fails with the error message when a file cannot be read", async (t) => {
  const root = await createGitRepository(t, {});

  const { status, stderr } = await runCapturingOutput(["missing.md"], root);

  assert.equal(status, 1);
  assert.match(stderr, /ENOENT/u);
});

await test("prints help without checking files", async (t) => {
  const root = await createGitRepository(t, {});
  const stdout: string[] = [];

  const status = await runCli(["--help"], root, {
    ...console,
    log: (message: string) => {
      stdout.push(message);
    },
  });

  assert.equal(status, 0);
  assert.match(stdout.join("\n"), /Usage: mermaid-check \[files\.\.\.\]/u);
});

await test("rejects unknown options", async (t) => {
  const root = await createGitRepository(t, {});

  const { status, stderr } = await runCapturingOutput(["--unknown"], root);

  assert.equal(status, 1);
  assert.match(stderr, /Unknown option '--unknown'/u);
});

for (const { name, prefix, expectedLine } of [
  { name: "leading blank lines", prefix: ["", ""], expectedLine: 7 },
  { name: "frontmatter", prefix: ["---", "title: Example", "---"], expectedLine: 8 },
  { name: "a directive", prefix: ["%%{init: {", '  "theme": "dark"', "}}%%"], expectedLine: 8 },
  { name: "comments", prefix: ["%% before"], expectedLine: 6 },
]) {
  await test(`maps parser lines back to the Markdown line after ${name}`, async (t) => {
    const markdown = [
      "Intro",
      "",
      "```mermaid",
      ...prefix,
      "sequenceDiagram",
      "  A->>B: x; y",
      "```",
    ].join("\n");
    const root = await createGitRepository(t, { "diagram.md": markdown });

    const { stderr } = await runCapturingOutput(["diagram.md"], root);

    assert.match(stderr, new RegExp(`^diagram\\.md:${expectedLine}: `, "mu"));
    assert.equal(markdown.split("\n")[expectedLine - 1], "  A->>B: x; y");
  });
}

await test("finds Mermaid fences inside blockquotes and with a capitalized info string", () => {
  const markdown = [
    "> Note",
    "> ```mermaid",
    "> flowchart TD",
    ">   A --> B",
    "> ```",
    "",
    "```Mermaid",
    "pie",
    "```",
  ].join("\n");

  assert.deepEqual(findMermaidBlocks(markdown), [
    { fenceLine: 2, source: "flowchart TD\n  A --> B" },
    { fenceLine: 7, source: "pie" },
  ]);
});

await test("checks untracked Markdown files and skips deleted and ignored ones", async (t) => {
  const root = await createGitRepository(t, {
    ".gitignore": "ignored.md\n",
    "deleted.md": SEMICOLON_DOCUMENT,
  });
  await fs.rm(path.join(root, "deleted.md"));
  await fs.writeFile(path.join(root, "untracked.md"), SEMICOLON_DOCUMENT);
  await fs.writeFile(path.join(root, "ignored.md"), SEMICOLON_DOCUMENT);

  const { status, stderr } = await runCapturingOutput([], root);

  assert.equal(status, 1);
  assert.match(stderr, /^untracked\.md:8:/mu);
  assert.doesNotMatch(stderr, /deleted\.md|ignored\.md/u);
});

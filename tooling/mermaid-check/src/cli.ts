#!/usr/bin/env node
import childProcess from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import util from "node:util";

import { checkMermaidInMarkdown } from "#src/mermaid-blocks.ts";

const HELP = `Usage: mermaid-check [files...]

Parse fenced mermaid blocks in Markdown with Mermaid's own parser and report
each failure as file:line. Without files, checks every Markdown file below the
current directory that Git tracks or would track (not ignored, not deleted).`;

export async function runCli(
  args: string[],
  root = process.cwd(),
  output = console,
): Promise<number> {
  let parsedArgs;
  try {
    parsedArgs = util.parseArgs({
      args,
      allowPositionals: true,
      options: { help: { type: "boolean", short: "h" } },
    });
  } catch (error) {
    output.error(`${error instanceof Error ? error.message : String(error)}\n\n${HELP}`);
    return 1;
  }

  if (parsedArgs.values.help === true) {
    output.log(HELP);
    return 0;
  }

  try {
    const files =
      parsedArgs.positionals.length > 0 ? parsedArgs.positionals : await listMarkdownFiles(root);
    let problemCount = 0;

    for (const file of files) {
      const markdown = await fs.readFile(path.resolve(root, file), "utf8");
      for (const problem of await checkMermaidInMarkdown(markdown)) {
        output.error(`${file}:${problem.line}: ${problem.message}\n`);
        problemCount++;
      }
    }

    if (problemCount > 0) {
      output.error(`${problemCount} Mermaid diagram(s) failed to parse.`);
      return 1;
    }
    return 0;
  } catch (error) {
    output.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

async function listMarkdownFiles(root: string): Promise<string[]> {
  const listFiles = async (...options: string[]) => {
    const { stdout } = await util.promisify(childProcess.execFile)(
      "git",
      ["ls-files", "-z", ...options, "--", "*.md"],
      { cwd: root },
    );
    return stdout.split("\0").filter((file) => file !== "");
  };

  // Git lists a submodule as one entry, not its files, so a consumer's `.patricktree-stack` is skipped.
  const [files, deletedFiles] = await Promise.all([
    listFiles("--cached", "--others", "--exclude-standard"),
    listFiles("--deleted"),
  ]);
  return files.filter((file) => !deletedFiles.includes(file));
}

if (import.meta.main) {
  process.exitCode = await runCli(process.argv.slice(2));
}

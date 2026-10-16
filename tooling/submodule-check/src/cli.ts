#!/usr/bin/env node
import { checkCommits, checkStaged } from "#src/submodule-pointer.ts";
import type { CheckResult, Environment } from "#src/submodule-pointer.ts";

const USAGE = [
  "Usage:",
  "  submodule-check staged                 check staged submodule pointers against HEAD and origin/main",
  "  submodule-check commits <revision...>  check the commits reachable from the revisions but not on any remote",
].join("\n");

export async function runCli(
  args: string[],
  cwd = process.cwd(),
  environment: Environment = process.env,
  output = console,
): Promise<number> {
  const [command, ...revisions] = args;
  let result: CheckResult;
  try {
    if (command === "staged" && revisions.length === 0) {
      result = await checkStaged(cwd, environment);
    } else if (command === "commits" && revisions.length > 0) {
      result = await checkCommits(cwd, environment, revisions);
    } else if (command === "--help" || command === "-h") {
      output.log(USAGE);
      return 0;
    } else {
      output.error(USAGE);
      return 2;
    }
  } catch (error) {
    output.error(error instanceof Error ? error.message : "Submodule check failed.");
    return 1;
  }

  for (const note of result.notes) {
    output.log(note);
  }
  if (result.problems.length > 0) {
    output.error(result.problems.join("\n\n"));
    return 1;
  }
  return 0;
}

if (import.meta.main) {
  process.exitCode = await runCli(process.argv.slice(2));
}

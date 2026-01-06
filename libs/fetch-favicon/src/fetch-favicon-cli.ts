#!/usr/bin/env node
/* eslint-disable n/no-process-exit -- is a CLI */

import * as commander from '@commander-js/extra-typings';
import { writeFile } from 'node:fs/promises';

import { fetchFavicons } from '#pkg/index.js';

const program = new commander.Command()
  .name('fetch-favicon')
  .addArgument(new commander.Argument('[url...]'))
  .addOption(new commander.Option('-o, --output <path>', 'Write JSON output to a file'))
  .addOption(new commander.Option('--stdin', 'Read URLs from stdin (whitespace-separated)'))
  .addOption(new commander.Option('--no-pretty', 'Minify JSON output'));

program.parse();

const options = program.opts();
const hrefs = program.processedArgs[0];
const shouldReadStdin = options.stdin || (!process.stdin.isTTY && hrefs.length === 0);
const stdinUrls = shouldReadStdin ? await readStdinUrls() : [];
const uniqueHrefs = [...new Set([...hrefs, ...stdinUrls])];

if (uniqueHrefs.length === 0) {
  program.outputHelp();
  process.exit(1);
}

const normalizedHrefs = uniqueHrefs.map((href) => new URL(href).href);
const result = await fetchFavicons(normalizedHrefs);
const json = JSON.stringify(result, null, options.pretty ? 2 : 0);

if (options.output) {
  await writeFile(options.output, `${json}\n`, 'utf8');
} else {
  console.log(json);
}

async function readStdinUrls(): Promise<string[]> {
  const chunks: string[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(String(chunk));
  }
  return chunks.join('').split(/\s+/).filter(Boolean);
}

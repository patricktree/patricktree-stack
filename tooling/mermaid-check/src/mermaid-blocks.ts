import { Window } from "happy-dom";

export type MermaidBlock = {
  /** 1-based line of the opening fence in the Markdown source. */
  fenceLine: number;
  source: string;
};

export type MermaidProblem = {
  /** 1-based line in the Markdown source that the parser error points to. */
  line: number;
  message: string;
};

type Fence = { marker: string; indent: number; quoteDepth: number; info: string };

// DOMPurify, which Mermaid calls to sanitize labels while parsing, binds to the global window when
// its module is first evaluated. Without a window it has no sanitize function, so the window must
// exist before Mermaid loads.
Object.assign(globalThis, { window: new Window() });
const { default: mermaid } = await import("mermaid");

const FENCE_PATTERN = /^(?<indent> *)(?<marker>`{3,}|~{3,})(?<info>.*)$/u;
const QUOTE_MARKER_PATTERN = /^ {0,3}> ?/u;
const ERROR_LINE_PATTERN = /on line (?<line>\d+)/u;
const FRONTMATTER_DELIMITER_PATTERN = /^-{3}\s*$/u;
const MERMAID_COMMENT_PATTERN = /^\s*%%/u;
const MERMAID_DIRECTIVE_START_PATTERN = /^\s*%%\{/u;

/**
 * Finds fenced code blocks whose info string starts with `mermaid`, following the CommonMark fence
 * rules that matter for documentation: a block closes on a fence of the same character that is at
 * least as long, fences nested inside another code block (for example a Markdown example) are not
 * diagrams, and fences inside blockquotes or list items lose their quote markers and indentation.
 */
export function findMermaidBlocks(markdown: string): MermaidBlock[] {
  const blocks: MermaidBlock[] = [];
  let openBlock: { fence: Fence; fenceLine: number; body: string[] } | undefined;

  const closeBlock = () => {
    if (openBlock !== undefined && isMermaidInfo(openBlock.fence.info)) {
      blocks.push({ fenceLine: openBlock.fenceLine, source: openBlock.body.join("\n") });
    }
    openBlock = undefined;
  };

  for (const [index, line] of markdown.split(/\r?\n/u).entries()) {
    const quoted = removeQuoteMarkers(
      line,
      openBlock?.fence.quoteDepth ?? Number.POSITIVE_INFINITY,
    );
    const fence = parseFence(quoted.rest, quoted.depth);

    if (openBlock === undefined) {
      if (fence !== undefined) {
        openBlock = { fence, fenceLine: index + 1, body: [] };
      }
    } else if (fence !== undefined && closesFence(fence, openBlock.fence)) {
      closeBlock();
    } else {
      openBlock.body.push(removeIndent(quoted.rest, openBlock.fence.indent));
    }
  }

  // An unclosed fence runs to the end of the document (CommonMark 4.5).
  closeBlock();

  return blocks;
}

/**
 * Parses every Mermaid block in a Markdown document and reports parser errors with their Markdown
 * line.
 */
export async function checkMermaidInMarkdown(markdown: string): Promise<MermaidProblem[]> {
  const problems: MermaidProblem[] = [];

  for (const block of findMermaidBlocks(markdown)) {
    try {
      await mermaid.parse(block.source);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      problems.push({
        line: block.fenceLine + findErrorLineInBlock(block.source, message),
        message,
      });
    }
  }

  return problems;
}

/**
 * Both Mermaid parser families (Jison and Langium) name the failing line as "on line N". They count
 * lines after Mermaid has removed frontmatter, `%%` comments and directives, and leading blank
 * lines, so N is mapped back to the line inside the fence. Errors without a line, such as an
 * unknown diagram type, point at the fence.
 */
function findErrorLineInBlock(source: string, message: string): number {
  const parserLine = ERROR_LINE_PATTERN.exec(message)?.groups?.["line"];
  if (parserLine === undefined) {
    return 0;
  }

  const blockLineOfParserLine = listLinesMermaidParses(source);
  return blockLineOfParserLine[Number(parserLine) - 1] ?? 0;
}

/** Returns the 1-based block line of each line that remains after Mermaid's preprocessing. */
function listLinesMermaidParses(source: string): number[] {
  const lines = source.split("\n");
  let firstLine = 0;

  if (FRONTMATTER_DELIMITER_PATTERN.test(lines[0] ?? "")) {
    const closingDelimiter = lines.findIndex(
      (line, index) => index > 0 && FRONTMATTER_DELIMITER_PATTERN.test(line),
    );
    firstLine = closingDelimiter === -1 ? 0 : closingDelimiter + 1;
  }

  const parsedLines: number[] = [];
  let isInDirective = false;
  for (let index = firstLine; index < lines.length; index++) {
    const line = lines[index] ?? "";
    if (isInDirective) {
      isInDirective = !line.includes("}%%");
      continue;
    }
    if (MERMAID_COMMENT_PATTERN.test(line)) {
      // Directives such as `%%{init: …}%%` can span several lines.
      isInDirective = MERMAID_DIRECTIVE_START_PATTERN.test(line) && !line.includes("}%%");
      continue;
    }
    if (parsedLines.length === 0 && line.trim() === "") {
      continue;
    }
    parsedLines.push(index + 1);
  }

  return parsedLines;
}

function isMermaidInfo(info: string): boolean {
  return info.split(/\s+/u)[0]?.toLowerCase() === "mermaid";
}

function parseFence(line: string, quoteDepth: number): Fence | undefined {
  const groups = FENCE_PATTERN.exec(line)?.groups;
  if (
    groups?.["indent"] === undefined ||
    groups["marker"] === undefined ||
    groups["info"] === undefined
  ) {
    return undefined;
  }

  const { indent, marker, info } = groups;
  // Backtick fences cannot have backticks in their info string (CommonMark 4.5).
  if (marker.startsWith("`") && info.includes("`")) {
    return undefined;
  }

  return { marker, indent: indent.length, quoteDepth, info: info.trim() };
}

function closesFence(candidate: Fence, openFence: Fence): boolean {
  return (
    candidate.marker[0] === openFence.marker[0] &&
    candidate.marker.length >= openFence.marker.length &&
    candidate.info === ""
  );
}

function removeQuoteMarkers(line: string, maxDepth: number): { depth: number; rest: string } {
  let depth = 0;
  let rest = line;
  while (depth < maxDepth) {
    const marker = QUOTE_MARKER_PATTERN.exec(rest);
    if (marker === null) {
      break;
    }
    rest = rest.slice(marker[0].length);
    depth++;
  }
  return { depth, rest };
}

function removeIndent(line: string, indent: number): string {
  let removed = 0;
  while (removed < indent && line[removed] === " ") {
    removed++;
  }
  return line.slice(removed);
}

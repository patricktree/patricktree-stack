import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const fsUtils = {
  ensureDirectoryExists,
  createTemporaryDirectory,
  existsPath,
};

async function ensureDirectoryExists(directoryPath: string): Promise<void> {
  await fs.promises.mkdir(directoryPath, { recursive: true });
}

async function createTemporaryDirectory(options?: { withinDirectory: string }): Promise<string> {
  const withinDirectory = options?.withinDirectory ?? os.tmpdir();
  return fs.promises.mkdtemp(path.join(withinDirectory, "tmp-dir-"));
}

async function existsPath(pathToCheck: string): Promise<boolean> {
  try {
    await fs.promises.access(pathToCheck);
    return true;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error;
}

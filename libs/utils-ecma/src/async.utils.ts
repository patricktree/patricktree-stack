export const asyncUtils = { wait };

async function wait(waitForMilliseconds: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, waitForMilliseconds);
  });
}

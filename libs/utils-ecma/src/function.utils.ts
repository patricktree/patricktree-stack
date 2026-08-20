export const functions = {
  noop,
  debounce,
  throttle,
};

function noop(): void {}

type ScheduledFunction<ThisType, Parameters extends unknown[]> = (
  this: ThisType,
  ...parameters: Parameters
) => void;

type ScheduledFunctionResult<ThisType, Parameters extends unknown[]> = [
  ScheduledFunction<ThisType, Parameters>,
  () => void,
];

function debounce<ThisType, Parameters extends unknown[]>(
  functionToDebounce: (this: ThisType, ...parameters: Parameters) => unknown,
  limitMilliseconds: number,
): ScheduledFunctionResult<ThisType, Parameters> {
  let lastInvocation: (() => void) | undefined;
  let scheduledTimeoutId: ReturnType<typeof setTimeout> | undefined;

  function runAndClearScheduledInvocation(): void {
    if (scheduledTimeoutId === undefined) {
      return;
    }

    clearTimeout(scheduledTimeoutId);
    scheduledTimeoutId = undefined;

    const invocation = lastInvocation;
    lastInvocation = undefined;
    if (invocation === undefined) {
      throw new Error("Expected a scheduled debounce invocation.");
    }
    invocation();
  }

  function debouncedFunction(this: ThisType, ...parameters: Parameters): void {
    if (scheduledTimeoutId !== undefined) {
      clearTimeout(scheduledTimeoutId);
    }

    lastInvocation = () => functionToDebounce.apply(this, parameters);
    scheduledTimeoutId = setTimeout(runAndClearScheduledInvocation, limitMilliseconds);
  }

  return [debouncedFunction, runAndClearScheduledInvocation];
}

// Based on the non-configurable version from https://stackoverflow.com/a/27078401/1700319
function throttle<ThisType, Parameters extends unknown[]>(
  functionToThrottle: (this: ThisType, ...parameters: Parameters) => unknown,
  limitMilliseconds: number,
): ScheduledFunctionResult<ThisType, Parameters> {
  let lastDiscardedInvocation: (() => void) | undefined;
  let scheduledTimeoutId: ReturnType<typeof setTimeout> | undefined;

  function finishThrottleWindowAndExecuteTrailingCall(): void {
    if (scheduledTimeoutId === undefined) {
      return;
    }

    clearTimeout(scheduledTimeoutId);
    scheduledTimeoutId = undefined;

    const invocation = lastDiscardedInvocation;
    lastDiscardedInvocation = undefined;

    /**
     * If there was a function invocation which was discarded because throttle was active, execute a
     * "trailing call", i.e. execute that function invocation now.
     *
     * Imagine a popover "follows" a moving target by updating its position via a throttled
     * "updatePosition" function and a relatively high "limit" set. If we would not execute the last
     * discarded function invocation, the "updatePosition" invocation which would put the popover in
     * its final position (after the target stopped moving) would not execute - the popover would
     * just "hang" in a wrong position.
     */
    invocation?.();
  }

  function throttledFunction(this: ThisType, ...parameters: Parameters): void {
    if (scheduledTimeoutId === undefined) {
      try {
        functionToThrottle.apply(this, parameters);
      } finally {
        scheduledTimeoutId = setTimeout(
          finishThrottleWindowAndExecuteTrailingCall,
          limitMilliseconds,
        );
      }
      return;
    }

    lastDiscardedInvocation = () => functionToThrottle.apply(this, parameters);
  }

  return [throttledFunction, finishThrottleWindowAndExecuteTrailingCall];
}

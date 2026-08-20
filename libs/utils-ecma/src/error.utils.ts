import { errWithCause } from "pino-std-serializers";

export const errorUtils = {
  serializeErrorWithCause,
  /** @deprecated Use `serializeErrorWithCause` instead. */
  serializeErrorWithClause: serializeErrorWithCause,
};

function serializeErrorWithCause(error: Error): ReturnType<typeof errWithCause> {
  return errWithCause(error);
}

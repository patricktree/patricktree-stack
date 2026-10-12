import React from "react";

export const reactUtils = { createContext, getNodeText };

const SYMBOL_CONTEXT_NOT_FOUND = Symbol("ContextNotFound");
type SYMBOL_CONTEXT_NOT_FOUND = typeof SYMBOL_CONTEXT_NOT_FOUND;

function createContext<ContextValue>(name: string) {
  const Context = React.createContext<ContextValue | SYMBOL_CONTEXT_NOT_FOUND>(
    SYMBOL_CONTEXT_NOT_FOUND,
  );

  function useContextValue() {
    const valueOfContext = React.useContext(Context);
    if (valueOfContext === SYMBOL_CONTEXT_NOT_FOUND) {
      throw new Error(`${name} context is not available`);
    }
    return valueOfContext;
  }

  /* `Provider` captures `Context` from this scope, so it cannot be hoisted out */
  // oxlint-disable-next-line unicorn/consistent-function-scoping
  const Provider: React.FC<{
    children: React.ReactNode;
    value: ContextValue;
  }> = ({ children, value }) => {
    return <Context.Provider value={value}>{children}</Context.Provider>;
  };

  return { useContextValue, Provider };
}

function subscribeToNothing() {
  return () => {};
}

function getIsMountedClientSnapshot() {
  return true;
}

function getIsMountedServerSnapshot() {
  return false;
}

export function useIsMounted() {
  /* the server snapshot is also used while hydrating, so server and client render identically and
     the value only flips to `true` after the client has mounted */
  return React.useSyncExternalStore(
    subscribeToNothing,
    getIsMountedClientSnapshot,
    getIsMountedServerSnapshot,
  );
}

/** Based on https://stackoverflow.com/a/60564620/1700319 */
function getNodeText(node: React.ReactNode): string {
  if (typeof node === "string") {
    return node;
  }
  if (typeof node === "number") {
    return `${node}`;
  }
  if (Array.isArray(node)) {
    return node.map((childNode: React.ReactNode) => getNodeText(childNode)).join("");
  }
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return getNodeText(node.props.children);
  }
  throw new Error(`should not get here`);
}

/**
 * Based on
 * https://github.com/imbhargav5/rooks/blob/76426161edca1f233c8d4dea6ce5e5f97d4ff607/packages/rooks/src/hooks/useMediaMatch.ts
 *
 * A React hook that signals whether or not a media query is matched.
 *
 * @param query The query to observe, such as `print`.
 * @returns If `window` is not defined, `SSR`; otherwise whether the query currently matches.
 */
export function useMediaMatch(query: string): boolean | "SSR" {
  const subscribe = React.useCallback(
    (onStoreChange: () => void) => {
      const matchMedia = window.matchMedia(query);
      if (matchMedia.addEventListener) {
        matchMedia.addEventListener("change", onStoreChange);
        return () => matchMedia.removeEventListener("change", onStoreChange);
      }
      matchMedia.addListener(onStoreChange);
      return () => matchMedia.removeListener(onStoreChange);
    },
    [query],
  );
  const getClientSnapshot = React.useCallback(() => window.matchMedia(query).matches, [query]);

  return React.useSyncExternalStore<boolean | "SSR">(
    subscribe,
    getClientSnapshot,
    getMediaMatchServerSnapshot,
  );
}

function getMediaMatchServerSnapshot() {
  return "SSR" as const;
}

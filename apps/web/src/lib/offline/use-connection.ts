"use client";

import { useSyncExternalStore } from "react";
import { getConnection, subscribeConnection, type ConnectionState } from "./connection";

/**
 * The shared connection state (`connection.ts`), for a screen. The server
 * render and hydration read "connected", so nothing about the connection is
 * painted into the first HTML.
 */
export function useConnection(): ConnectionState {
  return useSyncExternalStore(subscribeConnection, getConnection, () => "connected");
}

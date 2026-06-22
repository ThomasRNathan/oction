"use client";

/**
 * localStorage-backed watchlist of upcoming auctions.
 *
 * We store a SNAPSHOT of the row (not just the id) so the watchlist still
 * renders after a lot leaves the upcoming pool (sold, removed, reported) —
 * the investor wants to remember what they starred even post-auction.
 *
 * Sync model: module-level cache + subscriber set, exposed through
 * useSyncExternalStore. Writes dispatch a custom event so every mounted
 * star/strip re-renders in the same tab; the native "storage" event covers
 * other tabs.
 */

import { useSyncExternalStore } from "react";

export interface WatchedAuction {
  id: number;
  url: string | null;
  city: string | null;
  department: string | null;
  propertyType: string;
  surface: number | null;
  miseAPrix: number;
  auctionDate: string | null;
  dvfExpectedPrice: number | null;
  mapDvfRatio: number | null;
  /** ISO timestamp when starred. */
  addedAt: string;
}

const KEY = "oction:watchlist:v1";
const EVENT = "oction:watchlist-changed";

const EMPTY: WatchedAuction[] = [];

let _snapshot: WatchedAuction[] = EMPTY;
let _loaded = false;

function read(): WatchedAuction[] {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as WatchedAuction[]) : EMPTY;
  } catch {
    return EMPTY;
  }
}

function load(): WatchedAuction[] {
  if (!_loaded) {
    _snapshot = read();
    _loaded = true;
  }
  return _snapshot;
}

function write(next: WatchedAuction[]): void {
  _snapshot = next;
  _loaded = true;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Quota/private-mode failures: keep the in-memory copy so the UI stays
    // coherent for this session.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function getWatchlist(): WatchedAuction[] {
  return load();
}

export function isWatched(id: number): boolean {
  return load().some((w) => w.id === id);
}

export function toggleWatch(item: Omit<WatchedAuction, "addedAt">): void {
  const cur = load();
  if (cur.some((w) => w.id === item.id)) {
    write(cur.filter((w) => w.id !== item.id));
  } else {
    write([{ ...item, addedAt: new Date().toISOString() }, ...cur]);
  }
}

export function removeWatch(id: number): void {
  write(load().filter((w) => w.id !== id));
}

function subscribe(cb: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      _loaded = false; // another tab wrote — re-read on next snapshot
      cb();
    }
  };
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): WatchedAuction[] {
  return load();
}

function getServerSnapshot(): WatchedAuction[] {
  return EMPTY;
}

/** Reactive watchlist. SSR renders the empty list, hydrates to the real one. */
export function useWatchlist(): WatchedAuction[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

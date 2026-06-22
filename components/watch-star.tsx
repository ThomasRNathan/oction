"use client";

import { toggleWatch, useWatchlist, type WatchedAuction } from "@/lib/watchlist";

interface Props {
  item: Omit<WatchedAuction, "addedAt">;
  /** Tailwind size of the star glyph (default text-base). */
  size?: string;
}

/**
 * Star toggle shown on every upcoming-auction row/card. Amber when watched.
 * Reads from the shared watchlist store so all instances stay in sync.
 */
export function WatchStar({ item, size = "text-base" }: Props) {
  const watchlist = useWatchlist();
  const watched = watchlist.some((w) => w.id === item.id);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleWatch(item);
      }}
      aria-pressed={watched}
      aria-label={watched ? "Retirer du suivi" : "Suivre cette vente"}
      title={watched ? "Retirer du suivi" : "Suivre cette vente"}
      className={`${size} leading-none transition-all hover:scale-125 ${
        watched
          ? "text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.45)]"
          : "text-slate-600 hover:text-amber-400/70"
      }`}
    >
      {watched ? "★" : "☆"}
    </button>
  );
}

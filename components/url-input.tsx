"use client";

import { useState } from "react";

interface UrlInputProps {
  onSubmit: (url: string) => void;
  loading: boolean;
}

const LICITOR_RE = /^https?:\/\/(www\.)?licitor\.com\//i;

export function UrlInput({ onSubmit, loading }: UrlInputProps) {
  const [url, setUrl] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onSubmit(url.trim());
    }
  };

  // One-click paste: reads the clipboard and, when it's already a licitor
  // URL, launches the analysis immediately — the most common gesture is
  // copy-from-licitor → switch tab → analyze.
  const handlePaste = async () => {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (!text) return;
      setUrl(text);
      if (LICITOR_RE.test(text)) onSubmit(text);
    } catch {
      // Clipboard permission denied — the user can still paste manually.
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl mx-auto mb-12 animate-fade-up">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Collez une URL licitor.com..."
            className="w-full px-5 py-4 pr-20 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all text-base"
            disabled={loading}
          />
          <button
            type="button"
            onClick={handlePaste}
            disabled={loading}
            title="Coller depuis le presse-papiers"
            className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 text-xs rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition-all"
          >
            Coller
          </button>
        </div>
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="px-8 py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold rounded-xl hover:from-orange-600 hover:to-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all whitespace-nowrap shadow-lg shadow-orange-500/10"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg
                className="animate-spin h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Analyse...
            </span>
          ) : (
            "Analyser"
          )}
        </button>
      </div>
      <p className="text-xs text-slate-600 mt-2 text-center">
        Ex: https://www.licitor.com/annonce/.../108062.html
      </p>
    </form>
  );
}

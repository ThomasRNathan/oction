"use client";

import type { Map as LeafletMap, FeatureGroup, Layer } from "leaflet";
import { useEffect, useRef, useState } from "react";
import type { CalisthenicsSpotEnriched } from "@/lib/calisthenics-parks/types";

type MapMeta = {
  total: number;
  withDetails: number;
  countries: string[];
};

function popupHtml(spot: CalisthenicsSpotEnriched): string {
  const d = spot.detail;
  const equipment =
    d?.equipment?.length ?
      `<p style="margin:4px 0 0;font-size:12px;color:#94a3b8">${d.equipment.slice(0, 6).join(" · ")}${d.equipment.length > 6 ? "…" : ""}</p>`
    : "";
  const rating =
    d?.rating != null ?
      `<span style="color:#fbbf24">★ ${d.rating}/${d.ratingMax}</span>`
    : "";
  const flags = [
    d?.illuminated ? "Éclairé" : null,
    d?.roofed ? "Couvert" : null,
    d?.accessible ? "Accessible" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return `
    <div style="min-width:200px;max-width:280px;font-family:system-ui,sans-serif">
      <strong style="display:block;font-size:14px;line-height:1.3">${escapeHtml(spot.title)}</strong>
      ${spot.address ? `<span style="display:block;margin-top:4px;font-size:12px;color:#64748b">${escapeHtml(spot.address)}</span>` : ""}
      ${rating ? `<div style="margin-top:6px;font-size:12px">${rating}</div>` : ""}
      ${equipment}
      ${flags ? `<p style="margin:4px 0 0;font-size:11px;color:#64748b">${flags}</p>` : ""}
      <a href="${spot.url}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:8px;font-size:12px;color:#f97316">Voir sur Calisthenics Parks →</a>
    </div>
  `;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function SpotMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const clusterRef = useRef<FeatureGroup | null>(null);
  const [meta, setMeta] = useState<MapMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!containerRef.current || mapRef.current) return;

      const L = (await import("leaflet")).default;
      await import("leaflet.markercluster");
      await import("leaflet/dist/leaflet.css");
      await import("leaflet.markercluster/dist/MarkerCluster.css");
      await import("leaflet.markercluster/dist/MarkerCluster.Default.css");

      if (cancelled || !containerRef.current) return;

      const map = L.map(containerRef.current, {
        center: [20, 0],
        zoom: 2,
        minZoom: 2,
        maxZoom: 18,
        worldCopyJump: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      const cluster = (
        L as typeof L & {
          markerClusterGroup: (opts?: object) => FeatureGroup & {
            addLayer: (layer: Layer) => FeatureGroup;
          };
        }
      ).markerClusterGroup({
        chunkedLoading: true,
        chunkInterval: 120,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        maxClusterRadius: 50,
      });

      map.addLayer(cluster);
      mapRef.current = map;
      clusterRef.current = cluster;

      try {
        const res = await fetch("/api/calisthenics");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as {
          spots: CalisthenicsSpotEnriched[];
          meta: MapMeta;
        };
        if (cancelled) return;

        setMeta(data.meta);

        const icon = L.divIcon({
          className: "",
          html: `<span style="display:block;width:12px;height:12px;border-radius:50%;background:linear-gradient(135deg,#f97316,#ef4444);border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></span>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        });

        for (const spot of data.spots) {
          const marker = L.marker([spot.latitude, spot.longitude], { icon });
          marker.bindPopup(popupHtml(spot), { maxWidth: 300 });
          cluster.addLayer(marker);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Erreur de chargement");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void init();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      clusterRef.current = null;
    };
  }, []);

  return (
    <div className="relative flex-1 min-h-0">
      <div ref={containerRef} className="absolute inset-0 z-0" />

      <div className="absolute top-3 left-3 z-[1000] rounded-xl border border-slate-700/80 bg-[#0a0f1a]/90 backdrop-blur px-4 py-3 shadow-lg max-w-xs">
        <h1 className="text-sm font-bold text-white">Street Workout</h1>
        <p className="text-[11px] text-slate-400 mt-0.5">
          {meta ?
            <>
              {meta.total.toLocaleString("fr-FR")} spots · {meta.countries.length}{" "}
              pays
              {meta.withDetails > 0 ?
                <> · {meta.withDetails.toLocaleString("fr-FR")} enrichis</>
              : null}
            </>
          : "Chargement…"}
        </p>
        <p className="text-[10px] text-slate-500 mt-1">
          Source{" "}
          <a
            href="https://calisthenics-parks.com/fr"
            target="_blank"
            rel="noopener noreferrer"
            className="text-orange-400/80 hover:text-orange-300"
          >
            calisthenics-parks.com
          </a>
        </p>
      </div>

      {loading ?
        <div className="absolute inset-0 z-[999] flex items-center justify-center bg-[#0a0f1a]/60 backdrop-blur-sm pointer-events-none">
          <div className="rounded-xl border border-slate-700 bg-slate-900/90 px-5 py-4 text-sm text-slate-300">
            Chargement de la carte…
          </div>
        </div>
      : null}

      {error ?
        <div className="absolute bottom-3 left-3 right-3 z-[1000] rounded-lg border border-red-500/40 bg-red-950/80 px-4 py-2 text-sm text-red-200">
          {error}
        </div>
      : null}
    </div>
  );
}

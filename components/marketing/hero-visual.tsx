/**
 * "Signal from noise" — the hero data-visual.
 *
 * A deterministic phyllotaxis scatter: ~150 dim nodes (the raw, undifferentiated
 * flux of judicial sales) out of which a handful of bright, slowly-twinkling
 * nodes emerge (the lots the algorithm surfaces). No randomness, so it renders
 * identically on server and client; motion is pure CSS and respects
 * prefers-reduced-motion.
 */
const GOLDEN = Math.PI * (3 - Math.sqrt(5)); // ~137.5°, the phyllotaxis angle
const CX = 200;
const CY = 200;
const MAX_R = 186;
const N = 150;

const POINTS = Array.from({ length: N }, (_, i) => {
  const r = MAX_R * Math.sqrt((i + 0.5) / N);
  const a = i * GOLDEN;
  return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a), r };
});

// Hand-picked indices spread across the field so highlighted nodes feel balanced.
const SIGNAL = [7, 18, 31, 44, 59, 73, 88, 101, 116, 128, 139, 147];
const SIGNAL_SET = new Set(SIGNAL);

export function HeroVisual({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 400"
      className={className}
      role="img"
      aria-label="Représentation abstraite : quelques lots sélectionnés se détachent d'un flux de ventes."
      fill="none"
    >
      <defs>
        <radialGradient id="hv-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f97316" stopOpacity="0.16" />
          <stop offset="55%" stopColor="#f97316" stopOpacity="0.04" />
          <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
        </radialGradient>
        <filter id="hv-soft" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      {/* central glow */}
      <circle cx={CX} cy={CY} r={180} fill="url(#hv-glow)" />

      {/* concentric guide rings */}
      {[62, 116, 170].map((r) => (
        <circle key={r} cx={CX} cy={CY} r={r} stroke="#94a3b8" strokeOpacity="0.06" />
      ))}

      {/* faint links from a few signal nodes toward the core */}
      {SIGNAL.slice(0, 6).map((i) => (
        <line
          key={`l-${i}`}
          x1={CX}
          y1={CY}
          x2={POINTS[i].x}
          y2={POINTS[i].y}
          stroke="#f97316"
          strokeOpacity="0.12"
        />
      ))}

      {/* noise nodes */}
      {POINTS.map((p, i) =>
        SIGNAL_SET.has(i) ? null : (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={1.25}
            fill="#94a3b8"
            fillOpacity={0.1 + 0.22 * (1 - p.r / MAX_R)}
          />
        )
      )}

      {/* signal nodes: blurred halo + twinkling core */}
      {SIGNAL.map((i, k) => {
        const p = POINTS[i];
        return (
          <g key={`s-${i}`}>
            <circle cx={p.x} cy={p.y} r={6.5} fill="#fb923c" fillOpacity="0.22" filter="url(#hv-soft)" />
            <circle
              cx={p.x}
              cy={p.y}
              r={2.7}
              fill="#fb923c"
              className="twinkle"
              style={{ animationDelay: `${(k % 6) * 0.45}s` }}
            />
          </g>
        );
      })}
    </svg>
  );
}

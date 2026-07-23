"use client";

import { useMemo, useState } from "react";
import type { TokenRatePoint } from "./data";

interface Props {
  points: TokenRatePoint[];
}

const WIDTH = 720;
const HEIGHT = 220;
const PAD = { top: 16, right: 16, bottom: 28, left: 44 };

export function TokenRateChart({ points }: Props): JSX.Element {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const { path, dots, yTicks, xForIndex, yForRate, minRate, maxRate } = useMemo(() => {
    const rates = points.map((p) => p.ratePaise);
    const min = Math.min(...rates, 0);
    const max = Math.max(...rates, 1);
    const span = max - min || 1;
    const innerW = WIDTH - PAD.left - PAD.right;
    const innerH = HEIGHT - PAD.top - PAD.bottom;

    const xForIndex = (i: number) =>
      points.length <= 1 ? PAD.left : PAD.left + (i / (points.length - 1)) * innerW;
    const yForRate = (rate: number) => PAD.top + innerH - ((rate - min) / span) * innerH;

    const d = points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${xForIndex(i).toFixed(1)} ${yForRate(p.ratePaise).toFixed(1)}`)
      .join(" ");

    const tickCount = 4;
    const yTicks = Array.from({ length: tickCount + 1 }, (_, i) => min + (span * i) / tickCount);

    return {
      path: d,
      dots: points.map((p, i) => ({ x: xForIndex(i), y: yForRate(p.ratePaise) })),
      yTicks,
      xForIndex,
      yForRate,
      minRate: min,
      maxRate: max,
    };
  }, [points]);

  if (points.length === 0) {
    return <p className="empty">No token-rate history yet — run the fixing job.</p>;
  }

  const hovered = hoverIndex !== null ? points[hoverIndex] : null;

  return (
    <div className="chartWrap">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="Token rate over time, in paise per token"
        onMouseLeave={() => setHoverIndex(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const relX = ((e.clientX - rect.left) / rect.width) * WIDTH;
          let nearest = 0;
          let nearestDist = Infinity;
          dots.forEach((d, i) => {
            const dist = Math.abs(d.x - relX);
            if (dist < nearestDist) {
              nearestDist = dist;
              nearest = i;
            }
          });
          setHoverIndex(nearest);
        }}
      >
        {yTicks.map((t, i) => {
          const y = yForRate(t);
          return (
            <g key={i}>
              <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y} y2={y} className="gridline" />
              <text x={PAD.left - 8} y={y} className="axisLabel" textAnchor="end" dominantBaseline="middle">
                {Math.round(t)}
              </text>
            </g>
          );
        })}

        <path d={path} className="line" fill="none" />

        {dots.length > 0 && (
          <circle cx={dots[dots.length - 1].x} cy={dots[dots.length - 1].y} r={4} className="endDot" />
        )}

        {hovered && hoverIndex !== null && (
          <>
            <line
              x1={dots[hoverIndex].x}
              x2={dots[hoverIndex].x}
              y1={PAD.top}
              y2={HEIGHT - PAD.bottom}
              className="crosshair"
            />
            <circle cx={dots[hoverIndex].x} cy={dots[hoverIndex].y} r={4} className="hoverDot" />
          </>
        )}
      </svg>

      <div className="tooltip" aria-live="polite">
        {hovered ? (
          <>
            <span className="tooltipRate">₹{(hovered.ratePaise / 100).toFixed(2)}</span>
            <span className="tooltipDate">{new Date(hovered.computedAt).toLocaleString()}</span>
            <span className="tooltipInputs">
              demand {hovered.inputs.demandPressure.toFixed(2)} · sales{" "}
              {hovered.inputs.realisedSalesVelocity.toFixed(2)} · competition{" "}
              {hovered.inputs.supplierCompetition.toFixed(2)}
            </span>
          </>
        ) : (
          <span className="tooltipHint">Hover the line for a point's inputs</span>
        )}
      </div>

      <style>{`
        .chartWrap { --series-1: #2a78d6; --gridline: #e1e0d9; --muted: #898781; --primary: #0b0b0b; --secondary: #52514e; }
        @media (prefers-color-scheme: dark) {
          .chartWrap { --series-1: #3987e5; --gridline: #2c2c2a; --muted: #898781; --primary: #ffffff; --secondary: #c3c2b7; }
        }
        :root[data-theme="dark"] .chartWrap { --series-1: #3987e5; --gridline: #2c2c2a; --primary: #ffffff; --secondary: #c3c2b7; }
        :root[data-theme="light"] .chartWrap { --series-1: #2a78d6; --gridline: #e1e0d9; --primary: #0b0b0b; --secondary: #52514e; }
        .chartWrap svg { width: 100%; height: auto; cursor: crosshair; }
        .gridline { stroke: var(--gridline); stroke-width: 1; }
        .axisLabel { font-size: 10px; fill: var(--muted); font-variant-numeric: tabular-nums; }
        .line { stroke: var(--series-1); stroke-width: 2; stroke-linecap: round; }
        .endDot { fill: var(--series-1); }
        .crosshair { stroke: var(--muted); stroke-width: 1; stroke-dasharray: 3 3; }
        .hoverDot { fill: var(--series-1); stroke: var(--primary); stroke-width: 1.5; }
        .tooltip { margin-top: 10px; font-size: 12.5px; color: var(--secondary); display: flex; gap: 12px; flex-wrap: wrap; align-items: baseline; min-height: 18px; }
        .tooltipRate { font-weight: 700; color: var(--primary); font-variant-numeric: tabular-nums; }
        .tooltipDate { font-variant-numeric: tabular-nums; }
        .tooltipHint { color: var(--muted); font-style: italic; }
        .empty { color: var(--muted); font-size: 13px; }
      `}</style>
    </div>
  );
}

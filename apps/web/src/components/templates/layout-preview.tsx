"use client";

import type { LayoutConfig } from "@lumora/contracts";
import { resolvePhysicalSlots } from "@lumora/contracts";

/** Miniature SVG rendering of a layout's slot geometry (FR-07 preview). */
export function LayoutPreview({ config, className }: { config: LayoutConfig; className?: string }) {
  const slots = resolvePhysicalSlots(config);
  const { width, height } = config.canvas;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={className} role="img" aria-label="Layout preview">
      <rect x={0} y={0} width={width} height={height} fill={config.background} stroke="hsl(var(--border))" strokeWidth={width / 150} />
      {slots.map((s, i) => (
        <rect
          key={i}
          x={s.x}
          y={s.y}
          width={s.w}
          height={s.h}
          rx={s.radius}
          fill="hsl(var(--muted))"
          stroke="hsl(var(--muted-foreground))"
          strokeWidth={width / 300}
        />
      ))}
    </svg>
  );
}

"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from "@lumora/ui";

/**
 * Chart building blocks following the dataviz method:
 * single-series forms only (no legend needed), one validated accent hue
 * from --chart-1, thin marks with 4px rounded data-ends, recessive grid,
 * text in ink tokens, tooltip on hover.
 */

const ACCENT = "var(--chart-1)";
const GRID = "hsl(var(--border))";
const INK_MUTED = "hsl(var(--muted-foreground))";

export function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
        {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

export function StatTileSkeleton() {
  return (
    <Card>
      <CardContent className="space-y-2 p-5">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-7 w-16" />
      </CardContent>
    </Card>
  );
}

const tooltipStyle: React.CSSProperties = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
  color: "hsl(var(--popover-foreground))",
  boxShadow: "0 4px 12px -2px rgb(16 24 40 / 0.12)",
};

export function SessionsOverTimeChart({
  data,
  title = "Sessions — last 30 days",
}: {
  data: Array<{ date: string; count: number }>;
  title?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-64 pt-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <defs>
              <linearGradient id="sessionsFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={ACCENT} stopOpacity={0.22} />
                <stop offset="100%" stopColor={ACCENT} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={GRID} strokeDasharray="0" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: INK_MUTED }}
              tickLine={false}
              axisLine={{ stroke: GRID }}
              tickFormatter={(d: string) => d.slice(5)}
              minTickGap={24}
            />
            <YAxis tick={{ fontSize: 11, fill: INK_MUTED }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: INK_MUTED, strokeWidth: 1 }} />
            <Area
              type="monotone"
              dataKey="count"
              name="Sessions"
              stroke={ACCENT}
              strokeWidth={2}
              fill="url(#sessionsFill)"
              dot={false}
              activeDot={{ r: 4 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function CategoryBarChart({
  title,
  data,
}: {
  title: string;
  data: Array<{ name: string; count: number }>;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-64 pt-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 0, left: 8 }} barSize={14}>
            <CartesianGrid stroke={GRID} horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: INK_MUTED }} tickLine={false} axisLine={false} allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="name"
              width={104}
              tick={{ fontSize: 11, fill: INK_MUTED }}
              tickLine={false}
              axisLine={{ stroke: GRID }}
            />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--muted))" }} />
            <Bar dataKey="count" name="Count" fill={ACCENT} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

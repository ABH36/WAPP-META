"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface ChartDatum {
  label: string;
  value: number;
}

const COLORS = ["#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6", "#ec4899"];
const AXIS_COLOR = "#71717a"; // neutral-500 — readable in both light and dark themes

/**
 * DS-001 §10 — Recharts (via shadcn `chart`), the pre-approved chart
 * library, installed for the first time this volume (FRD-001 Volume-5).
 * One flexible primitive (bar/line/pie) covers all 5 chart types §10
 * names (Revenue Trend, Pipeline Distribution, Deal Stage, Lead Sources,
 * Activity Timeline) rather than 5 bespoke components — each screen picks
 * the right `type` and passes already-computed `{label, value}` pairs.
 * Charts render backend data directly; no business calculation happens
 * here (BR-009).
 */
export interface RevenueChartProps {
  type: "bar" | "line" | "pie";
  data: ChartDatum[];
  height?: number;
  valueFormatter?: (value: number) => string;
}

export function RevenueChart({
  type,
  data,
  height = 260,
  valueFormatter,
}: RevenueChartProps): React.JSX.Element {
  const format = valueFormatter ?? ((value: number) => value.toLocaleString());

  if (data.length === 0) {
    return (
      <div
        className="text-body-sm flex items-center justify-center text-neutral-500 dark:text-neutral-400"
        style={{ height }}
      >
        No data available
      </div>
    );
  }

  if (type === "pie") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            cx="50%"
            cy="50%"
            outerRadius={height / 2 - 20}
          >
            {data.map((entry, index) => (
              <Cell key={entry.label} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value: number) => format(value)} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (type === "line") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={AXIS_COLOR} opacity={0.2} />
          <XAxis dataKey="label" stroke={AXIS_COLOR} fontSize={12} />
          <YAxis stroke={AXIS_COLOR} fontSize={12} tickFormatter={format} />
          <Tooltip formatter={(value: number) => format(value)} />
          <Line type="monotone" dataKey="value" stroke={COLORS[0]} strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={AXIS_COLOR} opacity={0.2} />
        <XAxis dataKey="label" stroke={AXIS_COLOR} fontSize={12} />
        <YAxis stroke={AXIS_COLOR} fontSize={12} tickFormatter={format} />
        <Tooltip formatter={(value: number) => format(value)} />
        <Bar dataKey="value" fill={COLORS[0]} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

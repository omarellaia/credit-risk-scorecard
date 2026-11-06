"use client";
import { Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { num, pct, musd } from "@/lib/format";

const tip = { contentStyle: { background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 6, color: "var(--ink)", fontSize: 12 }, labelStyle: { color: "var(--ink)" } };
const axis = { tick: { fill: "var(--muted)", fontSize: 11 }, axisLine: { stroke: "var(--line)" }, tickLine: false } as const;

export function CalibrationChart({ data }: { data: { band: string; predicted: number; observed: number; n: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
        <CartesianGrid stroke="var(--line)" vertical={false} />
        <XAxis dataKey="band" {...axis} />
        <YAxis {...axis} tickFormatter={(v) => `${Math.round(v * 100)} %`} width={44} />
        <Tooltip {...tip} formatter={(v: number, n) => [pct(v, 1), n]} labelFormatter={(l, p) => `Score ${l} · ${num((p?.[0]?.payload as { n: number })?.n)} prêts`} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="observed" name="Taux de défaut observé" fill="var(--c2)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
        <Line dataKey="predicted" name="PD prédite" stroke="var(--bad)" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function VintageChart({ data }: { data: { year: number; gini: number; default_rate: number; pd_mean: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
        <CartesianGrid stroke="var(--line)" vertical={false} />
        <XAxis dataKey="year" {...axis} />
        <YAxis {...axis} tickFormatter={(v) => `${Math.round(v * 100)} %`} width={44} />
        <Tooltip {...tip} formatter={(v: number, n) => [n === "Gini" ? num(v, 3) : pct(v, 1), n]} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="default_rate" name="Taux de défaut" fill="var(--c3)" isAnimationActive={false} />
        <Line dataKey="pd_mean" name="PD moyenne" stroke="var(--bad)" strokeWidth={2} isAnimationActive={false} />
        <Line dataKey="gini" name="Gini" stroke="var(--c1)" strokeWidth={2} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function LossChart({ data, cutoff }: { data: { band: number; el: number; realised: number }[]; cutoff?: number }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
        <CartesianGrid stroke="var(--line)" vertical={false} />
        <XAxis dataKey="band" {...axis} />
        <YAxis {...axis} tickFormatter={(v) => `${Math.round(v / 1e6)}`} width={36} />
        <Tooltip {...tip} formatter={(v: number, n) => [musd(v), n]} labelFormatter={(l) => `Score ${l}–${Number(l) + 10}`} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="el" name="Perte attendue (M$)" fill="var(--c1)" isAnimationActive={false} />
        <Bar dataKey="realised" name="Perte réalisée (M$)" fill="var(--c2)" isAnimationActive={false} />
        {cutoff !== undefined && <ReferenceLine x={cutoff} stroke="var(--bad)" strokeDasharray="4 3" label={{ value: "seuil", fill: "var(--bad)", fontSize: 11, position: "top" }} />}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PointsChart({ data }: { data: { name: string; points: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={40 + data.length * 30}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
        <CartesianGrid stroke="var(--line)" horizontal={false} />
        <XAxis type="number" {...axis} />
        <YAxis type="category" dataKey="name" width={150} tick={{ fill: "var(--ink)", fontSize: 11 }} axisLine={false} tickLine={false} />
        <ReferenceLine x={0} stroke="var(--ink)" />
        <Tooltip {...tip} formatter={(v: number) => [num(v, 1), "points"]} />
        <Bar dataKey="points" fill="var(--c1)" isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

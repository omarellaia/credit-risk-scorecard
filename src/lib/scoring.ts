import type { Bin, Inputs, Scorecard, Variable } from "./types";
import { normCdf, normInv } from "./normal";

const isMissing = (x: unknown) => x === null || x === undefined || x === "" || (typeof x === "number" && Number.isNaN(x));

/** Same rule as pipeline/binning.py: numeric bin k covers [cuts[k-1], cuts[k]); missing → last bin. */
export function binIndex(v: Variable, x: number | string | null | undefined): number {
  if (v.type === "numeric") {
    if (isMissing(x)) return v.bins.length - 1;
    const val = Number(x);
    const cuts = v.cuts ?? [];
    let k = 0;
    while (k < cuts.length && val >= cuts[k]) k++;
    return k;
  }
  const key = isMissing(x) ? "Missing" : String(x);
  const i = v.bins.findIndex((b) => b.categories?.includes(key));
  return i >= 0 ? i : v.bins.findIndex((b) => b.categories?.includes("__other__"));
}

export interface ScoreResult {
  score: number;
  pd: number;
  odds: number;
  contributions: { name: string; bin: Bin; binIndex: number; points: number }[];
}

/** Score = base points + Σ points of the borrower's bin for each variable. */
export function scoreBorrower(card: Scorecard, inputs: Inputs): ScoreResult {
  const contributions = card.variables.map((v) => {
    const i = binIndex(v, inputs[v.name]);
    return { name: v.name, bin: v.bins[i], binIndex: i, points: v.bins[i].points };
  });
  const score = card.base_points + contributions.reduce((s, c) => s + c.points, 0);
  const odds = Math.exp((score - card.scaling.offset) / card.scaling.factor);
  return { score, odds, pd: Math.max(1 / (1 + odds), card.pd_floor), contributions };
}

export function scoreToPd(card: Scorecard, score: number): number {
  return Math.max(1 / (1 + Math.exp((score - card.scaling.offset) / card.scaling.factor)), card.pd_floor);
}

/** Basel IRB, other retail: correlation R(PD) and capital K per unit of EAD; RWA = K × 12.5 × EAD. */
export function irbOtherRetail(pd: number, lgd: number): { r: number; k: number } {
  const w = (1 - Math.exp(-35 * pd)) / (1 - Math.exp(-35));
  const r = 0.03 * w + 0.16 * (1 - w);
  const k = lgd * (normCdf((normInv(pd) + Math.sqrt(r) * normInv(0.999)) / Math.sqrt(1 - r)) - pd);
  return { r, k };
}

/** Out-of-range warnings against the training distribution (1st–99th percentile). */
export function rangeWarnings(card: Scorecard, inputs: Inputs): string[] {
  const out: string[] = [];
  for (const v of card.variables) {
    const r = card.ranges[v.name];
    const x = inputs[v.name];
    if (v.type === "numeric" && !isMissing(x) && r?.p01 !== undefined && r.p99 !== undefined) {
      const val = Number(x);
      if (val < r.p01 || val > r.p99) out.push(v.name);
    }
  }
  return out;
}

import { describe, expect, it } from "vitest";
import fixtures from "@data/fixtures.json";
import { card, portfolioData, metricsData, calibrationData } from "@/lib/data";
import { binIndex, irbOtherRetail, rangeWarnings, scoreBorrower, scoreToPd } from "@/lib/scoring";
import { normCdf, normInv } from "@/lib/normal";
import { cutoffStats } from "@/lib/portfolio";

type Fx = { id: string; inputs: Record<string, number | string | null>; bins: Record<string, number>; points: Record<string, number>; score: number; pd: number; lgd: number; k: number; r: number };
const FX = fixtures as Fx[];

describe("TypeScript scoring reproduces the Python scores (fixtures.json)", () => {
  it("has fixtures", () => expect(FX.length).toBeGreaterThanOrEqual(20));
  for (const f of FX) {
    it(`borrower ${f.id}`, () => {
      const r = scoreBorrower(card, f.inputs);
      for (const c of r.contributions) {
        expect(c.binIndex).toBe(f.bins[c.name]);
        expect(c.points).toBeCloseTo(f.points[c.name], 9);
      }
      expect(r.score).toBeCloseTo(f.score, 9);
      expect(r.pd).toBeCloseTo(f.pd, 12);
      const irb = irbOtherRetail(f.pd, f.lgd);
      expect(irb.r).toBeCloseTo(f.r, 12);
      expect(irb.k).toBeCloseTo(f.k, 9);
    });
  }
});

describe("normal distribution", () => {
  it("cdf and inverse", () => {
    expect(normCdf(0)).toBeCloseTo(0.5, 15);
    expect(normCdf(1.959963984540054)).toBeCloseTo(0.975, 12);
    expect(normInv(0.999)).toBeCloseTo(3.090232306167813, 10);
    for (const p of [1e-6, 0.01, 0.3, 0.5, 0.77, 0.999999]) expect(normCdf(normInv(p))).toBeCloseTo(p, 12);
  });
});

describe("scorecard behaviour", () => {
  it("missing numeric goes to the Missing bin; unseen category to the __other__ group", () => {
    const num = card.variables.find((v) => v.type === "numeric")!;
    expect(binIndex(num, null)).toBe(num.bins.length - 1);
    const cat = card.variables.find((v) => v.type === "categorical")!;
    expect(cat.bins[binIndex(cat, "not-a-real-category")].categories).toContain("__other__");
  });
  it("PD floor and scaling anchor", () => {
    expect(scoreToPd(card, 10_000)).toBe(card.pd_floor);
    const p = scoreToPd(card, card.scaling.base_score);
    expect((1 - p) / p).toBeCloseTo(card.scaling.base_odds, 9);
  });
  it("flags inputs outside the training 1st–99th percentile", () => {
    const fico = card.variables.find((v) => v.name === "fico");
    if (fico) expect(rangeWarnings(card, { fico: 100 })).toContain("fico");
  });
});

describe("portfolio cut-off", () => {
  const b = portfolioData.bands;
  it("lowest cut-off approves everything", () => {
    const s = cutoffStats(b, -Infinity);
    expect(s.approvalRate).toBe(1);
    expect(s.el).toBeCloseTo(portfolioData.totals.el, 4);
    expect(s.rwa).toBeCloseTo(portfolioData.totals.rwa, 4);
  });
  it("raising the cut-off lowers approval and the bad rate", () => {
    const lo = cutoffStats(b, 520), hi = cutoffStats(b, 560);
    expect(hi.approvalRate).toBeLessThan(lo.approvalRate);
    expect(hi.badRate!).toBeLessThan(lo.badRate!);
  });
});

describe("exported metrics", () => {
  it("train mean PD equals the long-run default rate (calibration)", () => {
    expect(metricsData.sets.train.pd_mean).toBeCloseTo(calibrationData.long_run_default_rate, 4);
  });
});

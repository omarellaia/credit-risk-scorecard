import type { PortfolioBand } from "./types";

/** Approve every loan whose score band starts at or above the cut-off. */
export function cutoffStats(bands: PortfolioBand[], cutoff: number) {
  const all = bands.reduce((s, b) => ({ n: s.n + b.n, bads: s.bads + b.bads, amount: s.amount + b.amount }), { n: 0, bads: 0, amount: 0 });
  const kept = bands.filter((b) => b.lo >= cutoff);
  const k = kept.reduce((s, b) => ({ n: s.n + b.n, bads: s.bads + b.bads, amount: s.amount + b.amount, ead: s.ead + b.ead, el: s.el + b.el, realised: s.realised + b.realised_loss, rwa: s.rwa + b.rwa }),
    { n: 0, bads: 0, amount: 0, ead: 0, el: 0, realised: 0, rwa: 0 });
  return {
    approvalRate: all.n ? k.n / all.n : 0,
    badRate: k.n ? k.bads / k.n : null,
    badRateAll: all.n ? all.bads / all.n : 0,
    approved: k.n, amount: k.amount, el: k.el, elRate: k.ead ? k.el / k.ead : null, realised: k.realised, rwa: k.rwa,
    rejectedBads: all.bads - k.bads,
  };
}

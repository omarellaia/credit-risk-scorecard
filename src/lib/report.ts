import { calibrationData as CAL, card, label, metricsData as M, portfolioData as P, summaryData as S } from "@/lib/data";
import { dec, musd, num, pct } from "@/lib/format";
import { cutoffStats } from "@/lib/portfolio";

const row = (c: string[]) => `| ${c.join(" | ")} |`;
const table = (h: string[], rows: string[][]) => [row(h), row(h.map(() => "---")), ...rows.map(row)].join("\n");
const STEP_FR: Record<string, string> = {
  "raw rows": "Lignes du fichier", "outside credit policy removed": "Hors politique de crédit de Lending Club retirés",
  "joint applications removed": "Demandes jointes retirées", "term not complete by 2018-12 removed": "Échéance non atteinte fin 2018 retirés",
  "outcome unknown (current/late) removed": "Issue inconnue (en cours, en retard) retirés",
};

/** Every figure the report cites, read from the exported JSON files. Placeholders are {{name}}. */
export function reportValues(): Record<string, string> {
  const v: Record<string, string> = {};
  const t = M.sets.test, tr = M.sets.train, va = M.sets.validation;
  for (const [k, s] of [["train", tr], ["valid", va], ["test", t]] as const) {
    v[`${k}_gini`] = dec(s.gini); v[`${k}_ks`] = dec(s.ks); v[`${k}_auc`] = dec(s.auc); v[`${k}_n`] = num(s.n); v[`${k}_dr`] = pct(s.default_rate); v[`${k}_pd`] = pct(s.pd_mean);
    v[`${k}_years`] = s.years.length > 1 ? `${s.years[0]}–${s.years.at(-1)}` : String(s.years[0]);
  }
  v.gini_drop = dec(tr.gini - t.gini); v.psi_test = dec(M.stability.test.psi, 4); v.psi_valid = dec(M.stability.validation.psi, 4);
  v.psi_reading = M.stability.test.psi < 0.1 ? "stable (sous 0,1)" : M.stability.test.psi < 0.25 ? "en dérive modérée" : "en forte dérive";
  v.n_vars = String(card.variables.length); v.var_list = card.variables.map((x) => label(x.name)).join(", ");
  v.n_candidates = String(card.all_variables.length);
  v.long_run = pct(CAL.long_run_default_rate, 2); v.dev_years = `${CAL.development_years[0]}–${CAL.development_years.at(-1)}`; v.shift = dec(CAL.shift, 4);
  v.base_score = String(card.scaling.base_score); v.base_odds = String(card.scaling.base_odds); v.pdo = String(card.scaling.pdo);
  v.factor = dec(card.scaling.factor, 4); v.offset = dec(card.scaling.offset, 4); v.base_points = num(card.base_points, 2); v.pd_floor = pct(card.pd_floor, 2);
  v.raw_rows = num(S.steps[0].rows); v.final_rows = num(S.steps.at(-1)!.rows); v.n36 = num(t.n + tr.n + va.n);
  v.pred_vs_obs_test = `${pct(t.pd_mean)} prédite contre ${pct(t.default_rate)} observée`;
  v.calib_gap = pct(t.default_rate - t.pd_mean, 1);
  v.el = musd(P.totals.el); v.realised = musd(P.totals.realised_loss); v.ead = musd(P.totals.ead); v.amount = musd(P.totals.amount); v.rwa = musd(P.totals.rwa);
  v.el_rate = pct(P.totals.el / P.totals.ead, 2); v.realised_rate = pct(P.totals.realised_loss / P.totals.ead, 2); v.el_vs_realised = pct(P.totals.el / P.totals.realised_loss - 1, 0);
  v.rwa_density = pct(P.totals.rwa / P.totals.ead, 0); v.capital_8 = musd(P.totals.rwa * 0.08);
  v.lgd = pct(P.lgd_ead.lgd_mean, 1); v.ead_ratio = pct(P.lgd_ead.ead_ratio_mean, 1); v.n_defaults_dev = num(P.lgd_ead.n_defaults);
  const c = cutoffStats(P.bands, 530);
  v.cut530_approval = pct(c.approvalRate, 0); v.cut530_bad = pct(c.badRate, 1); v.all_bad = pct(c.badRateAll, 1);

  v["table:steps"] = table(["Étape", "Prêts restants"], S.steps.map((s) => [STEP_FR[s.step] ?? s.step, num(s.rows)]));
  v["table:years"] = table(["Année d'émission", "Prêts (36 et 60 mois)", "Taux de défaut"], Object.keys(S.default_rate_by_year).map((y) => [y, num(S.loans_by_year[y]), pct(S.default_rate_by_year[y])]));
  v["table:iv"] = table(["Variable", "IV", "Décision"], card.all_variables.map((a) => {
    const k = card.variables.find((x) => x.name === a.name); const ex = card.excluded.find((x) => x.variable === a.name);
    return [label(a.name), dec(a.iv, 4), k ? `retenue, β = ${dec(k.coef, 3)}` : ex?.reason ?? ""];
  }));
  v["table:points"] = card.variables.map((x) => `**${label(x.name)}** (IV ${dec(x.iv, 3)})\n\n` + table(["Classe", "Part", "Taux de défaut", "WoE", "Points"],
    x.bins.map((b) => [b.label, pct(b.n / x.bins.reduce((s, y) => s + y.n, 0)), pct(b.bad_rate), dec(b.woe, 3), num(b.points, 1)]))).join("\n\n");
  v["table:signs"] = table(["Variable", "Taux de défaut de la classe la plus sûre → la plus risquée", "Lecture"], card.variables.map((x) => {
    const obs = x.bins.filter((b) => b.n > 0); const lo = Math.min(...obs.map((b) => b.bad_rate)), hi = Math.max(...obs.map((b) => b.bad_rate));
    return [label(x.name), `${pct(lo)} → ${pct(hi)}`, x.coef < 0 ? "signe attendu" : "signe inattendu"];
  }));
  v["table:metrics"] = table(["Mesure", `Entraînement ${v.train_years}`, `Validation ${v.valid_years}`, `Test ${v.test_years}`], [
    ["Prêts", v.train_n, v.valid_n, v.test_n], ["Taux de défaut observé", v.train_dr, v.valid_dr, v.test_dr], ["PD moyenne prédite", v.train_pd, v.valid_pd, v.test_pd],
    ["AUC", v.train_auc, v.valid_auc, v.test_auc], ["**Gini**", `**${v.train_gini}**`, `**${v.valid_gini}**`, `**${v.test_gini}**`], ["KS", v.train_ks, v.valid_ks, v.test_ks],
    ["PSI contre entraînement", "—", v.psi_valid, v.psi_test],
  ]);
  v["table:calibration"] = table(["Score", "Prêts", "PD prédite", "Défaut observé"], CAL.bands.test.map((b) => [`${b.lo}–${b.hi}`, num(b.n), pct(b.pd_mean), pct(b.observed)]));
  v["table:vintage"] = table(["Millésime", "Prêts", "Taux de défaut", "PD moyenne", "Gini"], M.by_vintage.map((b) => [String(b.year), num(b.n), pct(b.default_rate), pct(b.pd_mean), dec(b.gini)]));
  v["table:lgd"] = table(["Montant", "Défauts", "LGD", "EAD / montant"], P.lgd_ead.bands.map((b) => [b.label, num(b.n), pct(b.lgd), pct(b.ead_ratio)]));
  v["table:loss"] = table(["Score", "Prêts", "EAD", "Perte attendue", "Perte réalisée", "RWA"], P.bands.map((b) => [`${b.lo}–${b.hi}`, num(b.n), musd(b.ead, 2), musd(b.el, 2), musd(b.realised_loss, 2), musd(b.rwa, 2)]));
  return v;
}

export function fillReport(md: string, values = reportValues()): string {
  return md.replace(/\{\{([a-z0-9_:]+)\}\}/g, (_, k: string) => {
    if (!(k in values)) throw new Error(`report.md: unknown placeholder {{${k}}}`);
    return values[k];
  });
}

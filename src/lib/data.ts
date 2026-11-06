import scorecard from "@data/scorecard.json";
import metrics from "@data/metrics.json";
import calibration from "@data/calibration.json";
import portfolio from "@data/portfolio_bands.json";
import summary from "@data/data_summary.json";
import type { PortfolioBand, Scorecard } from "./types";

export const card = scorecard as unknown as Scorecard;
type SetMetrics = { n: number; bads: number; default_rate: number; auc: number; gini: number; ks: number; pd_mean: number; score_mean: number; years: number[] };
export const metricsData = metrics as unknown as {
  sets: Record<"train" | "validation" | "test", SetMetrics>;
  stability: Record<"validation" | "test", { psi: number; cuts: number[]; expected: number[]; actual: number[] }>;
  by_vintage: (SetMetrics & { year: number })[];
};
export const calibrationData = calibration as unknown as {
  long_run_default_rate: number; shift: number; development_years: number[];
  bands: Record<"train" | "validation" | "test", { lo: number; hi: number; n: number; pd_mean: number; observed: number }[]>;
};
export const portfolioData = portfolio as unknown as {
  band_width: number; set: string; years: number[]; bands: PortfolioBand[];
  totals: { n: number; amount: number; ead: number; el: number; realised_loss: number; rwa: number; pd_mean: number; observed: number };
  lgd_ead: { n_defaults: number; lgd_mean: number; ead_ratio_mean: number; bands: { label: string; lo: number; hi: number | null; n: number; lgd: number; ead_ratio: number }[] };
};
export const summaryData = summary as unknown as {
  steps: { step: string; rows: number }[]; status_dropped: Record<string, number>; default_rate_by_year: Record<string, number>; loans_by_year: Record<string, number>;
  default_rate_by_year_term: Record<string, number>; term_months: number; train_years: number[]; valid_years: number[]; test_years: number[];
  default_statuses: string[]; good_statuses: string[]; excluded_lc_risk: string[]; excluded_post_origination: string[]; excluded_partial_history: string[];
  n_36m_by_set: Record<string, number>;
};

export const LABELS: Record<string, string> = {
  fico: "Score FICO (milieu de fourchette)", annual_inc: "Revenu annuel ($)", dti: "Taux d'endettement (DTI, %)", revol_util: "Utilisation du crédit renouvelable (%)",
  inq_last_6mths: "Demandes de crédit (6 derniers mois)", home_ownership: "Logement", purpose: "Objet du prêt", loan_amnt: "Montant du prêt ($)",
  credit_history_months: "Ancienneté de l'historique de crédit (mois)", addr_state: "État", total_acc: "Nombre total de comptes", emp_length_years: "Ancienneté dans l'emploi (ans)",
  revol_bal: "Solde renouvelable ($)", mort_acc: "Prêts immobiliers", verification_status: "Vérification du revenu", pub_rec_bankruptcies: "Faillites publiques",
  pub_rec: "Incidents publics", mths_since_last_delinq: "Mois depuis le dernier retard", open_acc: "Comptes ouverts", delinq_2yrs: "Retards 30 j+ (2 ans)",
};
export const label = (n: string) => LABELS[n] ?? n;

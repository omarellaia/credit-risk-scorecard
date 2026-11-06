export interface Bin {
  label: string;
  lo?: number | null;
  hi?: number | null;
  missing?: boolean;
  categories?: string[];
  n: number;
  bad: number;
  bad_rate: number;
  woe: number;
  points: number;
}
export interface Variable {
  name: string;
  type: "numeric" | "categorical";
  cuts?: number[];
  bins: Bin[];
  iv: number;
  coef: number;
  pvalue: number;
}
export interface Scorecard {
  scaling: { base_score: number; base_odds: number; pdo: number; factor: number; offset: number };
  base_points: number;
  intercept: number;
  intercept_calibrated: number;
  pd_floor: number;
  variables: Variable[];
  all_variables: { name: string; type: string; iv: number }[];
  excluded: { variable: string; reason: string }[];
  ranges: Record<string, { min?: number; p01?: number; median?: number; p99?: number; max?: number; categories?: string[] }>;
  fit: { n_obs: number; pseudo_r2: number };
}
export type Inputs = Record<string, number | string | null>;
export interface PortfolioBand { lo: number; hi: number; n: number; bads: number; pd_mean: number; observed: number; amount: number; ead: number; el: number; realised_loss: number; rwa: number }

"""Select variables, fit the logistic regression on WoE, scale to points and calibrate."""
import numpy as np
import pandas as pd
import statsmodels.api as sm
from . import config as C
from .binning import bin_index, fit_all, woe_transform
from .scorecard import FACTOR, OFFSET, calibration_shift


def split(df: pd.DataFrame):
    df = df[df["term_months"] == C.TERM_MONTHS]
    return (df[df.issue_year.isin(C.TRAIN_YEARS)].copy(), df[df.issue_year.isin(C.VALID_YEARS)].copy(),
            df[df.issue_year.isin(C.TEST_YEARS)].copy())


def select(specs: list[dict], w: pd.DataFrame):
    log = []
    cand = [s for s in specs if s["iv"] >= C.IV_MIN]
    for s in specs:
        if s["iv"] < C.IV_MIN:
            log.append({"variable": s["name"], "reason": f"IV {s['iv']:.4f} < {C.IV_MIN}"})
    kept = []
    corr = w[[s["name"] for s in cand]].corr()
    for s in cand:  # sorted by IV, so the stronger of a correlated pair is kept
        clash = [k for k in kept if abs(corr.loc[s["name"], k["name"]]) > C.CORR_MAX]
        if clash:
            log.append({"variable": s["name"], "reason": f"correlation {corr.loc[s['name'], clash[0]['name']]:.2f} with {clash[0]['name']}"})
        else:
            kept.append(s)
    return kept, log


def fit_logit(w: pd.DataFrame, y: pd.Series, specs: list[dict], log: list):
    """WoE = ln(%good/%bad), so every coefficient on P(bad) must be negative; drop and refit otherwise."""
    specs = list(specs)
    while True:
        X = sm.add_constant(w[[s["name"] for s in specs]])
        res = sm.Logit(y, X).fit(disp=0, method="newton", maxiter=100)
        coefs = res.params.drop("const")
        wrong = coefs[coefs >= 0]
        insignificant = res.pvalues.drop("const")[lambda p: p > 0.05]
        if len(wrong):
            v = wrong.idxmax(); log.append({"variable": v, "reason": f"wrong sign (coef {wrong[v]:+.3f})"})
        elif len(insignificant):
            v = insignificant.idxmax(); log.append({"variable": v, "reason": f"p-value {insignificant[v]:.3f} > 0.05"})
        else:
            return res, specs
        specs = [s for s in specs if s["name"] != v]


def train(df: pd.DataFrame):
    tr, va, te = split(df)
    specs = fit_all(tr)
    w_tr = woe_transform(tr, specs)
    kept, log = select(specs, w_tr)
    res, kept = fit_logit(w_tr, tr["bad"], kept, log)
    b0 = float(res.params["const"]); betas = {k: float(v) for k, v in res.params.drop("const").items()}

    # Calibration: shift the intercept so the mean PD on the training vintages equals the long-run default
    # rate of all development vintages (train + validation).
    dev = pd.concat([tr, va])
    long_run = float(dev["bad"].mean())
    lo_tr = b0 + (w_tr[list(betas)] * pd.Series(betas)).sum(axis=1).to_numpy()
    shift = calibration_shift(lo_tr, long_run)
    b0_cal = b0 + shift

    # Points: score = Offset + Factor × ln(odds_good) = Offset − Factor × (b0 + Σ β_i WoE_i)
    variables = []
    for s in kept:
        b = betas[s["name"]]
        bins = [{**bn, "points": float(-FACTOR * b * bn["woe"])} for bn in s["bins"]]
        variables.append({**s, "bins": bins, "coef": b, "pvalue": float(res.pvalues[s["name"]])})
    model = {
        "base_points": float(OFFSET - FACTOR * b0_cal), "intercept": b0, "intercept_calibrated": b0_cal, "calibration_shift": shift,
        "long_run_default_rate": long_run, "factor": FACTOR, "offset": OFFSET, "variables": variables,
        "all_variables": [{"name": s["name"], "type": s["type"], "iv": s["iv"]} for s in specs],
        "excluded": log, "n_obs": int(res.nobs), "pseudo_r2": float(res.prsquared), "llf": float(res.llf),
    }
    return model, (tr, va, te)


def score_frame(df: pd.DataFrame, model: dict) -> pd.DataFrame:
    """Points per variable and total score, exactly as the app computes them."""
    out = pd.DataFrame(index=df.index)
    for v in model["variables"]:
        pts = np.array([b["points"] for b in v["bins"]])
        out[v["name"]] = pts[bin_index(df, v)]
    out["score"] = model["base_points"] + out[[v["name"] for v in model["variables"]]].sum(axis=1)
    return out

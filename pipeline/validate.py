"""Discrimination, stability and calibration on train, validation and test; LGD, EAD, EL and capital."""
import numpy as np
import pandas as pd
from . import config as C
from .metrics import auc, ks, psi
from .scorecard import irb_retail_other, score_to_pd

SIZE_BANDS = [0, 10_000, 20_000, 30_000, np.inf]
SIZE_LABELS = ["< 10 000 $", "10 000–20 000 $", "20 000–30 000 $", "≥ 30 000 $"]


def discrimination(y, score):
    risk = -np.asarray(score)  # higher score = safer, so negate for "risk"
    a = auc(y, risk)
    return {"n": int(len(y)), "bads": int(np.sum(y)), "default_rate": float(np.mean(y)), "auc": a, "gini": 2 * a - 1, "ks": ks(y, risk)}


def stability(score_train, score_other):
    cuts = np.unique(np.quantile(score_train, np.linspace(0, 1, 11)[1:-1]))
    e = np.bincount(np.searchsorted(cuts, score_train, side="right"), minlength=len(cuts) + 1) / len(score_train)
    a = np.bincount(np.searchsorted(cuts, score_other, side="right"), minlength=len(cuts) + 1) / len(score_other)
    return {"psi": psi(e, a), "cuts": cuts.tolist(), "expected": e.tolist(), "actual": a.tolist()}


def lgd_ead(dev: pd.DataFrame):
    d = dev[(dev["bad"] == 1) & (dev["ead"] > 0)].copy()
    d["size_band"] = pd.cut(d["funded_amnt"], SIZE_BANDS, labels=SIZE_LABELS, right=False)
    by = d.groupby("size_band", observed=False).agg(n=("lgd_realised", "size"), lgd=("lgd_realised", "mean"),
                                                    ead_ratio=("ead", lambda s: float((s / d.loc[s.index, "funded_amnt"]).mean())))
    return {
        "n_defaults": int(len(d)), "lgd_mean": float(d["lgd_realised"].mean()), "ead_ratio_mean": float((d["ead"] / d["funded_amnt"]).mean()),
        "bands": [{"label": lab, "lo": float(SIZE_BANDS[i]), "hi": None if not np.isfinite(SIZE_BANDS[i + 1]) else float(SIZE_BANDS[i + 1]),
                   "n": int(by.loc[lab, "n"]), "lgd": float(by.loc[lab, "lgd"]), "ead_ratio": float(by.loc[lab, "ead_ratio"])} for i, lab in enumerate(SIZE_LABELS)],
    }


def size_band_index(amount):
    return np.searchsorted(np.array(SIZE_BANDS[1:-1]), np.asarray(amount, dtype=float), side="right")


def portfolio(test: pd.DataFrame, score: np.ndarray, lgdead: dict):
    """Per score band on the test vintage: counts, PD vs observed, EL vs realised loss, RWA."""
    pd_ = score_to_pd(score)
    bi = size_band_index(test["funded_amnt"])
    lgd = np.array([b["lgd"] for b in lgdead["bands"]])[bi]
    ead_exp = np.array([b["ead_ratio"] for b in lgdead["bands"]])[bi] * test["funded_amnt"].to_numpy()
    k, _ = irb_retail_other(pd_, lgd)
    realised = np.where(test["bad"].to_numpy() == 1, test["ead"].to_numpy() * np.nan_to_num(test["lgd_realised"].to_numpy()), 0.0)
    band = (np.floor(score / C.BAND_WIDTH) * C.BAND_WIDTH).astype(int)
    df = pd.DataFrame({"band": band, "n": 1, "bad": test["bad"].to_numpy(), "pd": pd_, "amount": test["funded_amnt"].to_numpy(),
                       "ead": ead_exp, "el": pd_ * lgd * ead_exp, "realised": realised, "rwa": k * 12.5 * ead_exp})
    g = df.groupby("band").agg(n=("n", "sum"), bads=("bad", "sum"), pd_sum=("pd", "sum"), amount=("amount", "sum"),
                                ead=("ead", "sum"), el=("el", "sum"), realised=("realised", "sum"), rwa=("rwa", "sum")).reset_index()
    rows = [{"lo": int(r.band), "hi": int(r.band + C.BAND_WIDTH), "n": int(r.n), "bads": int(r.bads), "pd_mean": float(r.pd_sum / r.n),
             "observed": float(r.bads / r.n), "amount": float(r.amount), "ead": float(r.ead), "el": float(r.el),
             "realised_loss": float(r.realised), "rwa": float(r.rwa)} for r in g.itertuples()]
    totals = {"n": int(df.n.sum()), "amount": float(df.amount.sum()), "ead": float(df.ead.sum()), "el": float(df.el.sum()),
              "realised_loss": float(df.realised.sum()), "rwa": float(df.rwa.sum()), "pd_mean": float(df.pd.mean()), "observed": float(df.bad.mean())}
    return rows, totals


def by_vintage(df: pd.DataFrame, score: np.ndarray):
    out = []
    for y, idx in df.groupby("issue_year").groups.items():
        sub = df.loc[idx]; s = score[df.index.get_indexer(idx)]
        if sub["bad"].nunique() < 2:
            continue
        m = discrimination(sub["bad"].to_numpy(), s)
        out.append({"year": int(y), **m, "pd_mean": float(score_to_pd(s).mean())})
    return out

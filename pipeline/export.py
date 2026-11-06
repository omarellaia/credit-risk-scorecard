"""Write the JSON files the app reads (public/data/) and the committed test sample (data/sample/)."""
import json
import numpy as np
import pandas as pd
from . import config as C
from .binning import bin_index
from .scorecard import irb_retail_other, score_to_pd

FIXTURE_N = 25


def dump(name, obj):
    C.EXPORT.mkdir(parents=True, exist_ok=True)
    (C.EXPORT / name).write_text(json.dumps(obj, indent=1, ensure_ascii=False, allow_nan=False) + "\n")


def clean_value(v):
    if isinstance(v, (float, np.floating)):
        return None if np.isnan(v) else float(v)
    if isinstance(v, (np.integer,)):
        return int(v)
    if v is None or (isinstance(v, float) and np.isnan(v)):
        return None
    return v


def borrower_inputs(row: pd.Series, model: dict) -> dict:
    return {v["name"]: clean_value(row[v["name"]]) for v in model["variables"]}


def fixtures(test: pd.DataFrame, sf: pd.DataFrame, model: dict, lgdead: dict):
    rng = np.random.default_rng(C.SEED)
    idx = rng.choice(test.index.to_numpy(), size=FIXTURE_N, replace=False)
    out = []
    for i in idx:
        row = test.loc[i]
        score = float(sf.loc[i, "score"])
        pd_ = float(score_to_pd(score))
        lgd = lgdead["lgd_mean"]
        k, r = irb_retail_other(pd_, lgd)
        out.append({"id": str(row["id"]), "inputs": borrower_inputs(row, model),
                    "bins": {v["name"]: int(bin_index(test.loc[[i]], v)[0]) for v in model["variables"]},
                    "points": {v["name"]: float(sf.loc[i, v["name"]]) for v in model["variables"]},
                    "score": score, "pd": pd_, "lgd": lgd, "k": float(k), "r": float(r), "bad": int(row["bad"])})
    return out


def ranges(train: pd.DataFrame, model: dict):
    out = {}
    for v in model["variables"]:
        if v["type"] == "numeric":
            x = train[v["name"]].dropna()
            out[v["name"]] = {"min": float(x.min()), "p01": float(x.quantile(0.01)), "median": float(x.median()), "p99": float(x.quantile(0.99)), "max": float(x.max())}
        else:
            out[v["name"]] = {"categories": sorted(train[v["name"]].fillna("Missing").astype(str).unique().tolist())}
    return out


def sample(test: pd.DataFrame, sf: pd.DataFrame, model: dict, n=3000):
    """Small committed sample of test loans (inputs, outcome, Python score) for the independent check."""
    C.SAMPLE.mkdir(parents=True, exist_ok=True)
    s = test.sample(n=n, random_state=C.SEED)
    cols = ["id", "issue_year", "bad", "funded_amnt", "ead", "lgd_realised"] + [v["name"] for v in model["variables"]]
    out = s[cols].copy()
    out["score_python"] = sf.loc[s.index, "score"]
    out.to_csv(C.SAMPLE / "test_sample.csv", index=False)

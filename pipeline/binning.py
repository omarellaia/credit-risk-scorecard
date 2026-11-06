"""Weight-of-evidence binning. Fitted on the training vintages only.

Numeric variables: fine quantile bins, merged until the bad rate is monotonic and every bin holds at least
MIN_BIN_SHARE of loans. Missing values always get their own bin. Categorical variables: categories sorted by
bad rate and merged with neighbours until each group reaches MIN_BIN_SHARE; unseen categories go to the
group holding the rare ones.
"""
import numpy as np
import pandas as pd
from . import config as C

SMOOTH = 0.5  # added to good and bad counts so empty cells do not give infinite WoE


def woe_iv(good: np.ndarray, bad: np.ndarray):
    g, b = good + SMOOTH, bad + SMOOTH
    pg, pb = g / g.sum(), b / b.sum()
    woe = np.log(pg / pb)
    return woe, float(((pg - pb) * woe).sum())


def assign_numeric(x: np.ndarray, cuts: list[float]) -> np.ndarray:
    """Bin index for numeric values: bin k covers [cuts[k-1], cuts[k]); NaN → -1 (missing bin)."""
    idx = np.searchsorted(np.asarray(cuts, dtype=float), x, side="right")
    return np.where(np.isnan(x), -1, idx)


def _merge_numeric(x: np.ndarray, y: np.ndarray):
    qs = np.unique(np.nanquantile(x, np.linspace(0, 1, C.FINE_BINS + 1)[1:-1]))
    cuts = list(qs)
    while True:
        idx = assign_numeric(x, cuts)
        n = np.bincount(idx, minlength=len(cuts) + 1).astype(float)
        bad = np.bincount(idx, weights=y, minlength=len(cuts) + 1)
        rate = bad / np.maximum(n, 1)
        if len(cuts) == 0:
            return cuts
        # direction from the overall trend
        direction = np.sign(np.corrcoef(np.arange(len(rate)), rate)[0, 1]) or 1
        diffs = np.diff(rate) * direction
        share = n / n.sum()
        if (diffs < 0).any():
            i = int(np.argmin(diffs))  # worst violation: merge bins i and i+1
            del cuts[i]
            continue
        if (share < C.MIN_BIN_SHARE).any():
            i = int(np.argmin(share))
            if i == 0:
                del cuts[0]
            elif i == len(share) - 1:
                del cuts[-1]
            else:  # merge with the neighbour whose bad rate is closest
                del cuts[i - 1 if abs(rate[i] - rate[i - 1]) <= abs(rate[i] - rate[i + 1]) else i]
            continue
        return cuts


def fit_numeric(name: str, x: pd.Series, y: pd.Series) -> dict:
    xv, yv = x.to_numpy(dtype=float), y.to_numpy(dtype=float)
    ok = ~np.isnan(xv)
    cuts = _merge_numeric(xv[ok], yv[ok]) if ok.sum() else []
    idx = assign_numeric(xv, cuts)
    k = len(cuts) + 1
    n = np.bincount(idx[ok], minlength=k).astype(float)
    bad = np.bincount(idx[ok], weights=yv[ok], minlength=k)
    n_miss, bad_miss = float((~ok).sum()), float(yv[~ok].sum())
    counts_n, counts_bad = np.append(n, n_miss), np.append(bad, bad_miss)
    woe, iv = woe_iv(counts_n - counts_bad, counts_bad)
    edges = [-np.inf] + cuts + [np.inf]
    bins = [{"label": _num_label(edges[i], edges[i + 1]), "lo": _f(edges[i]), "hi": _f(edges[i + 1]), "n": int(counts_n[i]),
             "bad": int(counts_bad[i]), "bad_rate": float(counts_bad[i] / max(counts_n[i], 1)), "woe": float(woe[i])} for i in range(k)]
    if n_miss == 0:
        # never observed in training: a missing value gets the riskiest observed bin (prudent), not a smoothing artefact
        bins.append({"label": "Manquant (non observé : classe la plus risquée)", "missing": True, "n": 0, "bad": 0,
                     "bad_rate": float(max(b["bad_rate"] for b in bins)), "woe": float(min(b["woe"] for b in bins))})
    else:
        bins.append({"label": "Manquant", "missing": True, "n": int(n_miss), "bad": int(bad_miss),
                     "bad_rate": float(bad_miss / n_miss), "woe": float(woe[k])})
    return {"name": name, "type": "numeric", "cuts": [float(c) for c in cuts], "bins": bins, "iv": iv}


def _f(v):
    return None if not np.isfinite(v) else float(v)


def _num_label(lo, hi):
    fmt = lambda v: f"{v:,.6g}"
    if not np.isfinite(lo):
        return f"< {fmt(hi)}"
    if not np.isfinite(hi):
        return f"≥ {fmt(lo)}"
    return f"[{fmt(lo)}, {fmt(hi)})"


def fit_categorical(name: str, x: pd.Series, y: pd.Series) -> dict:
    xs = x.fillna("Missing").astype(str)
    stats = pd.DataFrame({"x": xs, "y": y}).groupby("x")["y"].agg(["size", "sum"])
    stats["rate"] = stats["sum"] / stats["size"]
    total = stats["size"].sum()
    rare = stats[stats["size"] / total < 0.005].index.tolist()
    groups = [[c] for c in stats.drop(index=rare).sort_values("rate").index]
    if rare:
        groups.append(rare + ["__other__"])
    else:
        groups[-1].append("__other__")  # unseen categories join the riskiest group (prudent)

    def g_stats(gs):
        n = np.array([stats.loc[[c for c in g if c != "__other__"], "size"].sum() for g in gs], dtype=float)
        b = np.array([stats.loc[[c for c in g if c != "__other__"], "sum"].sum() for g in gs], dtype=float)
        return n, b

    # rare group: place by its own bad rate
    n, b = g_stats(groups)
    order = np.argsort(b / np.maximum(n, 1), kind="stable")
    groups = [groups[i] for i in order]
    while len(groups) > 1:
        n, b = g_stats(groups)
        share = n / n.sum()
        if (share >= C.MIN_BIN_SHARE).all():
            break
        i = int(np.argmin(share))
        rate = b / np.maximum(n, 1)
        j = i + 1 if i == 0 else i - 1 if i == len(groups) - 1 else (i - 1 if abs(rate[i] - rate[i - 1]) <= abs(rate[i] - rate[i + 1]) else i + 1)
        lo, hi = min(i, j), max(i, j)
        groups[lo] = groups[lo] + groups[hi]
        del groups[hi]
    n, b = g_stats(groups)
    woe, iv = woe_iv(n - b, b)
    bins = [{"label": ", ".join(sorted(c for c in g if c != "__other__")) + (" + autres" if "__other__" in g else ""),
             "categories": sorted(g), "n": int(n[i]), "bad": int(b[i]), "bad_rate": float(b[i] / max(n[i], 1)), "woe": float(woe[i])}
            for i, g in enumerate(groups)]
    return {"name": name, "type": "categorical", "bins": bins, "iv": iv}


def assign_categorical(x: pd.Series, spec: dict) -> np.ndarray:
    lookup = {c: i for i, b in enumerate(spec["bins"]) for c in b["categories"]}
    other = lookup["__other__"]
    return x.fillna("Missing").astype(str).map(lambda v: lookup.get(v, other)).to_numpy()


def bin_index(df: pd.DataFrame, spec: dict) -> np.ndarray:
    """Index into spec['bins'] for every row (numeric missing → last bin)."""
    if spec["type"] == "numeric":
        idx = assign_numeric(df[spec["name"]].to_numpy(dtype=float), spec["cuts"])
        return np.where(idx == -1, len(spec["bins"]) - 1, idx)
    return assign_categorical(df[spec["name"]], spec)


def woe_transform(df: pd.DataFrame, specs: list[dict]) -> pd.DataFrame:
    return pd.DataFrame({s["name"]: np.array([b["woe"] for b in s["bins"]])[bin_index(df, s)] for s in specs}, index=df.index)


def fit_all(train: pd.DataFrame) -> list[dict]:
    y = train["bad"]
    specs = [fit_numeric(c, train[c], y) for c in C.NUMERIC] + [fit_categorical(c, train[c], y) for c in C.CATEGORICAL]
    return sorted(specs, key=lambda s: -s["iv"])

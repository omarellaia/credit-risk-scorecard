"""Validation metrics, written out by hand (tested against scikit-learn)."""
import numpy as np


def auc(y: np.ndarray, score_bad: np.ndarray) -> float:
    """Probability a random bad has a higher risk score than a random good (ties count half)."""
    y = np.asarray(y); s = np.asarray(score_bad, dtype=float)
    order = np.argsort(s, kind="mergesort")
    s_sorted = s[order]
    ranks = np.empty(len(s)); i = 0
    while i < len(s):  # average ranks for ties
        j = i
        while j + 1 < len(s) and s_sorted[j + 1] == s_sorted[i]:
            j += 1
        ranks[order[i:j + 1]] = (i + j) / 2 + 1
        i = j + 1
    nb, ng = y.sum(), len(y) - y.sum()
    return float((ranks[y == 1].sum() - nb * (nb + 1) / 2) / (nb * ng))


def gini(y, score_bad) -> float:
    return 2 * auc(y, score_bad) - 1


def ks(y, score_bad) -> float:
    """Largest gap between the cumulative distributions of bads and goods over the risk score."""
    y = np.asarray(y); s = np.asarray(score_bad, dtype=float)
    thr = np.unique(s)
    cb = np.searchsorted(np.sort(s[y == 1]), thr, side="right") / (y == 1).sum()
    cg = np.searchsorted(np.sort(s[y == 0]), thr, side="right") / (y == 0).sum()
    return float(np.max(np.abs(cb - cg)))


def psi(expected: np.ndarray, actual: np.ndarray) -> float:
    """Population stability index between two share vectors (same bins)."""
    e = np.clip(np.asarray(expected, dtype=float), 1e-6, None); a = np.clip(np.asarray(actual, dtype=float), 1e-6, None)
    return float(((a - e) * np.log(a / e)).sum())

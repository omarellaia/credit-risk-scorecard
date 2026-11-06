"""Scaling, calibration, PD and Basel IRB capital — shared by training, export and tests."""
import math
import numpy as np
from scipy.stats import norm
from . import config as C

FACTOR = C.PDO / math.log(2)
OFFSET = C.BASE_SCORE - FACTOR * math.log(C.BASE_ODDS)


def score_to_pd(score, floor=C.PD_FLOOR):
    """odds (good:bad) = exp((score − Offset)/Factor); PD = 1/(1 + odds), floored."""
    pd_ = 1 / (1 + np.exp((np.asarray(score, dtype=float) - OFFSET) / FACTOR))
    return np.maximum(pd_, floor)


def calibration_shift(log_odds_bad: np.ndarray, target_rate: float) -> float:
    """Constant added to the log-odds (intercept shift) so the mean PD equals target_rate (bisection)."""
    lo, hi = -5.0, 5.0
    for _ in range(200):
        mid = (lo + hi) / 2
        m = float(np.mean(1 / (1 + np.exp(-(log_odds_bad + mid)))))
        lo, hi = (mid, hi) if m < target_rate else (lo, mid)
    return (lo + hi) / 2


def irb_retail_other(pd_, lgd):
    """Basel 'other retail' capital K per unit of EAD (no maturity adjustment)."""
    pd_ = np.asarray(pd_, dtype=float)
    w = (1 - np.exp(-35 * pd_)) / (1 - math.exp(-35))
    r = 0.03 * w + 0.16 * (1 - w)
    k = lgd * (norm.cdf((norm.ppf(pd_) + np.sqrt(r) * norm.ppf(0.999)) / np.sqrt(1 - r)) - pd_)
    return k, r

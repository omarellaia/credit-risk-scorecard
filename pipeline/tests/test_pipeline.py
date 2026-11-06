"""Tests that run without the raw dataset: formulas, the exported model and the committed sample."""
import json
import math
from statistics import NormalDist

import numpy as np
import pandas as pd
import pytest
from sklearn.metrics import roc_auc_score, roc_curve

from pipeline import config as C
from pipeline.binning import assign_numeric, bin_index, woe_iv
from pipeline.metrics import auc, gini, ks, psi
from pipeline.scorecard import FACTOR, OFFSET, calibration_shift, irb_retail_other, score_to_pd

EXPORT = C.EXPORT
card = json.loads((EXPORT / "scorecard.json").read_text())
metrics = json.loads((EXPORT / "metrics.json").read_text())
calib = json.loads((EXPORT / "calibration.json").read_text())
summary = json.loads((EXPORT / "data_summary.json").read_text())
sample = pd.read_csv(C.SAMPLE / "test_sample.csv")


def test_auc_ks_match_sklearn():
    rng = np.random.default_rng(1)
    y = rng.integers(0, 2, 2000); s = rng.normal(size=2000) + y * 0.8
    s[:50] = np.round(s[:50])  # ties
    assert auc(y, s) == pytest.approx(roc_auc_score(y, s), abs=1e-12)
    fpr, tpr, _ = roc_curve(y, s)
    assert ks(y, s) == pytest.approx(np.max(tpr - fpr), abs=1e-12)
    assert gini(y, s) == pytest.approx(2 * roc_auc_score(y, s) - 1, abs=1e-12)


def test_woe_iv_formula():
    woe, iv = woe_iv(np.array([90.0, 10.0]), np.array([10.0, 10.0]))
    g = np.array([90.5, 10.5]) / 101; b = np.array([10.5, 10.5]) / 21
    assert np.allclose(woe, np.log(g / b))
    assert iv == pytest.approx(((g - b) * np.log(g / b)).sum())


def test_psi_zero_when_identical_and_positive_otherwise():
    assert psi([0.5, 0.5], [0.5, 0.5]) == 0
    assert psi([0.5, 0.5], [0.6, 0.4]) > 0


def test_numeric_bin_assignment_edges():
    idx = assign_numeric(np.array([np.nan, 1.0, 2.0, 2.5, 3.0]), [2.0, 3.0])
    assert idx.tolist() == [-1, 0, 1, 1, 2]


def test_scaling_anchor_and_pdo():
    # BASE_SCORE points at odds BASE_ODDS:1, +PDO points doubles the odds
    assert OFFSET + FACTOR * math.log(C.BASE_ODDS) == pytest.approx(C.BASE_SCORE)
    pd1, pd2 = score_to_pd(C.BASE_SCORE, floor=0), score_to_pd(C.BASE_SCORE + C.PDO, floor=0)
    assert (1 - pd1) / pd1 == pytest.approx(C.BASE_ODDS)
    assert ((1 - pd2) / pd2) / ((1 - pd1) / pd1) == pytest.approx(2)


def test_pd_floor():
    assert score_to_pd(5000) == C.PD_FLOOR


def test_calibration_shift_hits_target():
    lo = np.random.default_rng(2).normal(-2, 1, 10_000)
    sh = calibration_shift(lo, 0.2)
    assert np.mean(1 / (1 + np.exp(-(lo + sh)))) == pytest.approx(0.2, abs=1e-9)


def test_irb_matches_independent_normal():
    N = NormalDist()
    for pd_, lgd in [(0.01, 0.45), (0.05, 0.9), (0.2, 0.6)]:
        w = (1 - math.exp(-35 * pd_)) / (1 - math.exp(-35)); r = 0.03 * w + 0.16 * (1 - w)
        k = lgd * (N.cdf((N.inv_cdf(pd_) + math.sqrt(r) * N.inv_cdf(0.999)) / math.sqrt(1 - r)) - pd_)
        assert float(irb_retail_other(pd_, lgd)[0]) == pytest.approx(k, rel=1e-9)


def test_exported_model_signs_and_bins():
    for v in card["variables"]:
        assert v["coef"] < 0, f"{v['name']} has a wrong sign"
        nonmiss = [b for b in v["bins"] if not b.get("missing")]
        if v["type"] == "numeric" and len(nonmiss) > 2:
            r = [b["bad_rate"] for b in nonmiss]
            d = np.sign(np.diff(r))
            assert (d >= 0).all() or (d <= 0).all(), f"{v['name']} bad rate not monotonic"
        total = sum(b["n"] for b in v["bins"])
        assert all(b["n"] / total >= C.MIN_BIN_SHARE - 1e-9 for b in nonmiss), f"{v['name']} has a bin below {C.MIN_BIN_SHARE}"


def test_no_leakage_in_features():
    banned = set(C.EXCLUDED_LC_RISK) | {"total_rec_prncp", "recoveries", "collection_recovery_fee", "out_prncp", "total_pymnt",
                                        "last_pymnt_amnt", "last_fico_range_high", "last_fico_range_low", "ead", "lgd_realised", "loan_status"}
    names = {v["name"] for v in card["variables"]} | {v["name"] for v in card["all_variables"]}
    assert not names & banned


def test_iv_above_threshold_and_flag_suspicious():
    for v in card["variables"]:
        assert v["iv"] >= C.IV_MIN
        assert v["iv"] < 0.5, f"{v['name']} IV {v['iv']:.2f} ≥ 0.5: investigate as possible leakage"


def test_split_is_by_date_and_disjoint():
    s = metrics["sets"]
    assert max(s["train"]["years"]) < min(s["validation"]["years"]) <= max(s["validation"]["years"]) < min(s["test"]["years"])


def test_calibration_mean_pd_equals_long_run_rate():
    assert metrics["sets"]["train"]["pd_mean"] == pytest.approx(calib["long_run_default_rate"], abs=1e-4)


def test_sample_rescored_from_exported_card():
    df = sample.copy()
    score = np.full(len(df), card["base_points"])
    for v in card["variables"]:
        pts = np.array([b["points"] for b in v["bins"]])
        score += pts[bin_index(df, v)]
    assert np.allclose(score, df["score_python"], atol=1e-9)


def test_sample_metrics_close_to_reported_test_metrics():
    risk = -sample["score_python"].to_numpy()
    assert abs(gini(sample["bad"].to_numpy(), risk) - metrics["sets"]["test"]["gini"]) < 0.06

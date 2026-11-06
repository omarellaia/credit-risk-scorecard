"""One command: python3 -m pipeline.run  (clean → bin → train → validate → export)."""
import json
import sys
import numpy as np
import pandas as pd
from . import clean, config as C, export as E
from .train import score_frame, train
from .validate import by_vintage, discrimination, lgd_ead, portfolio, stability
from .scorecard import score_to_pd


def main():
    pq = C.INTERIM / "loans.parquet"
    if "--reclean" in sys.argv or not pq.exists():
        clean.main()
    df = pd.read_parquet(pq)
    summary = json.loads((C.INTERIM / "clean_summary.json").read_text())

    model, (tr, va, te) = train(df)
    sf = {k: score_frame(d, model) for k, d in [("train", tr), ("validation", va), ("test", te)]}
    sets = {"train": tr, "validation": va, "test": te}
    metrics = {k: discrimination(sets[k]["bad"].to_numpy(), sf[k]["score"].to_numpy()) for k in sets}
    for k in sets:
        metrics[k]["pd_mean"] = float(score_to_pd(sf[k]["score"]).mean())
        metrics[k]["score_mean"] = float(sf[k]["score"].mean())
        metrics[k]["years"] = sorted(int(y) for y in sets[k]["issue_year"].unique())
    stab = {k: stability(sf["train"]["score"].to_numpy(), sf[k]["score"].to_numpy()) for k in ["validation", "test"]}
    all36 = pd.concat([tr, va, te])
    vint = by_vintage(all36, pd.concat([sf["train"], sf["validation"], sf["test"]])["score"].to_numpy())
    lgdead = lgd_ead(pd.concat([tr, va]))
    bands, totals = portfolio(te, sf["test"]["score"].to_numpy(), lgdead)
    cal_bands = {}
    for k in sets:
        s = sf[k]["score"].to_numpy(); b = (np.floor(s / 20) * 20).astype(int); p = score_to_pd(s)
        g = pd.DataFrame({"b": b, "pd": p, "bad": sets[k]["bad"].to_numpy()}).groupby("b").agg(n=("bad", "size"), pd=("pd", "mean"), obs=("bad", "mean"))
        cal_bands[k] = [{"lo": int(i), "hi": int(i + 20), "n": int(r.n), "pd_mean": float(r.pd), "observed": float(r.obs)} for i, r in g.iterrows()]

    E.dump("scorecard.json", {
        "scaling": {"base_score": C.BASE_SCORE, "base_odds": C.BASE_ODDS, "pdo": C.PDO, "factor": model["factor"], "offset": model["offset"]},
        "base_points": model["base_points"], "intercept": model["intercept"], "intercept_calibrated": model["intercept_calibrated"],
        "pd_floor": C.PD_FLOOR, "variables": model["variables"], "all_variables": model["all_variables"], "excluded": model["excluded"],
        "ranges": E.ranges(tr, model), "fit": {"n_obs": model["n_obs"], "pseudo_r2": model["pseudo_r2"]},
    })
    E.dump("metrics.json", {"sets": metrics, "stability": stab, "by_vintage": vint})
    E.dump("calibration.json", {"long_run_default_rate": model["long_run_default_rate"], "shift": model["calibration_shift"],
                                "development_years": C.TRAIN_YEARS + C.VALID_YEARS, "bands": cal_bands})
    E.dump("portfolio_bands.json", {"band_width": C.BAND_WIDTH, "set": "test", "years": C.TEST_YEARS, "bands": bands, "totals": totals, "lgd_ead": lgdead})
    E.dump("fixtures.json", E.fixtures(te, sf["test"], model, lgdead))
    E.dump("data_summary.json", {**summary, "term_months": C.TERM_MONTHS, "train_years": C.TRAIN_YEARS, "valid_years": C.VALID_YEARS,
                                 "test_years": C.TEST_YEARS, "default_statuses": C.DEFAULT_STATUSES, "good_statuses": C.GOOD_STATUSES,
                                 "excluded_lc_risk": C.EXCLUDED_LC_RISK, "excluded_post_origination": C.EXCLUDED_POST_ORIGINATION,
                                 "excluded_partial_history": C.EXCLUDED_PARTIAL_HISTORY,
                                 "n_36m_by_set": {k: int(len(v)) for k, v in sets.items()}})
    E.sample(te, sf["test"], model)
    print(json.dumps({k: {m: round(v, 4) for m, v in metrics[k].items() if isinstance(v, float)} for k in metrics}, indent=1))
    print("PSI test:", round(stab["test"]["psi"], 4), "| variables:", [v["name"] for v in model["variables"]])
    print("excluded:", model["excluded"])
    print("EL/realised test:", round(totals["el"]), round(totals["realised_loss"]), "LGD", round(lgdead["lgd_mean"], 3))


if __name__ == "__main__":
    main()

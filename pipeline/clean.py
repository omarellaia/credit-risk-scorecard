"""Read the raw Lending Club file, keep origination fields + outcome fields, apply the default definition.

Output: data/interim/loans.parquet (git-ignored) and data/interim/clean_summary.json
"""
import json
import numpy as np
import pandas as pd
from . import config as C

USECOLS = ["id", "issue_d", "loan_status", "term", "loan_amnt", "funded_amnt", "annual_inc", "dti", "emp_length",
           "home_ownership", "verification_status", "purpose", "addr_state", "earliest_cr_line", "fico_range_low",
           "fico_range_high", "open_acc", "total_acc", "revol_bal", "revol_util", "delinq_2yrs", "inq_last_6mths",
           "pub_rec", "pub_rec_bankruptcies", "mort_acc", "mths_since_last_delinq", "application_type",
           "total_rec_prncp", "recoveries", "collection_recovery_fee"]


def emp_years(s: pd.Series) -> pd.Series:
    x = s.astype("string").str.replace("< 1 year", "0", regex=False).str.extract(r"(\d+)")[0]
    return pd.to_numeric(x, errors="coerce")


def load_raw() -> pd.DataFrame:
    df = pd.read_csv(C.RAW, usecols=USECOLS, low_memory=False)
    return df[pd.to_numeric(df["loan_amnt"], errors="coerce").notna()]  # drops the file's summary rows


def clean(df: pd.DataFrame):
    steps = [("raw rows", len(df))]
    df = df.copy()
    df["issue_d"] = pd.to_datetime(df["issue_d"], format="%b-%Y")
    df["issue_year"] = df["issue_d"].dt.year
    df["term_months"] = df["term"].str.extract(r"(\d+)")[0].astype(int)
    df["term"] = df["term_months"].astype(str) + " months"

    df = df[~df["loan_status"].str.startswith(C.POLICY_EXCLUDED_PREFIX)]
    steps.append(("outside credit policy removed", len(df)))
    df = df[df["application_type"].fillna("Individual") == "Individual"]
    steps.append(("joint applications removed", len(df)))

    end = pd.Timestamp(C.DATA_END)
    matured = df["issue_d"] + pd.to_timedelta(df["term_months"] * 30.44, unit="D") <= end
    by_year = (df.assign(matured=matured).groupby(["issue_year", "term"])["matured"].mean().unstack().round(3))
    df = df[matured]
    steps.append(("term not complete by 2018-12 removed", len(df)))

    known = df["loan_status"].isin(C.DEFAULT_STATUSES + C.GOOD_STATUSES)
    status_dropped = df.loc[~known, "loan_status"].value_counts().to_dict()
    df = df[known]
    steps.append(("outcome unknown (current/late) removed", len(df)))

    df["bad"] = df["loan_status"].isin(C.DEFAULT_STATUSES).astype(int)
    df["fico"] = (df["fico_range_low"] + df["fico_range_high"]) / 2
    ecl = pd.to_datetime(df["earliest_cr_line"], format="%b-%Y", errors="coerce")
    df["credit_history_months"] = ((df["issue_d"] - ecl).dt.days / 30.44).round()
    df["emp_length_years"] = emp_years(df["emp_length"])
    df["revol_util"] = pd.to_numeric(df["revol_util"], errors="coerce")
    for c in ["annual_inc", "dti"]:
        df[c] = pd.to_numeric(df[c], errors="coerce")

    # EAD and LGD fields (defaults only; never features)
    df["ead"] = (df["funded_amnt"] - df["total_rec_prncp"]).clip(lower=0)
    net_rec = (df["recoveries"] - df["collection_recovery_fee"]).clip(lower=0)
    df["lgd_realised"] = np.where((df["bad"] == 1) & (df["ead"] > 0), (1 - net_rec / df["ead"]).clip(0, 1), np.nan)

    keep = ["id", "issue_d", "issue_year", "loan_status", "bad", "funded_amnt", "ead", "lgd_realised", "term_months"] + C.NUMERIC + C.CATEGORICAL
    df = df[keep].reset_index(drop=True)
    summary = {
        "steps": [{"step": s, "rows": int(n)} for s, n in steps],
        "status_dropped": {k: int(v) for k, v in status_dropped.items()},
        "share_matured_by_year_term": {str(y): {k: (None if pd.isna(v) else float(v)) for k, v in r.items()} for y, r in by_year.iterrows()},
        "default_rate_by_year": {str(int(k)): float(v) for k, v in df.groupby("issue_year")["bad"].mean().items()},
        "loans_by_year": {str(int(k)): int(v) for k, v in df.groupby("issue_year").size().items()},
        "default_rate_by_year_term": {f"{int(y)}|{t}": float(v) for (y, t), v in df.groupby(["issue_year", "term"])["bad"].mean().items()},
    }
    return df, summary


def main():
    C.INTERIM.mkdir(parents=True, exist_ok=True)
    df, summary = clean(load_raw())
    df.to_parquet(C.INTERIM / "loans.parquet", index=False)
    (C.INTERIM / "clean_summary.json").write_text(json.dumps(summary, indent=2))
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()

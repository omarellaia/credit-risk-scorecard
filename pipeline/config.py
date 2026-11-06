"""Every methodology decision in one place. Change here, rerun `python3 -m pipeline.run`."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw" / "accepted_2007_to_2018Q4.csv.gz"
INTERIM = ROOT / "data" / "interim"
EXPORT = ROOT / "public" / "data"
SAMPLE = ROOT / "data" / "sample"

# Data window ends 2018Q4. A loan is "complete" when its full term has elapsed by then.
DATA_END = "2018-12-31"

# Default definition
DEFAULT_STATUSES = ["Charged Off", "Default"]
GOOD_STATUSES = ["Fully Paid"]
# Loans outside Lending Club's credit policy (2007-2010) are a different population: excluded.
POLICY_EXCLUDED_PREFIX = "Does not meet the credit policy"

# Out-of-time split by issue year (set after looking at default rates by year: see data_summary.json)
# 36-month loans only: 60-month loans issued after 2013 had not reached term by 2018-12, so keeping them
# would make the training population (36m + 60m) differ from the test population (36m only).
TERM_MONTHS = 36
TRAIN_YEARS = [2007, 2008, 2009, 2010, 2011, 2012, 2013]
VALID_YEARS = [2014]
TEST_YEARS = [2015]

# Variables known at origination only (the model's candidate features)
NUMERIC = ["loan_amnt", "annual_inc", "dti", "fico", "credit_history_months", "open_acc", "total_acc",
           "revol_bal", "revol_util", "delinq_2yrs", "inq_last_6mths", "pub_rec", "pub_rec_bankruptcies",
           "mort_acc", "mths_since_last_delinq", "emp_length_years"]
CATEGORICAL = ["home_ownership", "verification_status", "purpose", "addr_state"]

# Lending Club's own risk output: excluded so the model is not a copy of theirs
EXCLUDED_LC_RISK = ["int_rate", "grade", "sub_grade", "installment"]
# Filled in after origination: never features (leakage)
EXCLUDED_POST_ORIGINATION = [
    "out_prncp", "out_prncp_inv", "total_pymnt", "total_pymnt_inv", "total_rec_prncp", "total_rec_int",
    "total_rec_late_fee", "recoveries", "collection_recovery_fee", "last_pymnt_d", "last_pymnt_amnt",
    "next_pymnt_d", "last_credit_pull_d", "last_fico_range_high", "last_fico_range_low", "pymnt_plan",
    "hardship_*", "debt_settlement_*", "settlement_*", "loan_status (target only)",
]
# Bureau fields only populated from 2012 onwards: excluded so every vintage has the same variables
EXCLUDED_PARTIAL_HISTORY = ["bc_util", "all_util", "il_util", "open_acc_6m", "num_* (bureau trade counts)", "mo_sin_*", "tot_*"]

# Binning
FINE_BINS = 20
MIN_BIN_SHARE = 0.05
IV_MIN = 0.02
CORR_MAX = 0.7

# Score scaling: BASE_SCORE points at odds BASE_ODDS:1 (good:bad), PDO points to double the odds
BASE_SCORE = 600
BASE_ODDS = 50
PDO = 20

# Calibration
PD_FLOOR = 0.0003  # Basel retail PD floor (0.03%)

# Score bands for calibration, portfolio and cut-off
BAND_WIDTH = 10

SEED = 7

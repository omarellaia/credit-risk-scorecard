# Credit risk scorecard — PD, LGD, EAD

An IRB-style retail credit-risk model trained on Lending Club loans: a weight-of-evidence logistic scorecard for PD, LGD and EAD estimates, expected loss and Basel IRB capital, validated on a later, untouched vintage. A Next.js app shows the scorecard, scores a borrower and runs a portfolio cut-off; the written report is a page of the same app. Live: _[add the Vercel link after deploying]_

> Course project, trained on public US consumer-loan data. IRB-style, not a compliant bank model. Not advice.

_Screenshots: add `docs/score.png` (scoring page) and `docs/calibration.png` (calibration chart) once deployed._

## Method in 10 lines

1. Default = `Charged Off` or `Default`; good = `Fully Paid`; loans still current or late are dropped.
2. 36-month loans whose full term ended by Dec 2018, so every outcome is known (60-month loans after 2013 had not matured).
3. Split by issue date: train 2007–2013, validation 2014, test 2015. Never random.
4. Origination variables only; Lending Club's grade and interest rate excluded (their own risk output).
5. Each variable binned (monotonic bad rate, ≥ 5% of loans per bin, missing in its own bin), then WoE and IV.
6. Keep IV ≥ 0.02, drop one of each pair correlated above 0.7; logistic regression on WoE, every sign checked.
7. Points: 600 at odds 50:1, PDO 20.
8. Calibration: intercept shifted so mean PD = long-run default rate of 2007–2014 (13.06%); PD floor 0.03%.
9. EAD = funded − principal repaid at default; LGD = 1 − net recoveries / EAD, averaged by loan-size band.
10. EL = PD × LGD × EAD; capital with the Basel "other retail" formula (no maturity adjustment), RWA = K × 12.5 × EAD.

## Validation results

| Sample | Years | Loans | Default rate | Mean PD | AUC | Gini | KS | PSI vs train |
|---|---|---|---|---|---|---|---|---|
| Train | 2007–2013 | 172,988 | 12.4% | 13.1% | 0.649 | **0.298** | 0.218 | — |
| Validation | 2014 | 162,570 | 13.7% | 13.7% | 0.640 | **0.279** | 0.202 | 0.0112 |
| Test (out of time) | 2015 | 282,787 | 14.9% | 13.2% | 0.642 | **0.284** | 0.204 | 0.0010 |

On the test vintage: expected loss 218.6 M$ vs realised 273.8 M$ on 2084 M$ of expected exposure; RWA 3311 M$.

## Data and leakage rules

Source: Lending Club accepted loans 2007–2018, Kaggle dataset `wordsforthewise/lending-club` (free account). The raw file is **not committed**.

- **Excluded, Lending Club's own risk output:** int_rate, grade, sub_grade, installment.
- **Excluded, known only after origination:** out_prncp, total_pymnt, total_rec_prncp, total_rec_int, recoveries, collection_recovery_fee, last_pymnt_d, last_pymnt_amnt, last_credit_pull_d, last_fico_range_*, hardship_*, settlement_*, debt_settlement_*, loan_status (target only).
- **Excluded, only populated from 2012:** bc_util, all_util, il_util, open_acc_6m, num_*, mo_sin_*, tot_*.
- Recoveries and principal repaid are used **only** for LGD and EAD, never as features.

Candidate variables and their origin are listed in `pipeline/config.py` (data dictionary) and on the Method page.

## Run it

```bash
# 1. data: download accepted_2007_to_2018Q4.csv.gz from Kaggle into data/raw/
pip install -r requirements.txt
python3 -m pipeline.run            # clean → bin → train → validate → export to public/data/ (one command, ~20 s)
python3 -m pytest -q pipeline/tests

# 2. app
npm install
npm test                            # TypeScript scoring must reproduce the Python scores (fixtures.json)
npm run dev                         # http://localhost:3000
```

The exported JSON files in `public/data/` are the only link between Python and the app. `data/sample/test_sample.csv` (3,000 test loans) lets the tests and `notebooks/independent_check.ipynb` run without the raw file.

## Repo layout

```
data/raw/            Lending Club file, git-ignored (README explains the download)
data/sample/         small sample of the test vintage, used by tests and the notebook
pipeline/            config.py, clean.py, binning.py, train.py, validate.py, metrics.py, scorecard.py, export.py, run.py
pipeline/tests/      pytest: WoE, IV, PSI, KS/AUC vs scikit-learn, scaling, calibration, IRB, leakage, signs
notebooks/           independent check: Gini, KS and 5 borrowers' points by hand
public/data/         scorecard.json, metrics.json, calibration.json, portfolio_bands.json, fixtures.json, data_summary.json
report/report.md     source of the Report page ({{placeholders}} filled from the exported files)
src/lib/scoring.ts   adds up points, PD, IRB capital; tested against fixtures.json
src/app/             summary, scorecard, score, portfolio, report, method
```

## Limitations

- Accepted loans only: rejected applicants are missing (no reject inference).
- US consumer loans, no macroeconomic variables, one economic period.
- The through-the-cycle calibration under-predicts the 2015 vintage (mean PD 13.2% vs 14.9% observed).
- LGD and EAD are band averages, without discounting or unrecorded workout costs; 100% conversion.
- Gini is modest without Lending Club's grade, which is expected from application variables alone.

# Portal submission draft

GitHub account: Mimispecial. Repository visibility: private.

The current full live demonstration and public-link review are incomplete. The note below describes implemented behavior and test coverage; it does not claim a completed release. All supplied evidence packets are public submitted text. Reviewers must have repository access until publication is authorized.

## Title

Forecast Calibration League — Reusable Intelligent Contract

## Notes / Description

Built Forecast Calibration League, an MIT-licensed reusable GenLayer Intelligent Contract for sealed probability forecasts and deterministic accuracy scoring. Up to 24 participants commit forecasts, then reveal probabilities from 0-10,000 basis points; commitments bind the question, wallet, probability and salt.

After reveals close, the organizer freezes one evidence packet. Validators independently resolve the proposition as YES, NO or VOID under immutable criteria and require exact result equality. Code calculates integer Brier-based points and orders the leaderboard with a stable address tie-break; the model never assigns scores.

Anyone can resolve frozen evidence or expire an unresolved question to VOID after its deadline. Includes evidence digests, public read methods and regression tests for forged reveals, evidence authority, scoring bounds and expiry. Suitable for forecasting games and agent evaluation. Scores are synthetic; the organizer selects evidence.

Character count, including paragraph breaks: 980/1000.

## Evidence entries

- GitHub Repository: [forecast-calibration-league](https://github.com/Mimispecial/forecast-calibration-league)
- GitHub File — pinned contract source: [contracts/forecast_league.py](https://github.com/Mimispecial/forecast-calibration-league/blob/f857d4cef2d8ee237c9cf378207622cab8b9675a/contracts/forecast_league.py)
- GitHub File — regression tests: [tests/test_regressions.py](https://github.com/Mimispecial/forecast-calibration-league/blob/f857d4cef2d8ee237c9cf378207622cab8b9675a/tests/test_regressions.py)

Current release deployment proof is incomplete. The superseded historical manifest is not evidence for a changed release. Add the completed matching-source deployment manifest and key finalized transactions before final submission.

## Submission gates

- Technical readiness: FAIL for full release; complete current live-flow proof remains pending.
- Distinctiveness: PASS for the documented scoped comparisons; FAIL for complete current-cohort verification, which remains unfinished.
- Evidence readiness: FAIL while source access is private and the final release proof is incomplete.

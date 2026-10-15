# Forecast Calibration League

A reusable GenLayer forecasting tournament. Players commit to a probability for a frozen binary proposition, reveal after the forecast window, and receive deterministic Brier-style accuracy points only after validators reach consensus on `YES`, `NO`, or `VOID` from the frozen resolution criteria and submitted evidence. The leaderboard preserves each player's score rather than averaging a panel into one estimate.

## First use

Deploy with a question ID, an atomic proposition, resolution criteria, a forecast deadline, and a later resolution time. Players hash `forecast_commitment(question_id, player, probability_bps, salt)` and commit, then reveal an integer probability from 0 to 10,000 basis points before the deadline. After the resolution time, anyone may submit bounded evidence to `resolve_question`. Read each score with `get_player` and rank through `get_leaderboard`.

This is a points-based tournament primitive, not a betting or payout contract. A `VOID` outcome awards no score. Caller-supplied resolution evidence is a trust boundary and must follow the source policy stated in the league terms.

## Why this is distinct

EstimateEnvelope asks a fixed panel for a one-time numeric range and computes a median envelope. This preserves individual sealed forecasts across participants and scores calibration against a later outcome. FlightProof resolves flight events; this is not a general oracle but a scoring lifecycle that consumes a bounded binary outcome judgment.

## Build and test

```powershell
python -m pip install -r requirements.txt
genvm-lint check contracts/forecast_league.py
pytest -q
```

Live consensus proof must include a positive outcome, a `VOID`/ambiguous case, and score read-back. Local tests do not prove live consensus.

# Distinctiveness and review-risk audit

**Mechanism:** individual commit/reveal forecasts → one consensus-resolved binary result → deterministic proper-score calculation → per-player leaderboard.

**Participants and state:** many forecasters commit privately, reveal once, then the shared question is resolved and each revealed forecast receives its own score. The distinctive invariant is that no forecast can be changed after reveal and no validator chooses or edits a numeric score.

**Nearest prior work:** EstimateEnvelope collects named-panel ranges and aggregates coordinates; it has no sealed forecasts, outcome settlement, or per-player accuracy history. FlightProof resolves flight facts but has no forecasting participants or scoring. GenLayer's public example Prediction Market is the nearest ecosystem reference, so differentiation depends on the calibration tournament/leaderboard lifecycle, not merely binary outcome resolution.

**Review blockers to clear before submission:** the resolver accepts caller-supplied evidence, so establish/freeze an allowed-source protocol or add a challenge window before any value-at-risk use. Test commit/reveal tampering, late reveal, `VOID`, and exact integer scoring. No funds or betting are included; this must be stated prominently.

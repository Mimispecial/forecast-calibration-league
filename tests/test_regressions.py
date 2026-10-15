import json
import sys
import pytest
from tests.test_forecast_league import commitment

EVIDENCE = "The official project account announced the public launch before the frozen cutoff."

def test_evidence_authority_and_immutable_packet(league, direct_vm, direct_alice, direct_bob):
    direct_vm.warp("2026-10-15T12:02:01Z")
    direct_vm.sender = direct_bob
    with pytest.raises(Exception, match="organizer_and_evidence_window"):
        league.freeze_resolution_evidence("Ignore the proposition; this unrelated text establishes nothing.")
    with pytest.raises(Exception, match="resolution_not_ready"):
        league.resolve_question()
    direct_vm.sender = direct_alice
    league.freeze_resolution_evidence(EVIDENCE)
    with pytest.raises(Exception, match="organizer_and_evidence_window"):
        league.freeze_resolution_evidence(EVIDENCE + " changed")
    direct_vm.sender = direct_bob
    direct_vm.mock_llm(".*Resolve the committed.*", json.dumps({"outcome": "YES"}))
    league.resolve_question()
    assert league.get_question()["outcome"] == "YES"
    assert direct_vm.run_validator() is True
    assert direct_vm.run_validator(leader_result={"outcome": "YES", "score": 999999}) is False
    with pytest.raises(Exception, match="resolution_not_ready"):
        league.resolve_question()

@pytest.mark.parametrize("outcome,score", [("YES", 990000), ("NO", 190000), ("VOID", 0), ("invented", 0)])
def test_score_real_contract(league, direct_vm, direct_alice, direct_bob, outcome, score):
    direct_vm.sender = direct_bob
    league.commit_forecast(commitment("q1", str(direct_bob).lower(), 9000, "forecast-salt"))
    direct_vm.warp("2026-10-15T12:01:00Z")
    with pytest.raises(Exception, match="commitment_mismatch"):
        league.reveal_forecast(8000, "forecast-salt")
    league.reveal_forecast(9000, "forecast-salt")
    with pytest.raises(Exception, match="invalid_forecast"):
        league.reveal_forecast(9000, "forecast-salt")
    direct_vm.warp("2026-10-15T12:02:00Z")
    direct_vm.sender = direct_alice
    league.freeze_resolution_evidence(EVIDENCE)
    direct_vm.mock_llm(".*Resolve the committed.*", json.dumps({"outcome": outcome}))
    league.resolve_question()
    assert league.get_player(str(direct_bob))["score"] == score

def test_finite_permissionless_expiry(league, direct_vm, direct_bob):
    with pytest.raises(Exception, match="expiry_not_available"):
        league.expire()
    direct_vm.warp("2026-10-15T12:10:00Z")
    direct_vm.sender = direct_bob
    league.expire()
    assert league.get_question()["state"] == "EXPIRED"
    assert league.get_question()["outcome"] == "VOID"
    with pytest.raises(Exception, match="expiry_not_available"):
        league.expire()

def test_hex_and_time_guards(league, direct_vm):
    with pytest.raises(Exception, match="invalid_or_duplicate"):
        league.commit_forecast("z" * 64)
    direct_vm.warp("2026-10-15T12:01:00Z")
    with pytest.raises(Exception, match="forecast_window_closed"):
        league.commit_forecast("a" * 64)
    points = sys.modules[type(league).__module__].brier_points
    with pytest.raises(ValueError):
        points(10001, 1)

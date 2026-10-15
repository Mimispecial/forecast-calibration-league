import hashlib
import json


def commitment(qid, player, probability, salt):
    return hashlib.sha256(json.dumps([qid, player.lower(), probability, salt], separators=(",", ":")).encode()).hexdigest()


def points(probability, outcome):
    error = (probability - outcome * 10000) ** 2
    return 1_000_000 - error * 1_000_000 // 100_000_000


def test_commit_reveal_and_individual_score(league, direct_vm, direct_alice, direct_bob):
    player = str(direct_bob).lower()
    direct_vm.sender = direct_bob
    league.commit_forecast(commitment("q1", player, 9000, "forecast-salt"))
    direct_vm.warp("2026-10-15T12:01:01Z")
    direct_vm.sender = direct_bob
    league.reveal_forecast(9000, "forecast-salt")
    direct_vm.warp("2026-10-15T12:02:01Z")
    direct_vm.mock_llm(r".*Resolve the committed binary proposition.*", json.dumps({"outcome": "YES"}))
    direct_vm.sender = direct_alice
    league.resolve_question("The official project account posted the dated launch announcement.")
    assert league.get_player(player)["score"] == points(9000, 1) == 990_000
    assert league.get_leaderboard()[0]["player"] == player


def test_brier_scale_bounds_and_extremes():
    assert points(10000, 1) == 1_000_000
    assert points(0, 1) == 0
    assert points(5000, 1) == 750_000

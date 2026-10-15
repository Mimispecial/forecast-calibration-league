from pathlib import Path
import pytest
from tests.gltest_windows_compat import install_windows_direct_compatibility

install_windows_direct_compatibility()

CONTRACT = Path(__file__).resolve().parents[1] / "contracts" / "forecast_league.py"

@pytest.fixture
def league(direct_vm, direct_deploy, direct_alice):
    direct_vm.sender = direct_alice
    direct_vm.warp("2026-10-15T12:00:00Z")
    return direct_deploy(str(CONTRACT), "q1", "The named public launch occurs by 2026-10-15.", "Count only a public announcement from the project account before the frozen resolution date.", 1792065660, 1792065720, 1792066200, sdk_version="v0.2.16")

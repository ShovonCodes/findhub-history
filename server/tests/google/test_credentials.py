import stat

import pytest

from findhub.google.credentials import CredentialStore
from findhub.google.errors import AuthRequiredError


def test_values_round_trip_into_an_owner_only_file(tmp_path):
    store = CredentialStore(tmp_path / "nested" / "credentials.json")

    store.set("username", "me@example.com")
    store.set("aas_token", "token")

    assert store.require("username") == "me@example.com"
    assert store.get("aas_token") == "token"
    assert stat.S_IMODE(store.path.stat().st_mode) == 0o600


def test_existing_world_readable_file_becomes_owner_only(tmp_path):
    path = tmp_path / "credentials.json"
    path.write_text('{"username": "me@example.com"}')
    path.chmod(0o644)

    CredentialStore(path).set("aas_token", "token")

    assert stat.S_IMODE(path.stat().st_mode) == 0o600
    assert CredentialStore(path).get("username") == "me@example.com"


def test_missing_file_requires_login(tmp_path):
    store = CredentialStore(tmp_path / "credentials.json")

    assert store.get("aas_token") is None
    with pytest.raises(AuthRequiredError, match="No Google login found"):
        store.require("aas_token")


def test_missing_value_requires_login(tmp_path):
    store = CredentialStore(tmp_path / "credentials.json")
    store.set("username", "me@example.com")

    with pytest.raises(AuthRequiredError, match="owner_key"):
        store.require("owner_key")


def test_corrupt_file_requires_login(tmp_path):
    path = tmp_path / "credentials.json"
    path.write_text("{not json")

    with pytest.raises(AuthRequiredError, match="not valid JSON"):
        CredentialStore(path).get("username")

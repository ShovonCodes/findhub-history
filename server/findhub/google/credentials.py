import json
import os
from pathlib import Path
from typing import Any

from findhub.google.errors import AuthRequiredError

USERNAME = "username"
AAS_TOKEN = "aas_token"
FCM_CREDENTIALS = "fcm_credentials"
SHARED_KEY = "shared_key"
OWNER_KEY = "owner_key"


class CredentialStore:
    """Google login and end-to-end encryption keys, kept in an owner-only JSON file.

    The format matches google-find-hub-sync's secrets.json, so files from either tool work.
    """

    def __init__(self, path: Path):
        self.path = path

    def get(self, name: str) -> Any:
        return self._read().get(name)

    def require(self, name: str) -> Any:
        if not self.path.exists():
            raise AuthRequiredError(f"No Google login found at {self.path}")
        value = self.get(name)
        if not value:
            raise AuthRequiredError(f"'{name}' is missing from {self.path}; log in again")
        return value

    def set(self, name: str, value: Any) -> None:
        values = self._read()
        values[name] = value
        self.path.parent.mkdir(parents=True, exist_ok=True)
        file_descriptor = os.open(self.path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        os.chmod(self.path, 0o600)
        with os.fdopen(file_descriptor, "w") as file:
            json.dump(values, file)

    def _read(self) -> dict:
        try:
            return json.loads(self.path.read_text())
        except FileNotFoundError:
            return {}
        except json.JSONDecodeError as error:
            raise AuthRequiredError(f"{self.path} is not valid JSON; log in again") from error

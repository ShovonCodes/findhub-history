"""Sign in to Google on this computer and save the credentials the server needs.

    python -m findhub.login [--credentials PATH]

Chrome opens twice: once to sign in, once to unlock the end-to-end encryption keys
(Google may ask for a phone's screen lock). Running it again with an existing file
renews the login while keeping the same Google device registration.
"""

import argparse
import asyncio
import logging
from pathlib import Path

from findhub.google import auth, crypto, spot
from findhub.google.client import FindHubClient
from findhub.google.credentials import (
    AAS_TOKEN,
    OWNER_KEY,
    SHARED_KEY,
    USERNAME,
    CredentialStore,
)
from findhub.google.push import PushListener
from findhub.login import browser

DEFAULT_CREDENTIALS_PATH = Path("findhub-credentials.json")
LOCATION_TIMEOUT_SECONDS = 60


def main() -> None:
    logging.basicConfig(level=logging.WARNING)
    parser = argparse.ArgumentParser(description="Sign in to Google Find Hub")
    parser.add_argument("--credentials", type=Path, default=DEFAULT_CREDENTIALS_PATH)
    credentials = CredentialStore(parser.parse_args().credentials)

    print("Step 1/4: registering this login as an Android device with Google...")
    android_id = asyncio.run(_register_device(credentials))

    input("\nStep 2/4: press Enter to open Chrome, then sign in to your Google account.")
    oauth_cookie = browser.sign_in_for_oauth_cookie()
    aas_token, email = auth.exchange_login_cookie(
        credentials.get(USERNAME) or "", oauth_cookie, android_id
    )
    credentials.set(USERNAME, email)
    credentials.set(AAS_TOKEN, aas_token)
    print(f"Signed in as {email}.")

    input(
        "\nStep 3/4: press Enter to open Chrome again and unlock your encryption keys.\n"
        "Sign in, and enter your phone's screen lock if Google asks for it."
    )
    shared_key = browser.sign_in_for_shared_key()
    credentials.set(SHARED_KEY, shared_key.hex())

    print("\nStep 4/4: fetching your Find Hub owner key...")
    spot_token = auth.access_token(
        email, aas_token, android_id, auth.SPOT_SCOPE, app=auth.PLAY_SERVICES_APP
    )
    owner_key = crypto.decrypt_owner_key(shared_key, spot.encrypted_owner_key(spot_token))
    credentials.set(OWNER_KEY, owner_key.hex())

    client = FindHubClient(credentials, LOCATION_TIMEOUT_SECONDS)
    try:
        devices = client.list_devices()
    finally:
        client.close()
    print("\nDone. Devices on this account:")
    for device in devices:
        print(f"  - {device.name}")
    print(f"\nCredentials saved to {credentials.path.resolve()} (readable only by you).")


async def _register_device(credentials: CredentialStore) -> int:
    listener = PushListener(credentials, on_payload=lambda payload: None)
    await listener.register()
    return listener.android_id


if __name__ == "__main__":
    main()

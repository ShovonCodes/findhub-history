"""Google sign-in through a real Chrome window, as the Find Hub Android app does it."""

import base64
import json
import uuid
from collections.abc import Iterator
from contextlib import contextmanager

import undetected_chromedriver as uc
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.support import expected_conditions
from selenium.webdriver.support.ui import WebDriverWait

from findhub.google.proto import device_update_pb2

EMBEDDED_SETUP_URL = "https://accounts.google.com/EmbeddedSetup"
ACCOUNTS_URL = "https://accounts.google.com/"
MY_ACCOUNT_URL = "https://myaccount.google.com"
ENCRYPTION_UNLOCK_URL = "https://accounts.google.com/encryption/unlock/android?kdi="
FIND_HUB_SECURITY_DOMAIN = "finder_hw"
SIGN_IN_TIMEOUT_SECONDS = 300
ALERT_POLL_SECONDS = 0.5

# The unlock page hands keys to the Android app through a JavaScript bridge; we
# provide the same bridge and turn its calls into alerts that Selenium can read.
VAULT_BRIDGE_SCRIPT = """
window.mm = {
    setVaultSharedKeys: (str, vaultKeys) =>
        alert(JSON.stringify({method: 'setVaultSharedKeys', vaultKeys: vaultKeys})),
    closeView: () => alert(JSON.stringify({method: 'closeView'})),
};
"""


class SignInError(Exception):
    pass


def sign_in_for_oauth_cookie() -> str:
    with _chrome() as driver:
        driver.get(EMBEDDED_SETUP_URL)
        WebDriverWait(driver, SIGN_IN_TIMEOUT_SECONDS).until(
            lambda current: current.get_cookie("oauth_token") is not None
        )
        return driver.get_cookie("oauth_token")["value"]


def sign_in_for_shared_key() -> bytes:
    """Unlock the account's end-to-end encryption keys and return the Find Hub shared key."""
    with _chrome() as driver:
        driver.get(ACCOUNTS_URL)
        WebDriverWait(driver, SIGN_IN_TIMEOUT_SECONDS).until(
            expected_conditions.url_contains(MY_ACCOUNT_URL)
        )
        driver.get(_encryption_unlock_url())
        driver.execute_script(VAULT_BRIDGE_SCRIPT)

        while True:
            try:
                WebDriverWait(driver, ALERT_POLL_SECONDS).until(
                    expected_conditions.alert_is_present()
                )
            except TimeoutException:
                continue
            alert = driver.switch_to.alert
            message = json.loads(alert.text)
            alert.accept()

            if message["method"] == "setVaultSharedKeys":
                return _find_hub_shared_key(json.loads(message["vaultKeys"]))
            raise SignInError("The key unlock page closed without sharing any keys")


@contextmanager
def _chrome() -> Iterator[uc.Chrome]:
    options = uc.ChromeOptions()
    options.add_argument("--start-maximized")
    options.add_argument("--disable-extensions")
    driver = uc.Chrome(options=options)
    try:
        yield driver
    finally:
        driver.quit()


def _encryption_unlock_url() -> str:
    request = device_update_pb2.EncryptionUnlockRequestExtras()
    request.operation = 1
    request.securityDomain.name = FIND_HUB_SECURITY_DOMAIN
    request.securityDomain.unknown = 0
    request.sessionId = str(uuid.uuid4())
    return ENCRYPTION_UNLOCK_URL + base64.b64encode(request.SerializeToString()).decode()


def _find_hub_shared_key(vault_keys: dict) -> bytes:
    for entry in vault_keys.get(FIND_HUB_SECURITY_DOMAIN, []):
        key = entry["key"]
        return bytes(key[str(index)] for index in range(len(key)))
    raise SignInError("Google did not return a Find Hub key")

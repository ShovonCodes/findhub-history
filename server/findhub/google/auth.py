import gpsoauth

from findhub.google.errors import AuthRequiredError

FIND_HUB_APP = "com.google.android.apps.adm"
PLAY_SERVICES_APP = "com.google.android.gms"
APP_SIGNATURE_SHA1 = "38918a453d07199354f8b19af05ec6562ced5788"

FIND_HUB_SCOPE = "android_device_manager"
SPOT_SCOPE = "spot"


def exchange_login_cookie(username: str, oauth_cookie: str, android_id: int) -> tuple[str, str]:
    """Turn the browser login cookie into a long-lived master token and the account email."""
    response = gpsoauth.exchange_token(username, oauth_cookie, android_id)
    if "Token" not in response:
        raise AuthRequiredError(f"Google rejected the login ({response.get('Error', 'no token')})")
    return response["Token"], response.get("Email", username)


def access_token(
    username: str, aas_token: str, android_id: int, scope: str, app: str = FIND_HUB_APP
) -> str:
    response = gpsoauth.perform_oauth(
        username,
        aas_token,
        android_id,
        service=f"oauth2:https://www.googleapis.com/auth/{scope}",
        app=app,
        client_sig=APP_SIGNATURE_SHA1,
    )
    if "Auth" not in response:
        raise AuthRequiredError(
            f"Google rejected the stored login ({response.get('Error', 'no token')}); log in again"
        )
    return response["Auth"]

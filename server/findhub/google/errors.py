class AuthRequiredError(Exception):
    """The stored Google login is missing, rejected, or outdated; log in again."""


class GoogleRequestError(Exception):
    """Google answered a request with an error."""


class LocationTimeoutError(Exception):
    """A tracker did not answer a location request in time."""

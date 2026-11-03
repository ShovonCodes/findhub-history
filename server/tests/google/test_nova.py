import pytest

from findhub.google import nova
from findhub.google.errors import AuthRequiredError, GoogleRequestError
from findhub.google.nova import NovaClient
from findhub.google.proto import device_update_pb2 as proto


class FakeResponse:
    def __init__(self, status_code=200, content=b"", text=""):
        self.status_code = status_code
        self.content = content
        self.text = text


class RequestLog(list):
    def __init__(self):
        super().__init__()
        self.responses: list[FakeResponse] = []


@pytest.fixture
def requests_log(monkeypatch) -> RequestLog:
    log = RequestLog()

    def post(url, headers, data, timeout):
        log.append({"url": url, "headers": headers, "data": data})
        return log.responses.pop(0) if log.responses else FakeResponse()

    monkeypatch.setattr(nova.requests, "post", post)
    return log


def test_lists_phones_and_trackers(requests_log):
    devices = proto.DevicesList()
    phone = devices.deviceMetadata.add(userDefinedDeviceName="Phone")
    phone.identifierInformation.type = proto.IDENTIFIER_ANDROID
    phone.identifierInformation.phoneInformation.canonicIds.canonicId.add(id="phone-1")
    tag = devices.deviceMetadata.add(userDefinedDeviceName="Keys")
    tag.identifierInformation.type = proto.IDENTIFIER_SPOT
    tag.identifierInformation.canonicIds.canonicId.add(id="tag-1")
    requests_log.responses.append(FakeResponse(content=devices.SerializeToString()))

    result = NovaClient("access-token").list_devices()

    assert result == [("Phone", "phone-1"), ("Keys", "tag-1")]
    assert requests_log[0]["url"].endswith("/nbe_list_devices")
    assert requests_log[0]["headers"]["Authorization"] == "Bearer access-token"


def test_location_request_carries_push_token_and_request_id(requests_log):
    NovaClient("access-token").request_location("tag-1", "push-token", "request-1")

    request = proto.ExecuteActionRequest()
    request.ParseFromString(requests_log[0]["data"])
    assert requests_log[0]["url"].endswith("/nbe_execute_action")
    assert request.scope.device.canonicId.id == "tag-1"
    assert request.requestMetadata.requestUuid == "request-1"
    assert request.requestMetadata.gcmRegistrationId.id == "push-token"
    assert request.action.locateTracker.contributorType == proto.FMDN_ALL_LOCATIONS


def test_rejected_token_requires_login(requests_log):
    requests_log.responses.append(FakeResponse(status_code=401))

    with pytest.raises(AuthRequiredError):
        NovaClient("expired").list_devices()


def test_other_errors_are_reported(requests_log):
    requests_log.responses.append(FakeResponse(status_code=500, text="backend error"))

    with pytest.raises(GoogleRequestError, match="HTTP 500: backend error"):
        NovaClient("access-token").list_devices()

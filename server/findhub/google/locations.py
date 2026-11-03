import hashlib

from findhub.google import crypto
from findhub.google.errors import AuthRequiredError
from findhub.google.proto import common_pb2, device_update_pb2
from findhub.models import Location


def decrypt_locations(
    device_update: device_update_pb2.DeviceUpdate, owner_key: bytes
) -> list[Location]:
    information = device_update.deviceMetadata.information
    identity_key = _identity_key(information.deviceRegistration, owner_key)
    reports = information.locationInformation.reports.recentLocationAndNetworkLocations

    timed_reports = list(
        zip(reports.networkLocations, reports.networkLocationTimestamps, strict=False)
    )
    if reports.HasField("recentLocation"):
        timed_reports.append((reports.recentLocation, reports.recentLocationTimestamp))

    return [_decrypt_report(report, time.seconds, identity_key) for report, time in timed_reports]


def _identity_key(registration: device_update_pb2.DeviceRegistration, owner_key: bytes) -> bytes:
    try:
        return crypto.decrypt_identity_key(
            owner_key, registration.encryptedUserSecrets.encryptedIdentityKey
        )
    except Exception as error:
        raise AuthRequiredError(
            "Could not decrypt this tracker's key; your end-to-end encryption keys have "
            "probably changed. Log in again"
        ) from error


def _decrypt_report(report: common_pb2.LocationReport, reported_at: int, identity_key: bytes):
    if report.status == common_pb2.Status.SEMANTIC:
        return Location(
            reported_at=reported_at,
            semantic_name=report.semanticLocation.locationName,
        )

    encrypted = report.geoLocation.encryptedReport
    if encrypted.publicKeyRandom:
        payload = crypto.decrypt_crowdsourced_report(
            identity_key,
            encrypted.encryptedLocation,
            encrypted.publicKeyRandom,
            report.geoLocation.deviceTimeOffset,
        )
    else:
        payload = crypto.decrypt_aes_gcm(
            hashlib.sha256(identity_key).digest(), encrypted.encryptedLocation
        )

    position = device_update_pb2.Location()
    position.ParseFromString(payload)
    return Location(
        reported_at=reported_at,
        latitude=position.latitude / 1e7,
        longitude=position.longitude / 1e7,
        altitude=position.altitude,
        accuracy=report.geoLocation.accuracy,
        is_own_report=encrypted.isOwnReport,
    )

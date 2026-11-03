import hashlib
import os

import pytest

from findhub.google.errors import AuthRequiredError
from findhub.google.locations import decrypt_locations
from findhub.google.proto import common_pb2, device_update_pb2
from findhub.models import Location
from tests.google.test_crypto import (
    BEACON_TIME,
    CROWDSOURCED_REPORT,
    IDENTITY_KEY,
    SENDER_PUBLIC_X,
    encrypt_gcm,
)

OWNER_KEY = os.urandom(32)


def device_update(
    recent: common_pb2.LocationReport | None, network: list[common_pb2.LocationReport]
) -> device_update_pb2.DeviceUpdate:
    update = device_update_pb2.DeviceUpdate()
    information = update.deviceMetadata.information
    information.deviceRegistration.encryptedUserSecrets.encryptedIdentityKey = encrypt_gcm(
        OWNER_KEY, IDENTITY_KEY
    )
    reports = information.locationInformation.reports.recentLocationAndNetworkLocations
    for seconds, report in enumerate(network, start=1000):
        reports.networkLocations.append(report)
        reports.networkLocationTimestamps.add(seconds=seconds)
    if recent is not None:
        reports.recentLocation.CopyFrom(recent)
        reports.recentLocationTimestamp.seconds = 2000
    return update


def own_report(latitude: float, longitude: float) -> common_pb2.LocationReport:
    position = device_update_pb2.Location(
        latitude=round(latitude * 1e7), longitude=round(longitude * 1e7), altitude=5
    ).SerializeToString()
    report = common_pb2.LocationReport(status=common_pb2.Status.LAST_KNOWN)
    report.geoLocation.encryptedReport.encryptedLocation = encrypt_gcm(
        hashlib.sha256(IDENTITY_KEY).digest(), position
    )
    report.geoLocation.encryptedReport.isOwnReport = True
    report.geoLocation.accuracy = 8.5
    return report


def crowdsourced_report() -> common_pb2.LocationReport:
    report = common_pb2.LocationReport(status=common_pb2.Status.CROWDSOURCED)
    report.geoLocation.encryptedReport.encryptedLocation = CROWDSOURCED_REPORT
    report.geoLocation.encryptedReport.publicKeyRandom = SENDER_PUBLIC_X
    report.geoLocation.deviceTimeOffset = BEACON_TIME
    report.geoLocation.accuracy = 30
    return report


def semantic_report(name: str) -> common_pb2.LocationReport:
    report = common_pb2.LocationReport(status=common_pb2.Status.SEMANTIC)
    report.semanticLocation.locationName = name
    return report


def test_decrypts_every_report_type():
    update = device_update(
        recent=own_report(23.8103, 90.4125),
        network=[crowdsourced_report(), semantic_report("Home")],
    )

    locations = decrypt_locations(update, OWNER_KEY)

    assert locations == [
        Location(
            reported_at=1000,
            latitude=23.8103,
            longitude=90.4125,
            altitude=12,
            accuracy=30,
            is_own_report=False,
        ),
        Location(reported_at=1001, semantic_name="Home"),
        Location(
            reported_at=2000,
            latitude=23.8103,
            longitude=90.4125,
            altitude=5,
            accuracy=8.5,
            is_own_report=True,
        ),
    ]


def test_no_reports_means_no_locations():
    assert decrypt_locations(device_update(recent=None, network=[]), OWNER_KEY) == []


def test_wrong_owner_key_asks_for_a_new_login():
    update = device_update(recent=own_report(1, 2), network=[])

    with pytest.raises(AuthRequiredError, match="encryption keys"):
        decrypt_locations(update, os.urandom(32))

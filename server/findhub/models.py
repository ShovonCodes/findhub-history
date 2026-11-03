from dataclasses import dataclass


@dataclass(frozen=True)
class Device:
    id: str
    name: str


@dataclass(frozen=True)
class Location:
    reported_at: int
    latitude: float | None = None
    longitude: float | None = None
    altitude: float | None = None
    accuracy: float | None = None
    semantic_name: str | None = None
    is_own_report: bool | None = None

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, field_validator


class DetectionType(str, Enum):
    fire = "fire"
    smoke = "smoke"
    both = "both"


class IncidentStatus(str, Enum):
    open = "open"
    acknowledged = "acknowledged"
    resolved = "resolved"


class OrganizationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    slug: str
    created_at: datetime


class SiteCreate(BaseModel):
    organization_id: str
    name: str = Field(min_length=1, max_length=200)
    address: str | None = Field(default=None, max_length=500)
    timezone: str = Field(default="UTC", min_length=1, max_length=64)

    @field_validator("name", "organization_id", "timezone")
    @classmethod
    def trim_required(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("must not be blank")
        return value

    @field_validator("address")
    @classmethod
    def trim_address(cls, value: str | None) -> str | None:
        return value.strip() if value and value.strip() else None


class SiteRead(SiteCreate):
    model_config = ConfigDict(from_attributes=True)
    id: str
    created_at: datetime


class VideoAnalysisRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    site_id: str
    filename: str
    status: str
    duration_seconds: float | None
    frame_width: int | None
    frame_height: int | None
    fire_count: int
    smoke_count: int
    people_count: int
    error: str | None
    created_at: datetime


class VideoAnalysisDetail(VideoAnalysisRead):
    samples: list[dict]


class CameraCreate(BaseModel):
    site_id: str
    name: str = Field(min_length=1, max_length=200)
    stream_url: str | None = Field(default=None, max_length=1000)
    is_active: bool = True

    @field_validator("name", "site_id")
    @classmethod
    def trim_required(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("must not be blank")
        return value

    @field_validator("stream_url")
    @classmethod
    def validate_stream_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            return None
        if value.isdigit():
            return f"local://{value}"
        scheme = value.split(":", 1)[0].lower()
        if scheme not in {"demo", "file", "local", "rtsp", "rtsps", "http", "https"}:
            raise ValueError("stream_url must use demo://, file://, local://, rtsp, rtsps, http, or https")
        if scheme == "demo" and not value.removeprefix("demo://").strip():
            raise ValueError("demo camera sources must include a label")
        if scheme == "local" and not value.removeprefix("local://").isdigit():
            raise ValueError("local camera sources must use local:// followed by a camera index")
        if scheme == "file" and not value.removeprefix("file://").strip():
            raise ValueError("video file sources must include a path")
        return value


class CameraRead(CameraCreate):
    model_config = ConfigDict(from_attributes=True)
    id: str
    status: str
    last_seen_at: datetime | None
    created_at: datetime


class IncidentCreate(BaseModel):
    camera_id: str
    detection_type: DetectionType
    confidence: float | None = Field(default=None, ge=0, le=1)
    notes: str | None = Field(default=None, max_length=5000)

    @field_validator("camera_id")
    @classmethod
    def trim_camera_id(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("must not be blank")
        return value


class IncidentRead(IncidentCreate):
    model_config = ConfigDict(from_attributes=True)
    id: str
    status: IncidentStatus
    detected_at: datetime
    resolved_at: datetime | None


class OrganizationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    slug: str = Field(min_length=1, max_length=100, pattern=r"^[a-z0-9-]+$")

    @field_validator("name", "slug")
    @classmethod
    def trim_values(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("must not be blank")
        return value


class DemoRequestCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    email: str = Field(min_length=3, max_length=320)
    company: str = Field(min_length=1, max_length=200)
    industry: str = Field(min_length=1, max_length=100)

    @field_validator("name", "company", "industry")
    @classmethod
    def trim_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("must not be blank")
        return value

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        value = value.strip().lower()
        if "@" not in value or value.startswith("@") or value.endswith("@"):
            raise ValueError("must be a valid email address")
        local, _, domain = value.rpartition("@")
        if not local or "." not in domain or domain.startswith(".") or domain.endswith("."):
            raise ValueError("must be a valid email address")
        return value


class DemoRequestRead(DemoRequestCreate):
    model_config = ConfigDict(from_attributes=True)
    id: str
    status: str
    created_at: datetime


class CameraTestResult(BaseModel):
    camera_id: str
    reachable: bool
    status: str
    detail: str


class CameraDetectionTestResult(BaseModel):
    camera_id: str
    incident_id: str | None
    detection_type: DetectionType
    confidence: float
    detail: str


class IncidentStatusUpdate(BaseModel):
    status: IncidentStatus
    notes: str | None = Field(default=None, max_length=5000)

    @field_validator("notes")
    @classmethod
    def trim_notes(cls, value: str | None) -> str | None:
        return value.strip() if value and value.strip() else None


class DashboardSummary(BaseModel):
    sites_total: int
    cameras_total: int
    cameras_online: int
    incidents_open: int
    incidents_today: int
    people_now: int = 0
    crowd_alerts_today: int = 0


class AnalyticsEventCreate(BaseModel):
    camera_id: str
    event_type: str = Field(pattern=r"^(people_count|crowd_alert|zone_presence|line_crossing)$")
    people_count: int = Field(ge=0, le=100000)
    confidence: float | None = Field(default=None, ge=0, le=1)
    details: dict[str, str | int | float | bool | None] = Field(default_factory=dict)


class AnalyticsEventRead(AnalyticsEventCreate):
    model_config = ConfigDict(from_attributes=True)
    id: str
    detected_at: datetime


class NotificationContactCreate(BaseModel):
    organization_id: str
    name: str = Field(min_length=1, max_length=200)
    role: str = Field(min_length=1, max_length=32)
    email: str | None = Field(default=None, max_length=320)
    phone: str | None = Field(default=None, max_length=32)
    email_enabled: bool = True
    whatsapp_enabled: bool = False

    @field_validator("organization_id", "name", "role")
    @classmethod
    def trim_required(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("must not be blank")
        return value

    @field_validator("email", "phone")
    @classmethod
    def trim_optional(cls, value: str | None) -> str | None:
        return value.strip() if value and value.strip() else None


class NotificationContactRead(NotificationContactCreate):
    model_config = ConfigDict(from_attributes=True)
    id: str
    is_active: bool
    created_at: datetime


class NotificationTestRequest(BaseModel):
    channel: str = Field(pattern=r"^(email|whatsapp)$")

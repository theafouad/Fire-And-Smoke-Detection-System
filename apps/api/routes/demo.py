from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from apps.api.core.database import get_db
from apps.api.models import Camera, DetectionType, Incident, IncidentStatus, Organization, Site

router = APIRouter(prefix="/demo", tags=["demo"])


@router.post("/seed")
def seed_demo_workspace(db: Session = Depends(get_db)) -> dict[str, int | str]:
    organization = db.scalar(select(Organization).where(Organization.slug == "flameeye-demo"))
    if organization is not None:
        sites = list(db.scalars(select(Site).where(Site.organization_id == organization.id)).all())
        cameras = list(db.scalars(select(Camera).where(Camera.site_id.in_([site.id for site in sites]))).all()) if sites else []
        incidents = list(db.scalars(select(Incident).where(Incident.camera_id.in_([camera.id for camera in cameras]))).all()) if cameras else []
        return {"status": "ready", "sites": len(sites), "cameras": len(cameras), "incidents": len(incidents)}

    organization = Organization(name="FlameEye Demo Workspace", slug="flameeye-demo")
    db.add(organization)
    db.flush()

    north_site = Site(
        organization_id=organization.id,
        name="Northstar Manufacturing",
        address="Building A · Main production campus",
        timezone="UTC",
    )
    harbor_site = Site(
        organization_id=organization.id,
        name="Harbor Logistics",
        address="Loading and storage facility",
        timezone="UTC",
    )
    db.add_all([north_site, harbor_site])
    db.flush()

    cameras = [
        Camera(site_id=north_site.id, name="Production floor", stream_url="demo://production-floor", status="online"),
        Camera(site_id=north_site.id, name="Chemical storage", stream_url="demo://chemical-storage", status="online"),
        Camera(site_id=north_site.id, name="North loading bay", stream_url="demo://north-loading", status="online"),
        Camera(site_id=harbor_site.id, name="Warehouse aisle 04", stream_url="demo://warehouse-aisle", status="online"),
        Camera(site_id=harbor_site.id, name="Vehicle gate", stream_url="demo://vehicle-gate", status="offline"),
    ]
    db.add_all(cameras)
    db.flush()

    now = datetime.utcnow()
    db.add_all(
        [
            Incident(
                camera_id=cameras[1].id,
                detection_type=DetectionType.smoke,
                confidence=0.91,
                status=IncidentStatus.open,
                notes="Demo event: operator review recommended.",
                detected_at=now - timedelta(minutes=8),
            ),
            Incident(
                camera_id=cameras[3].id,
                detection_type=DetectionType.fire,
                confidence=0.87,
                status=IncidentStatus.acknowledged,
                notes="Demo event: security team dispatched.",
                detected_at=now - timedelta(hours=2),
            ),
        ]
    )
    db.commit()
    return {"status": "seeded", "sites": 2, "cameras": 5, "incidents": 2}

from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from apps.api.core.database import get_db
from apps.api.models import Camera, DetectionType, Incident, IncidentStatus, NotificationContact
from apps.api.schemas import IncidentCreate, IncidentRead, IncidentStatusUpdate
from apps.api.services.notifications import send_incident_alert

router = APIRouter(prefix="/incidents", tags=["incidents"])


@router.get("", response_model=list[IncidentRead])
def list_incidents(
    status_filter: IncidentStatus | None = Query(default=None, alias="status"),
    camera_id: str | None = Query(default=None),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=200),
    db: Session = Depends(get_db),
) -> list[Incident]:
    query = select(Incident).order_by(Incident.detected_at.desc()).offset(offset).limit(limit)
    if status_filter is not None:
        query = query.where(Incident.status == status_filter)
    if camera_id:
        query = query.where(Incident.camera_id == camera_id)
    return list(db.scalars(query).all())


@router.get("/{incident_id}", response_model=IncidentRead)
def get_incident(incident_id: str, db: Session = Depends(get_db)) -> Incident:
    incident = db.get(Incident, incident_id)
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident


@router.post("", response_model=IncidentRead, status_code=status.HTTP_201_CREATED)
def create_incident(
    payload: IncidentCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> Incident:
    camera = db.get(Camera, payload.camera_id)
    if camera is None:
        raise HTTPException(status_code=404, detail="Camera not found")
    values = payload.model_dump()
    values["detection_type"] = DetectionType(values["detection_type"].value)
    incident = Incident(**values)
    db.add(incident)
    db.commit()
    db.refresh(incident)
    notes = payload.notes or ""
    if not notes.startswith(("Operator-triggered", "DEMO MODE:")):
        contacts = list(
            db.scalars(
                select(NotificationContact).where(
                    NotificationContact.organization_id == camera.site.organization_id,
                    NotificationContact.is_active.is_(True),
                )
            ).all()
        )
        if contacts:
            background_tasks.add_task(
                send_incident_alert,
                contacts,
                incident.detection_type.value,
                incident.confidence,
                camera.name,
            )
    return incident


@router.patch("/{incident_id}/status", response_model=IncidentRead)
def update_status(incident_id: str, payload: IncidentStatusUpdate, db: Session = Depends(get_db)) -> Incident:
    incident = db.get(Incident, incident_id)
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    incident.status = IncidentStatus(payload.status.value)
    if payload.notes is not None:
        incident.notes = payload.notes
    incident.resolved_at = (
        datetime.utcnow() if payload.status.value == IncidentStatus.resolved.value else None
    )
    db.commit()
    db.refresh(incident)
    return incident

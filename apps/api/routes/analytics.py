from datetime import datetime, time

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from apps.api.core.database import get_db
from apps.api.models import AnalyticsEvent, Camera
from apps.api.schemas import AnalyticsEventCreate, AnalyticsEventRead

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/events", response_model=list[AnalyticsEventRead])
def list_events(
    camera_id: str | None = None,
    event_type: str | None = None,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
) -> list[AnalyticsEvent]:
    query = select(AnalyticsEvent).order_by(AnalyticsEvent.detected_at.desc()).offset(offset).limit(limit)
    if camera_id:
        query = query.where(AnalyticsEvent.camera_id == camera_id)
    if event_type:
        query = query.where(AnalyticsEvent.event_type == event_type)
    return list(db.scalars(query).all())


@router.post("/events", response_model=AnalyticsEventRead, status_code=status.HTTP_201_CREATED)
def create_event(payload: AnalyticsEventCreate, db: Session = Depends(get_db)) -> AnalyticsEvent:
    if db.get(Camera, payload.camera_id) is None:
        raise HTTPException(status_code=404, detail="Camera not found")
    event = AnalyticsEvent(**payload.model_dump())
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@router.get("/summary")
def summary(db: Session = Depends(get_db)) -> dict[str, int]:
    events = list(db.scalars(select(AnalyticsEvent).order_by(AnalyticsEvent.detected_at.desc()).limit(500)).all())
    latest_by_camera: dict[str, AnalyticsEvent] = {}
    for event in events:
        latest_by_camera.setdefault(event.camera_id, event)
    start_of_day = datetime.combine(datetime.utcnow().date(), time.min)
    return {
        "people_now": sum(event.people_count for event in latest_by_camera.values()),
        "crowd_alerts_today": sum(
            1 for event in events if event.event_type == "crowd_alert" and event.detected_at >= start_of_day
        ),
        "monitored_cameras": len(latest_by_camera),
    }

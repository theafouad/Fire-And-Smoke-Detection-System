from datetime import datetime, time

from fastapi import APIRouter, Depends, Query

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from apps.api.core.database import get_db
from apps.api.models import AnalyticsEvent, Camera, Incident, IncidentStatus, Site
from apps.api.schemas import DashboardSummary

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummary)
def summary(
    organization_id: str | None = Query(default=None),
    site_id: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> DashboardSummary:
    site_filters = []
    if site_id:
        site_filters.append(Site.id == site_id)
    if organization_id:
        site_filters.append(Site.organization_id == organization_id)

    def filtered_count(model: type[object], *conditions: object) -> int:
        query = select(func.count()).select_from(model)
        if model is Site and site_filters:
            query = query.where(*site_filters)
        elif model is Camera and site_filters:
            query = query.join(Site).where(*site_filters)
        elif model is Incident and site_filters:
            query = query.join(Camera).join(Site).where(*site_filters)
        if conditions:
            query = query.where(*conditions)
        return int(db.scalar(query) or 0)

    start_of_day = datetime.combine(datetime.utcnow().date(), time.min)
    cameras_total = filtered_count(Camera)
    analytics_events = list(db.scalars(select(AnalyticsEvent).order_by(AnalyticsEvent.detected_at.desc()).limit(500)).all())
    latest_counts: dict[str, int] = {}
    for event in analytics_events:
        latest_counts.setdefault(event.camera_id, event.people_count)
    return DashboardSummary(
        sites_total=filtered_count(Site),
        cameras_total=cameras_total,
        cameras_online=filtered_count(Camera, Camera.status == "online"),
        incidents_open=filtered_count(Incident, Incident.status == IncidentStatus.open),
        incidents_today=filtered_count(Incident, Incident.detected_at >= start_of_day),
        people_now=sum(latest_counts.values()),
        crowd_alerts_today=sum(1 for event in analytics_events if event.event_type == "crowd_alert" and event.detected_at >= start_of_day),
    )

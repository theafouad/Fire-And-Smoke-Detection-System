from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from apps.api.core.database import get_db
from apps.api.models import Camera, DetectionType, Incident, Site
from apps.api.schemas import CameraCreate, CameraDetectionTestResult, CameraRead, CameraTestResult

router = APIRouter(prefix="/cameras", tags=["cameras"])


@router.get("", response_model=list[CameraRead])
def list_cameras(
    site_id: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=200),
    db: Session = Depends(get_db),
) -> list[Camera]:
    query = select(Camera).order_by(Camera.created_at.desc()).offset(offset).limit(limit)
    if site_id:
        query = query.where(Camera.site_id == site_id)
    if status_filter:
        if status_filter not in {"online", "offline"}:
            raise HTTPException(status_code=400, detail="status must be online or offline")
        query = query.where(Camera.status == status_filter)
    return list(db.scalars(query).all())


@router.get("/{camera_id}", response_model=CameraRead)
def get_camera(camera_id: str, db: Session = Depends(get_db)) -> Camera:
    camera = db.get(Camera, camera_id)
    if camera is None:
        raise HTTPException(status_code=404, detail="Camera not found")
    return camera


@router.post("", response_model=CameraRead, status_code=status.HTTP_201_CREATED)
def create_camera(payload: CameraCreate, db: Session = Depends(get_db)) -> Camera:
    if db.get(Site, payload.site_id) is None:
        raise HTTPException(status_code=404, detail="Site not found")
    camera = Camera(**payload.model_dump())
    db.add(camera)
    db.commit()
    db.refresh(camera)
    return camera


@router.post("/{camera_id}/test", response_model=CameraTestResult)
def test_camera(camera_id: str, db: Session = Depends(get_db)) -> CameraTestResult:
    camera = db.get(Camera, camera_id)
    if camera is None:
        raise HTTPException(status_code=404, detail="Camera not found")
    if not camera.stream_url:
        return CameraTestResult(
            camera_id=camera.id,
            reachable=False,
            status="offline",
            detail="No RTSP or camera source has been configured",
        )

    if camera.stream_url.startswith("demo://"):
        camera.status = "online"
        camera.last_seen_at = datetime.utcnow()
        db.commit()
        return CameraTestResult(
            camera_id=camera.id,
            reachable=True,
            status=camera.status,
            detail="Demo camera source is available for workspace preview",
        )

    try:
        import cv2

        source = camera.stream_url
        if source.startswith("local://"):
            source = int(source.removeprefix("local://"))
        elif source.startswith("file://"):
            source = source.removeprefix("file://")
        candidates = []
        if isinstance(source, int):
            for backend in (cv2.CAP_MSMF, cv2.CAP_DSHOW, cv2.CAP_ANY):
                try:
                    candidates.append(cv2.VideoCapture(source, backend))
                except cv2.error:
                    continue
        else:
            candidates.append(cv2.VideoCapture(source))
        reachable = False
        for capture in candidates:
            try:
                if capture.isOpened():
                    reachable = True
                    break
            finally:
                capture.release()
    except Exception as exc:
        camera.status = "offline"
        db.commit()
        return CameraTestResult(
            camera_id=camera.id,
            reachable=False,
            status=camera.status,
            detail=f"Camera test failed: {type(exc).__name__}",
        )
    camera.status = "online" if reachable else "offline"
    camera.last_seen_at = datetime.utcnow() if reachable else camera.last_seen_at
    db.commit()
    return CameraTestResult(
        camera_id=camera.id,
        reachable=reachable,
        status=camera.status,
        detail="Camera stream opened successfully" if reachable else "Unable to open camera stream",
    )


@router.post("/{camera_id}/test-detection", response_model=CameraDetectionTestResult)
def test_detection(camera_id: str, db: Session = Depends(get_db)) -> CameraDetectionTestResult:
    camera = db.get(Camera, camera_id)
    if camera is None:
        raise HTTPException(status_code=404, detail="Camera not found")
    if not camera.stream_url:
        raise HTTPException(status_code=400, detail="Connect a camera source before running a detection test")
    if camera.status != "online":
        raise HTTPException(status_code=409, detail="Test the camera source successfully before running a detection test")
    if not camera.stream_url.startswith("demo://"):
        return CameraDetectionTestResult(
            camera_id=camera.id,
            incident_id=None,
            detection_type=DetectionType.smoke,
            confidence=0.0,
            detail="Source is reachable. Live fire/smoke and people analysis run continuously in the edge agent; review the annotated camera preview.",
        )
    incident = Incident(
        camera_id=camera.id,
        detection_type=DetectionType.smoke,
        confidence=0.94,
        notes="Operator-triggered detection test. No emergency response required.",
    )
    db.add(incident)
    db.commit()
    db.refresh(incident)
    return CameraDetectionTestResult(
        camera_id=camera.id,
        incident_id=incident.id,
        detection_type=incident.detection_type,
        confidence=incident.confidence or 0.0,
        detail="Detection test created a reviewable smoke event in the incident queue.",
    )

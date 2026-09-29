from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from apps.api.core.database import get_db
from apps.api.models import DemoRequest
from apps.api.schemas import DemoRequestCreate, DemoRequestRead

router = APIRouter(prefix="/demo-requests", tags=["demo requests"])


@router.post("", response_model=DemoRequestRead, status_code=status.HTTP_201_CREATED)
def create_demo_request(payload: DemoRequestCreate, db: Session = Depends(get_db)) -> DemoRequest:
    request = DemoRequest(**payload.model_dump())
    db.add(request)
    db.commit()
    db.refresh(request)
    return request


@router.get("", response_model=list[DemoRequestRead])
def list_demo_requests(
    status_filter: str | None = Query(default=None, alias="status"),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=200),
    db: Session = Depends(get_db),
) -> list[DemoRequest]:
    query = select(DemoRequest).order_by(DemoRequest.created_at.desc()).offset(offset).limit(limit)
    if status_filter:
        query = query.where(DemoRequest.status == status_filter)
    return list(db.scalars(query).all())


@router.get("/{request_id}", response_model=DemoRequestRead)
def get_demo_request(request_id: str, db: Session = Depends(get_db)) -> DemoRequest:
    request = db.get(DemoRequest, request_id)
    if request is None:
        raise HTTPException(status_code=404, detail="Demo request not found")
    return request

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from apps.api.core.database import get_db
from apps.api.models import Organization, Site
from apps.api.schemas import SiteCreate, SiteRead

router = APIRouter(prefix="/sites", tags=["sites"])


@router.get("", response_model=list[SiteRead])
def list_sites(
    organization_id: str | None = Query(default=None),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=200),
    db: Session = Depends(get_db),
) -> list[Site]:
    query = select(Site).order_by(Site.created_at.desc()).offset(offset).limit(limit)
    if organization_id:
        query = query.where(Site.organization_id == organization_id)
    return list(db.scalars(query).all())


@router.get("/{site_id}", response_model=SiteRead)
def get_site(site_id: str, db: Session = Depends(get_db)) -> Site:
    site = db.get(Site, site_id)
    if site is None:
        raise HTTPException(status_code=404, detail="Site not found")
    return site


@router.post("", response_model=SiteRead, status_code=status.HTTP_201_CREATED)
def create_site(payload: SiteCreate, db: Session = Depends(get_db)) -> Site:
    if db.get(Organization, payload.organization_id) is None:
        raise HTTPException(status_code=404, detail="Organization not found")
    site = Site(**payload.model_dump())
    db.add(site)
    db.commit()
    db.refresh(site)
    return site

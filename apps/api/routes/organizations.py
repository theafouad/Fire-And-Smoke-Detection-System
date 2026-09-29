from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from apps.api.core.database import get_db
from apps.api.models import Organization
from apps.api.schemas import OrganizationCreate, OrganizationRead

router = APIRouter(prefix="/organizations", tags=["organizations"])


@router.get("", response_model=list[OrganizationRead])
def list_organizations(
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=200),
    db: Session = Depends(get_db),
) -> list[Organization]:
    return list(
        db.scalars(
            select(Organization).order_by(Organization.created_at).offset(offset).limit(limit)
        ).all()
    )


@router.get("/{organization_id}", response_model=OrganizationRead)
def get_organization(organization_id: str, db: Session = Depends(get_db)) -> Organization:
    organization = db.get(Organization, organization_id)
    if organization is None:
        raise HTTPException(status_code=404, detail="Organization not found")
    return organization


@router.post("", response_model=OrganizationRead, status_code=status.HTTP_201_CREATED)
def create_organization(payload: OrganizationCreate, db: Session = Depends(get_db)) -> Organization:
    if db.scalar(select(Organization).where(Organization.slug == payload.slug)) is not None:
        raise HTTPException(status_code=409, detail="Organization slug already exists")
    organization = Organization(**payload.model_dump())
    db.add(organization)
    db.commit()
    db.refresh(organization)
    return organization

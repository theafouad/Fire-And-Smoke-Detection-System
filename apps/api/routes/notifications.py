from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from apps.api.core.database import get_db
from apps.api.models import NotificationContact, Organization
from apps.api.schemas import NotificationContactCreate, NotificationContactRead, NotificationTestRequest
from apps.api.services.notifications import send_notification_test

router = APIRouter(prefix="/organizations/{organization_id}/notifications", tags=["notifications"])


@router.get("/contacts", response_model=list[NotificationContactRead])
def list_contacts(organization_id: str, db: Session = Depends(get_db)) -> list[NotificationContact]:
    if db.get(Organization, organization_id) is None:
        raise HTTPException(status_code=404, detail="Organization not found")
    return list(
        db.scalars(
            select(NotificationContact)
            .where(NotificationContact.organization_id == organization_id)
            .order_by(NotificationContact.created_at)
        ).all()
    )


@router.post("/contacts", response_model=NotificationContactRead, status_code=status.HTTP_201_CREATED)
def create_contact(
    organization_id: str, payload: NotificationContactCreate, db: Session = Depends(get_db)
) -> NotificationContact:
    if organization_id != payload.organization_id:
        raise HTTPException(status_code=400, detail="Organization IDs do not match")
    if db.get(Organization, organization_id) is None:
        raise HTTPException(status_code=404, detail="Organization not found")
    if payload.email_enabled and not payload.email:
        raise HTTPException(status_code=400, detail="An email address is required when email alerts are enabled")
    if payload.whatsapp_enabled and not payload.phone:
        raise HTTPException(status_code=400, detail="A phone number is required when WhatsApp alerts are enabled")
    contact = NotificationContact(**payload.model_dump())
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return contact


@router.post("/contacts/{contact_id}/test")
def test_contact(
    organization_id: str,
    contact_id: str,
    payload: NotificationTestRequest,
    db: Session = Depends(get_db),
) -> dict[str, str]:
    contact = db.scalar(
        select(NotificationContact).where(
            NotificationContact.id == contact_id,
            NotificationContact.organization_id == organization_id,
        )
    )
    if contact is None:
        raise HTTPException(status_code=404, detail="Notification contact not found")
    destination = contact.email if payload.channel == "email" else contact.phone
    if not destination:
        raise HTTPException(status_code=400, detail=f"No {payload.channel} destination is configured for this contact")
    try:
        send_notification_test(payload.channel, destination, contact.name)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {"status": "sent", "channel": payload.channel, "destination": destination}

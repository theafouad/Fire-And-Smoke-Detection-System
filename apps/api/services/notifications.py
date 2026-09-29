import os
import smtplib
from email.message import EmailMessage
import logging

import requests

logger = logging.getLogger(__name__)


def send_notification_test(channel: str, destination: str, recipient_name: str) -> None:
    if channel == "email":
        host = os.getenv("SMTP_HOST", "")
        username = os.getenv("SMTP_USERNAME", "")
        password = os.getenv("SMTP_PASSWORD", "")
        sender = os.getenv("SENDER_EMAIL", username)
        if not host or not username or not password or not sender:
            raise RuntimeError("Email is not configured. Set SMTP_HOST, SMTP_USERNAME, SMTP_PASSWORD, and SENDER_EMAIL.")
        message = EmailMessage()
        message["From"] = sender
        message["To"] = destination
        message["Subject"] = "FlameEye alert test"
        message.set_content(
            f"Hello {recipient_name},\n\nThis is a test alert from FlameEye. Your email destination is ready."
        )
        with smtplib.SMTP(host, int(os.getenv("SMTP_PORT", "587")), timeout=20) as server:
            server.starttls()
            server.login(username, password)
            server.send_message(message)
        return

    if channel == "whatsapp":
        token = os.getenv("WHATSAPP_ACCESS_TOKEN", "")
        phone_number_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
        if not token or not phone_number_id:
            raise RuntimeError(
                "WhatsApp is not configured. Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID."
            )
        response = requests.post(
            f"https://graph.facebook.com/v21.0/{phone_number_id}/messages",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json={
                "messaging_product": "whatsapp",
                "to": destination.lstrip("+"),
                "type": "text",
                "text": {"body": f"FlameEye test alert for {recipient_name}: WhatsApp delivery is ready."},
            },
            timeout=20,
        )
        if not response.ok:
            raise RuntimeError(f"WhatsApp provider rejected the test message ({response.status_code}).")
        return

    raise RuntimeError("Unsupported notification channel.")


def send_incident_alert(
    contacts: list[object],
    detection_type: str,
    confidence: float | None,
    camera_name: str,
) -> None:
    subject = f"FlameEye alert: {detection_type} detected at {camera_name}"
    body = (
        f"FlameEye detected {detection_type} at {camera_name}.\n"
        f"Confidence: {confidence:.0%}\n\n"
        "Open the FlameEye incident queue to review the event."
    )
    for contact in contacts:
        if getattr(contact, "email_enabled", False) and getattr(contact, "email", None):
            try:
                _send_email(contact.email, subject, body)
            except (OSError, RuntimeError, smtplib.SMTPException, ValueError) as exc:
                logger.error("Email alert failed for contact %s: %s", contact.id, exc)
        if getattr(contact, "whatsapp_enabled", False) and getattr(contact, "phone", None):
            try:
                _send_whatsapp(contact.phone, body)
            except (OSError, RuntimeError, requests.RequestException, ValueError) as exc:
                logger.error("WhatsApp alert failed for contact %s: %s", contact.id, exc)


def _send_email(destination: str, subject: str, body: str) -> None:
    host = os.getenv("SMTP_HOST", "")
    username = os.getenv("SMTP_USERNAME", "")
    password = os.getenv("SMTP_PASSWORD", "")
    sender = os.getenv("SENDER_EMAIL", username)
    if not host or not username or not password or not sender:
        raise RuntimeError("Email provider is not configured")
    message = EmailMessage()
    message["From"] = sender
    message["To"] = destination
    message["Subject"] = subject
    message.set_content(body)
    with smtplib.SMTP(host, int(os.getenv("SMTP_PORT", "587")), timeout=20) as server:
        server.starttls()
        server.login(username, password)
        server.send_message(message)


def _send_whatsapp(destination: str, body: str) -> None:
    token = os.getenv("WHATSAPP_ACCESS_TOKEN", "")
    phone_number_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
    if not token or not phone_number_id:
        raise RuntimeError("WhatsApp provider is not configured")
    response = requests.post(
        f"https://graph.facebook.com/v21.0/{phone_number_id}/messages",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json={
            "messaging_product": "whatsapp",
            "to": destination.lstrip("+"),
            "type": "text",
            "text": {"body": body},
        },
        timeout=20,
    )
    response.raise_for_status()

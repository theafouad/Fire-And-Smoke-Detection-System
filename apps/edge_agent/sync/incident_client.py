import logging
from urllib.error import URLError
from urllib.request import Request, urlopen
import json

logger = logging.getLogger(__name__)


class IncidentClient:
    def __init__(self, base_url: str, camera_id: str):
        self.url = f"{base_url.rstrip('/')}/api/incidents"
        self.camera_id = camera_id

    def create(self, detection_type: str, confidence: float | None, notes: str = "") -> bool:
        if not self.camera_id:
            return False
        payload = json.dumps(
            {
                "camera_id": self.camera_id,
                "detection_type": detection_type,
                "confidence": confidence,
                "notes": notes or None,
            }
        ).encode("utf-8")
        request = Request(
            self.url,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urlopen(request, timeout=10) as response:
                return 200 <= response.status < 300
        except (OSError, URLError) as exc:
            logger.warning("Unable to create cloud incident: %s", exc)
            return False

import json
import logging
from urllib.error import URLError
from urllib.request import Request, urlopen

logger = logging.getLogger(__name__)


class AnalyticsClient:
    def __init__(self, base_url: str, camera_id: str):
        self.url = f"{base_url.rstrip('/')}/api/analytics/events"
        self.camera_id = camera_id

    def create(self, event_type: str, people_count: int, details: dict, confidence: float | None = None) -> bool:
        if not self.camera_id:
            return False
        payload = json.dumps({
            "camera_id": self.camera_id,
            "event_type": event_type,
            "people_count": people_count,
            "confidence": confidence,
            "details": details,
        }).encode("utf-8")
        request = Request(self.url, data=payload, headers={"Content-Type": "application/json"}, method="POST")
        try:
            with urlopen(request, timeout=5) as response:
                return 200 <= response.status < 300
        except (OSError, URLError) as exc:
            logger.warning("Unable to sync analytics event: %s", exc)
            return False

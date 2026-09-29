"""Background processing for uploaded, prerecorded site video."""

import logging
import cv2

from apps.api.core.config import get_settings
from apps.api.core.database import SessionLocal
from apps.api.models import VideoAnalysis

logger = logging.getLogger(__name__)


def process_video_analysis(analysis_id: str) -> None:
    db = SessionLocal()
    capture = None
    try:
        job = db.get(VideoAnalysis, analysis_id)
        if job is None:
            return
        job.status = "processing"
        db.commit()

        settings = get_settings()
        source_path = settings.video_storage_dir / job.stored_filename
        capture = cv2.VideoCapture(str(source_path))
        if not capture.isOpened():
            raise ValueError("The uploaded file could not be decoded as a video.")

        from apps.edge_agent.detection.analyzer import AnalystAgent

        analyst = AnalystAgent()
        fps = capture.get(cv2.CAP_PROP_FPS) or 25.0
        frame_count = capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0
        width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
        duration = frame_count / fps if frame_count > 0 else 0
        if duration > settings.video_max_duration_seconds:
            raise ValueError(f"Video is longer than the {settings.video_max_duration_seconds // 60}-minute limit.")

        job.frame_width = width
        job.frame_height = height
        job.duration_seconds = duration or None
        db.commit()

        samples = []
        fire_count = smoke_count = max_people = 0
        next_sample_time = 0.0
        frame_index = 0
        while True:
            ok, frame = capture.read()
            if not ok:
                break
            timestamp = frame_index / fps
            frame_index += 1
            if timestamp + 1e-6 < next_sample_time:
                continue
            result = analyst.analyze(frame)
            hazards = []
            for item in result["hazards"]:
                label = item["type"]
                fire_count += label == "fire"
                smoke_count += label == "smoke"
                x1, y1, x2, y2 = item["box"]
                hazards.append({
                    "type": label,
                    "confidence": item["confidence"],
                    "box": [x1 / width, y1 / height, x2 / width, y2 / height],
                })
            people = []
            for person in result["people"]:
                x1, y1, x2, y2 = person["box"]
                people.append([x1 / width, y1 / height, x2 / width, y2 / height])
            max_people = max(max_people, result["people_count"])
            samples.append({
                "time_seconds": round(timestamp, 3),
                "hazards": hazards,
                "people": people,
                "people_count": result["people_count"],
                "work_zone_count": result["work_zone_count"],
            })
            next_sample_time = timestamp + 0.5

        if not samples:
            raise ValueError("No readable frames were found in this video.")
        job.samples = samples
        job.fire_count = fire_count
        job.smoke_count = smoke_count
        job.people_count = max_people
        job.status = "complete"
        db.commit()
    except Exception as exc:
        logger.exception("Video analysis %s failed", analysis_id)
        job = db.get(VideoAnalysis, analysis_id)
        if job is not None:
            job.status = "failed"
            job.error = str(exc)[:1000]
            db.commit()
    finally:
        if capture is not None:
            capture.release()
        db.close()

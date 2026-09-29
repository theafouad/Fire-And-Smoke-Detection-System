"""Frame inference for hazards and privacy-preserving people analytics."""

import logging

import cv2
from ultralytics import YOLO

from apps.edge_agent.core import config

logger = logging.getLogger(__name__)


class AnalystAgent:
    def __init__(self):
        self.fire_model = YOLO(str(config.FIRE_MODEL_PATH))
        self.people_model = None
        if config.PERSON_MODEL_PATH is not None:
            try:
                self.people_model = YOLO(str(config.PERSON_MODEL_PATH))
            except Exception as exc:
                logger.warning("Configured people model unavailable; using OpenCV HOG fallback: %s", exc)
        self.people_hog = cv2.HOGDescriptor()
        self.people_hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())
        self.face_net = None
        try:
            self.face_net = cv2.dnn.readNet(str(config.FACE_MODEL), str(config.FACE_PROTO))
        except cv2.error as exc:
            logger.warning("Face-box fallback unavailable: %s", exc)
        try:
            x1, y1, x2, y2 = (float(value) for value in config.WORK_ZONE.split(","))
            self.work_zone = (max(0, x1), max(0, y1), min(1, x2), min(1, y2))
        except (TypeError, ValueError):
            self.work_zone = (0.05, 0.05, 0.95, 0.95)

    def analyze(self, frame):
        hazards = []
        for result in self.fire_model.predict(
            frame, conf=min(config.FIRE_CONFIDENCE, config.SMOKE_CONFIDENCE), imgsz=960, verbose=False
        ):
            for box in result.boxes:
                confidence = float(box.conf[0])
                class_id = int(box.cls[0])
                name = str(self.fire_model.names.get(class_id, class_id)).lower()
                threshold = config.SMOKE_CONFIDENCE if "smoke" in name else config.FIRE_CONFIDENCE
                if confidence < threshold:
                    continue
                label = "fire" if "fire" in name else "smoke"
                x1, y1, x2, y2 = (int(value) for value in box.xyxy[0])
                hazards.append({"type": label, "box": (x1, y1, x2, y2), "confidence": confidence})

        people = []
        if self.people_model is not None:
            for result in self.people_model.predict(frame, conf=config.PEOPLE_CONFIDENCE, classes=[0], imgsz=640, verbose=False):
                for box in result.boxes:
                    x1, y1, x2, y2 = (int(value) for value in box.xyxy[0])
                    people.append({
                        "box": (x1, y1, x2, y2),
                        "center": ((x1 + x2) // 2, (y1 + y2) // 2),
                        "confidence": float(box.conf[0]),
                    })
        else:
            height, width = frame.shape[:2]
            if self.face_net is not None:
                face_blob = cv2.dnn.blobFromImage(frame, 1.0, (300, 300), [104, 117, 123], swapRB=False, crop=False)
                self.face_net.setInput(face_blob)
                face_detections = self.face_net.forward()
                for index in range(face_detections.shape[2]):
                    confidence = float(face_detections[0, 0, index, 2])
                    # The webcam is often close to the subject and slightly noisy;
                    # a lower face-box threshold keeps the live people tally useful.
                    if confidence < 0.45:
                        continue
                    x1 = max(0, int(face_detections[0, 0, index, 3] * width))
                    y1 = max(0, int(face_detections[0, 0, index, 4] * height))
                    x2 = min(width - 1, int(face_detections[0, 0, index, 5] * width))
                    y2 = min(height - 1, int(face_detections[0, 0, index, 6] * height))
                    if x2 > x1 and y2 > y1:
                        people.append({"box": (x1, y1, x2, y2), "center": ((x1 + x2) // 2, (y1 + y2) // 2), "confidence": confidence})
            scale = min(1.0, 640 / width)
            inference_frame = cv2.resize(frame, None, fx=scale, fy=scale) if scale < 1 else frame
            boxes, _weights = self.people_hog.detectMultiScale(
                inference_frame, hitThreshold=0.0, winStride=(8, 8), padding=(8, 8), scale=1.05, groupThreshold=2
            )
            inverse_scale = 1 / scale
            for x, y, box_width, box_height in boxes:
                x1, y1 = int(x * inverse_scale), int(y * inverse_scale)
                x2, y2 = int((x + box_width) * inverse_scale), int((y + box_height) * inverse_scale)
                body_box = (x1, y1, x2, y2)
                if any(
                    x1 <= face["center"][0] <= x2 and y1 <= face["center"][1] <= y2
                    for face in people
                ):
                    continue
                people.append({"box": body_box, "center": ((x1 + x2) // 2, (y1 + y2) // 2), "confidence": None})

        height, width = frame.shape[:2]
        zx1, zy1, zx2, zy2 = self.work_zone
        zone = (int(zx1 * width), int(zy1 * height), int(zx2 * width), int(zy2 * height))
        zone_people = sum(1 for person in people if zx1 <= person["center"][0] / width <= zx2 and zy1 <= person["center"][1] / height <= zy2)
        return {
            "hazards": hazards,
            "hazard_detected": bool(hazards),
            "hazard_label": ", ".join(sorted({item["type"] for item in hazards})),
            "hazard_boxes": hazards,
            "people": people,
            "people_count": len(people),
            "work_zone_count": zone_people,
            "work_zone": zone,
            "analytics_available": True,
            "crowd_alert": len(people) >= config.CROWD_LIMIT,
        }

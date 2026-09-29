# agents/orchestrator.py
import time
import threading
import cv2
from apps.edge_agent.camera.preview import frame_hub
from apps.edge_agent.sync.analytics_client import AnalyticsClient
from apps.edge_agent.camera.source import WatcherAgent
from apps.edge_agent.detection.analyzer import AnalystAgent
from apps.edge_agent.notifications.responder import ResponderAgent
from apps.edge_agent.recording.reporter import ReporterAgent
from apps.edge_agent.sync.incident_client import IncidentClient
from apps.edge_agent.core import config

class Orchestrator:
    def __init__(self, camera_source=None, camera_id=None):
        self.watcher = WatcherAgent(config.CAMERA_SOURCE if camera_source is None else camera_source)
        self.analyst = AnalystAgent()
        self.responder = ResponderAgent()
        self.reporter = ReporterAgent()
        active_camera_id = config.CAMERA_ID if camera_id is None else camera_id
        self.incident_client = IncidentClient(config.API_BASE_URL, active_camera_id)
        self.analytics_client = AnalyticsClient(config.API_BASE_URL, active_camera_id)
        
        self.active_hazard_label = ""
        self.active_people_summary = ""
        self.reported_hazard_types: set[str] = set()
        self.last_analytics_time = 0.0
        self.was_crowd_alert = False
        self.preview_camera_id = active_camera_id or "local-source"

    def process_step(self):
        ret, frame = self.watcher.get_frame()
        if not ret:
            return None, None

        analysis = self.analyst.analyze(frame)
        preview = frame.copy()
        for hazard in analysis["hazards"]:
            x1, y1, x2, y2 = hazard["box"]
            color = (40, 105, 235) if hazard["type"] == "fire" else (35, 177, 240)
            cv2.rectangle(preview, (x1, y1), (x2, y2), color, 2)
            cv2.putText(preview, f"{hazard['type'].upper()} {hazard['confidence']:.0%}", (x1, max(20, y1 - 8)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
        for person in analysis["people"]:
            x1, y1, x2, y2 = person["box"]
            cv2.rectangle(preview, (x1, y1), (x2, y2), (110, 226, 141), 2)
        zx1, zy1, zx2, zy2 = analysis["work_zone"]
        cv2.rectangle(preview, (zx1, zy1), (zx2, zy2), (80, 195, 190), 1)
        cv2.putText(preview, f"PEOPLE {analysis['people_count']}   WORK ZONE {analysis['work_zone_count']}", (16, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (245, 247, 243), 2)
        frame_hub.publish(self.preview_camera_id, preview)

        people_summary = f"{analysis['people_count']} people in view; {analysis['work_zone_count']} in monitored work zone"

        current_time = time.time()
        
        # Persist each newly seen hazard class immediately; a later fire result
        # upgrades an earlier smoke event to a combined event instead of being
        # hidden by the old global cooldown.
        if analysis["hazard_detected"]:
            current_types = {item["type"] for item in analysis["hazards"]}
            new_types = current_types - self.reported_hazard_types
            if new_types and not config.DEMO_MODE:
                self.responder.play_siren()
            if new_types:
                all_types = self.reported_hazard_types | current_types
                detection_type = "both" if len(all_types) > 1 else next(iter(all_types))
                self.active_hazard_label = analysis["hazard_label"]
                self.active_people_summary = people_summary
                self.incident_client.create(
                    detection_type,
                    max((item["confidence"] for item in analysis["hazards"]), default=None),
                    f"{'DEMO MODE: ' if config.DEMO_MODE else ''}{people_summary}; model labels: {', '.join(sorted(current_types))}",
                )
                self.reported_hazard_types.update(current_types)
                if not self.reporter.is_recording:
                    self.reporter.start_recording()

        if analysis["analytics_available"]:
            crowd_alert = analysis["crowd_alert"]
            if current_time - self.last_analytics_time >= config.ANALYTICS_INTERVAL or crowd_alert != self.was_crowd_alert:
                strongest = max(
                    (person["confidence"] for person in analysis["people"] if person["confidence"] is not None),
                    default=None,
                )
                self.analytics_client.create(
                    "crowd_alert" if crowd_alert else "zone_presence",
                    analysis["people_count"],
                    {
                        "work_zone_count": analysis["work_zone_count"],
                        "crowd_limit": config.CROWD_LIMIT,
                        "crowd_alert": crowd_alert,
                    },
                    strongest,
                )
                self.last_analytics_time = current_time
                self.was_crowd_alert = crowd_alert

        # كتابة إطارات الفيديو (30 ثانية)
        if self.reporter.is_recording:
            finished = self.reporter.write_frame(frame)
            if finished:
                video_file = self.reporter.current_video_path
                saved_hazard = self.active_hazard_label if self.active_hazard_label else "حريق (Fire)"
                saved_people = self.active_people_summary if self.active_people_summary else people_summary

                # 1. الرفع السحابي
                cloud_url = "" if config.DEMO_MODE else self.reporter.upload_to_cloud(video_file)

                # 2. توثيق الحدث
                self.reporter.log_incident(saved_hazard, saved_people, cloud_url)

                # 3. إرسال التنبيهات (daemon=False لضمان اكتمال الإرسال حتى لو أغلقت الكاميرا)
                if not config.DEMO_MODE:
                    t = threading.Thread(
                        target=self._dispatch_alerts,
                        args=(video_file, saved_hazard, saved_people, cloud_url),
                        daemon=False,
                    )
                    t.start()

        if not analysis["hazard_detected"] and not self.reporter.is_recording:
            self.reported_hazard_types.clear()
            self.active_hazard_label = ""
            self.active_people_summary = ""

        return frame, analysis

    def _dispatch_alerts(self, video_file, hazard_label, people_summary, cloud_url=""):
        self.responder.send_whatsapp(hazard_label, people_summary, cloud_url)
        self.responder.send_email(video_file, hazard_label, people_summary, cloud_url)

    def close(self):
        self.watcher.release()

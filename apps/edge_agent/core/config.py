import os
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[3]
EDGE_ROOT = PROJECT_ROOT / "apps" / "edge_agent"
EDGE_MODELS_DIR = EDGE_ROOT / "models"

LOCATION_TAG = os.getenv("LOCATION_TAG", "FlameEye monitored site")

TARGET_EMAIL = os.getenv("TARGET_EMAIL", "")
SENDER_EMAIL = os.getenv("SENDER_EMAIL", "")
SENDER_PASSWORD = os.getenv("SENDER_PASSWORD", "")
TARGET_PHONE = os.getenv("TARGET_PHONE", "")
CALLMEBOT_API_KEY = os.getenv("CALLMEBOT_API_KEY", "")
CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME", "")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY", "")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET", "")

if CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET:
    os.environ["CLOUDINARY_URL"] = (
        f"cloudinary://{CLOUDINARY_API_KEY}:{CLOUDINARY_API_SECRET}@{CLOUDINARY_CLOUD_NAME}"
    )

CAMERA_SOURCE: int | str = os.getenv("CAMERA_SOURCE", "0")
if isinstance(CAMERA_SOURCE, str) and CAMERA_SOURCE.isdigit():
    CAMERA_SOURCE = int(CAMERA_SOURCE)

CAMERA_ID = os.getenv("CAMERA_ID", "")
API_BASE_URL = os.getenv("API_BASE_URL", "http://127.0.0.1:8000")
RECORD_DURATION = int(os.getenv("RECORD_DURATION", "30"))
ALERT_COOLDOWN = int(os.getenv("ALERT_COOLDOWN", "60"))
RUNTIME_DIR = PROJECT_ROOT / "storage"
OUTPUT_DIR = RUNTIME_DIR / "alerts"
LOG_FILE = RUNTIME_DIR / "fires.log"

FIRE_MODEL_PATH = EDGE_MODELS_DIR / "fire.pt"
PERSON_MODEL_PATH = Path(os.getenv("PERSON_MODEL_PATH", "")) if os.getenv("PERSON_MODEL_PATH") else None
ALARM_SOUND_PATH = EDGE_ROOT / "assets" / "alarm_new.mp3"
FACE_PROTO = EDGE_MODELS_DIR / "opencv_face_detector.pbtxt"
FACE_MODEL = EDGE_MODELS_DIR / "opencv_face_detector_uint8.pb"

PEOPLE_CONFIDENCE = float(os.getenv("PEOPLE_CONFIDENCE", "0.45"))
FIRE_CONFIDENCE = float(os.getenv("FIRE_CONFIDENCE", "0.3"))
SMOKE_CONFIDENCE = float(os.getenv("SMOKE_CONFIDENCE", "0.5"))
CROWD_LIMIT = int(os.getenv("CROWD_LIMIT", "20"))
WORK_ZONE = os.getenv("WORK_ZONE", "0.05,0.05,0.95,0.95")
ANALYTICS_INTERVAL = float(os.getenv("ANALYTICS_INTERVAL", "5"))
CAMERA_PREVIEW_PORT = int(os.getenv("CAMERA_PREVIEW_PORT", "8765"))
DEMO_MODE = os.getenv("DEMO_MODE", "false").strip().lower() in {"1", "true", "yes", "on"}


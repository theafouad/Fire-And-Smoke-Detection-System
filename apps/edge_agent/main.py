"""Run one local worker for every configured camera stream."""

import json
import logging
import threading
import time
from urllib.error import URLError
from urllib.request import urlopen

from apps.edge_agent.core import config
from apps.edge_agent.orchestrator import Orchestrator
from apps.edge_agent.camera.preview import PreviewServer

logger = logging.getLogger(__name__)
stop_event = threading.Event()


def _registered_cameras() -> list[dict]:
    if config.CAMERA_ID:
        return [{"id": config.CAMERA_ID, "stream_url": str(config.CAMERA_SOURCE)}]
    try:
        with urlopen(f"{config.API_BASE_URL.rstrip('/')}/api/cameras?limit=200", timeout=5) as response:
            cameras = json.loads(response.read().decode("utf-8"))
        return [
            camera for camera in cameras
            if camera.get("is_active") and camera.get("id") and camera.get("stream_url")
            and not str(camera["stream_url"]).startswith("demo://")
        ]
    except (OSError, URLError, ValueError) as exc:
        logger.info("Camera list unavailable; using CAMERA_SOURCE fallback: %s", exc)
        return []


def _run_camera(camera: dict) -> None:
    camera_id = camera.get("id") or None
    source = camera.get("stream_url") or config.CAMERA_SOURCE
    logger.info("Starting edge worker for camera %s", camera_id or "local source")
    system = Orchestrator(source, camera_id)
    try:
        while not stop_event.is_set():
            frame, _analysis = system.process_step()
            if frame is None:
                stop_event.wait(0.2)
    except Exception:
        logger.exception("Edge worker stopped for camera %s", camera_id or "local source")
    finally:
        system.close()


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    try:
        preview_server = PreviewServer(port=config.CAMERA_PREVIEW_PORT)
        preview_server.start()
    except OSError as exc:
        preview_server = None
        logger.warning("Camera preview server could not start: %s", exc)
    workers: dict[str, threading.Thread] = {}
    try:
        while not stop_event.is_set():
            cameras = _registered_cameras()
            if not cameras and not config.CAMERA_ID:
                cameras = [{"id": "", "stream_url": config.CAMERA_SOURCE}]
            for camera in cameras:
                key = camera.get("id") or "local-source"
                thread = workers.get(key)
                if thread is None or not thread.is_alive():
                    thread = threading.Thread(target=_run_camera, args=(camera,), name=f"edge-{key[:8]}", daemon=True)
                    workers[key] = thread
                    thread.start()
            stop_event.wait(10)
    except KeyboardInterrupt:
        pass
    finally:
        stop_event.set()
        for worker in workers.values():
            worker.join(timeout=3)
        if preview_server is not None:
            preview_server.close()


if __name__ == "__main__":
    main()

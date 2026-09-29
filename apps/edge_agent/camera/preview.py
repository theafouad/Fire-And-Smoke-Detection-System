"""Local MJPEG preview for frames already captured by the edge workers."""

import logging
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlparse

import cv2

logger = logging.getLogger(__name__)


class FrameHub:
    def __init__(self):
        self._condition = threading.Condition()
        self._frames: dict[str, tuple[int, bytes, float]] = {}

    def publish(self, camera_id: str, frame) -> None:
        ok, encoded = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 78])
        if not ok:
            return
        with self._condition:
            old_sequence = self._frames.get(camera_id, (0, b"", 0))[0]
            self._frames[camera_id] = (old_sequence + 1, encoded.tobytes(), time.time())
            self._condition.notify_all()

    def wait_for_frame(self, camera_id: str, after: int, timeout: float = 2.0):
        with self._condition:
            self._condition.wait_for(
                lambda: camera_id in self._frames and self._frames[camera_id][0] > after,
                timeout=timeout,
            )
            return self._frames.get(camera_id)


frame_hub = FrameHub()


class _PreviewHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(b'{"status":"ok"}')
            return
        prefix, suffix = "/cameras/", "/stream"
        if not parsed.path.startswith(prefix) or not parsed.path.endswith(suffix):
            self.send_error(404)
            return
        camera_id = unquote(parsed.path[len(prefix):-len(suffix)]).strip("/")
        if not camera_id:
            self.send_error(400)
            return
        first_frame = frame_hub.wait_for_frame(camera_id, -1, timeout=3)
        if first_frame is None:
            self.send_error(503, "No processed camera frame is available")
            return
        self.send_response(200)
        self.send_header("Content-Type", "multipart/x-mixed-replace; boundary=frame")
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        sequence, jpeg, _timestamp = first_frame
        try:
            self.wfile.write(b"--frame\r\nContent-Type: image/jpeg\r\nContent-Length: " + str(len(jpeg)).encode() + b"\r\n\r\n" + jpeg + b"\r\n")
            self.wfile.flush()
            while True:
                current = frame_hub.wait_for_frame(camera_id, sequence)
                if current is None:
                    continue
                sequence, jpeg, _timestamp = current
                self.wfile.write(b"--frame\r\nContent-Type: image/jpeg\r\nContent-Length: " + str(len(jpeg)).encode() + b"\r\n\r\n" + jpeg + b"\r\n")
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, OSError):
            return

    def log_message(self, _format, *_args):
        return


class PreviewServer:
    def __init__(self, host: str = "127.0.0.1", port: int = 8765):
        self.server = ThreadingHTTPServer((host, port), _PreviewHandler)
        self.server.daemon_threads = True
        self.thread = threading.Thread(target=self.server.serve_forever, name="camera-preview", daemon=True)

    def start(self) -> None:
        self.thread.start()
        logger.info("Camera preview available at http://%s:%s", *self.server.server_address)

    def close(self) -> None:
        self.server.shutdown()
        self.server.server_close()

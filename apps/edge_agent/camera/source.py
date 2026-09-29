# agents/watcher.py
import cv2

class WatcherAgent:
    def __init__(self, source=0):
        self.source = source
        self.cap = None
        self.connect()

    def connect(self):
        """Open local cameras with Windows backend fallbacks; reconnect on failure."""
        if self.cap is not None:
            self.cap.release()
        source_text = str(self.source)
        if source_text.startswith("local://"):
            source_text = source_text.removeprefix("local://")
        elif source_text.startswith("file://"):
            source_text = source_text.removeprefix("file://")
        if isinstance(self.source, int) or source_text.isdigit():
            camera_index = int(source_text)
            self.cap = None
            for backend in (cv2.CAP_MSMF, cv2.CAP_DSHOW, cv2.CAP_ANY):
                try:
                    candidate = cv2.VideoCapture(camera_index, backend)
                    if candidate.isOpened():
                        self.cap = candidate
                        break
                    candidate.release()
                except cv2.error:
                    continue
            if self.cap is None:
                self.cap = cv2.VideoCapture(camera_index)
        else:
            # RTSP/HTTP streams are opened without the DirectShow backend.
            self.cap = cv2.VideoCapture(str(self.source))
        if self.cap.isOpened():
            self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
            self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
            return True
        return False

    def get_frame(self):
        """جلب الإطار التالي مع ميزة Auto-Reconnect."""
        if not self.cap or not self.cap.isOpened():
            if not self.connect():
                return False, None
        
        ret, frame = self.cap.read()
        if not ret:
            self.connect()
            ret, frame = self.cap.read()
        return ret, frame

    def release(self):
        if self.cap:
            self.cap.release()

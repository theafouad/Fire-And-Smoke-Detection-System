# FlameEye

FlameEye is an edge-first fire and smoke detection platform:

- `apps/web/` - Next.js marketing site and operations pages.
- `apps/api/` - FastAPI modular backend and SQLAlchemy database models.
- `apps/edge_agent/` - Python camera, inference, recording, notification, and API-sync monitoring runtime.
- `apps/edge_agent/models/` - Versioned inference model assets.
- `apps/edge_agent/assets/` - Edge runtime assets such as the alarm sound.
- `apps/desktop/` - Electron desktop shell for Windows and macOS.
- `storage/` - Local runtime recordings and logs. This directory is generated and ignored by Git.

## Run the backend

```powershell
cd apps\api
pip install -r requirements.txt
cd ..\..
python -m uvicorn apps.api.main:app --reload --port 8000
```

The FastAPI deployment only needs [apps/api/requirements.txt](apps/api/requirements.txt).

## Run all local apps

From the repository root, use the Windows launcher to start the API, Next.js
frontend, edge agent, and Electron desktop shell:

```powershell
.\scripts\run-all.ps1 -OpenBrowser
```

If the default ports are occupied, choose free ports and run in local demo mode:

```powershell
.\scripts\run-all.ps1 -ApiPort 8001 -WebPort 3001 -DemoMode -OpenBrowser
```

You can also double-click `scripts\run-all.cmd` or run it from Command Prompt.

For a lighter web/API test without loading the AI model or opening Electron:

```powershell
.\scripts\run-all.ps1 -SkipEdge -SkipDesktop -OpenBrowser
```

For a laptop webcam demo, use **Connect source → Local camera**, enter camera
index `0` (try `1` if another app owns it), and connect. The edge agent opens
the camera and the platform shows its annotated live feed, fire/smoke detections,
and people/work-zone counts. On Windows, the edge agent tries Media Foundation,
DirectShow, and the default OpenCV backend. Allow camera access in Windows if
prompted.

To run the laptop camera while the dashboard/API are already on ports 3001/8001:

```powershell
$env:CAMERA_ID = "YOUR_CAMERA_ID"
$env:CAMERA_SOURCE = "local://0"
$env:API_BASE_URL = "http://127.0.0.1:8001"
$env:DEMO_MODE = "true"
python -m apps.edge_agent.main
```

The annotated local stream is served at `http://127.0.0.1:8765`. `DEMO_MODE`
suppresses sirens, cloud uploads, and outbound alerts. For video testing, set
the edge source and camera record ID:

```powershell
.\scripts\run-all.ps1 -EdgeCameraSource "file://C:\path\to\video.mp4" -EdgeCameraId "YOUR_CAMERA_ID"
```

Use `local://0` for the first USB camera, or an RTSP URL for a network camera.

If Python is not available as `python`, select the interpreter explicitly:

```powershell
$env:FLAMEEYE_PYTHON = "C:\Path\To\python.exe"
.\scripts\run-all.ps1
```

The Electron app is the desktop monitoring tool. The website is the public
FlameEye site and also contains the dashboard at `/platform`, incident queue at
`/incidents`, and workspace settings at `/workspace`.

## Run the frontend

```powershell
cd apps\web
npm install
npm run dev
```

The frontend runs at `http://127.0.0.1:3000` and the API runs at
`http://127.0.0.1:8000`.

The Electron operations workspace can onboard a local USB camera with
`local://0`, a local video file with `file://C:\path\to\video.mp4`, or an existing
DVR/NVR/VMS source with an RTSP, RTSPS, HTTP, or HTTPS stream URL. The edge agent opens the source locally and sends detection
events to FastAPI.

People analytics are available at `/analytics`. The edge agent reports
per-camera people counts, crowd-threshold events, and aggregate occupancy in a
configured work zone. Set `CAMERA_ID` to a camera record ID for event sync;
configure `CROWD_LIMIT`, `WORK_ZONE` (`x1,y1,x2,y2` normalized frame bounds),
and `ANALYTICS_INTERVAL` in the edge environment. The default detector uses
OpenCV HOG full-person detection. `PERSON_MODEL_PATH` can point to a separately
licensed Ultralytics-compatible person model. Fixed-camera counts need
site-specific calibration before operational use. The monitoring reports
aggregate counts and does not identify employees.

Add sites from `/workspace` → **Sites and cameras**. To analyze a prerecorded
clip, open `/platform` → **Connect source** → **Analyze a video**, select the
site and an MP4, MOV, AVI, MKV, WEBM, or M4V file (up to 200 MB / 15 minutes).
The local API samples the video twice per second and opens a review page with
the original player, time-aligned fire/smoke/person boxes, summary counts, and a
clickable detection timeline. Uploaded video analysis is review-only and does
not send emergency notifications. Storage is local under `storage/video-analyses`.

Fire and smoke detection use `apps/edge_agent/models/fire.pt`. Confidence
thresholds are configurable with `FIRE_CONFIDENCE` (default `0.30`) and
`SMOKE_CONFIDENCE` (default `0.50`). Model labels and thresholds should be
validated against representative site footage before operational deployment;
the included prototype can confuse a small flame with smoke.

The current installer is an Electron shell and still requires the web app,
Python, and API/edge dependencies on the target machine; it is not a
self-contained deployment package.

### Detection and alert testing

1. Open `/platform`, connect a `demo://` source, and click **Create sample event**. This creates a reviewable smoke incident without contacting anyone.
2. Open `/workspace` → **Owners and guards**, add recipients, and use **Test email** or **Test WhatsApp**.
3. Configure `SMTP_HOST`, `SMTP_USERNAME`, `SMTP_PASSWORD`, and `SENDER_EMAIL` for email. Configure `WHATSAPP_ACCESS_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` for the Meta WhatsApp Cloud API.
4. For a real camera, source reachability is tested in the API; live frame inference and recorded evidence are performed by the edge agent.

## Run the edge monitoring runtime

The edge agent is separate from the FastAPI deployment:

```powershell
cd apps\edge_agent
pip install -r requirements.txt
cd ..\..
python -m apps.edge_agent.main
```

The edge runtime is normally started by the launcher or Electron. It opens the
configured camera/video source, runs local inference, records evidence, and
sends incidents to the API. The Next.js deployment only needs the [apps/web/package.json](apps/web/package.json)
and [apps/web/package-lock.json](apps/web/package-lock.json) files. Configure
Vercel's project root as `apps/web`.

## Run the desktop app

The Electron shell opens the operations platform and can manage the local API
and edge agent:

```powershell
cd apps\desktop
npm install
npm run dev
```

Build Windows or macOS installers with `npm run dist:win` or `npm run dist:mac`.
The installer currently requires Python and the API/edge dependencies on the
target machine; package those services as native binaries before public
distribution.

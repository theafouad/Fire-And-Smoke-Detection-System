# FlameEye Desktop

This Electron app is the cross-platform desktop shell for FlameEye. It runs
on Windows and macOS and keeps the web UI, FastAPI service, and edge agent as
separate components.

## Development

Install the desktop dependencies:

```powershell
cd apps\desktop
npm install
```

Start the Next.js app and FastAPI separately, then launch Electron:

```powershell
npm run dev
```

By default Electron opens `http://127.0.0.1:3000/platform`, starts the local
FastAPI process on port `8000`, and starts the edge agent. To use an already
running API or hosted web app:

```powershell
$env:FLAMEEYE_MANAGED_RUNTIME="false"
$env:FLAMEEYE_WEB_URL="https://app.example.com/platform"
npm run dev
```

The operations workspace includes a camera wall and source onboarding flow.
Connect a local USB camera with an index such as `0`, or connect an existing
DVR, NVR, VMS, or camera stream with an RTSP, RTSPS, HTTP, or HTTPS URL. Network
streams are processed by the local edge agent; RTSP feeds are not expected to
play directly inside the browser surface.

Use the **People** rail item or open `/analytics` for current people counts,
work-zone occupancy, crowd events, and recent event history. Counts are
aggregate and do not identify individual employees. The edge agent needs a
camera record ID (`CAMERA_ID`) to sync analytics.

If Windows or macOS selects the wrong Python installation, set the executable
explicitly:

```powershell
$env:FLAMEEYE_PYTHON="C:\Path\To\python.exe"
```

For a Vercel deployment, set `FLAMEEYE_WEB_URL` to the deployed web URL and
leave `FLAMEEYE_MANAGED_RUNTIME` enabled if the desktop machine should run the
local FastAPI service and edge agent. The deployed frontend must be configured
with an API URL reachable from the desktop machine.

## Build installers

```powershell
npm run dist:win
npm run dist:mac
```

The current desktop shell expects Python and the API/edge-agent dependencies
to be installed on the machine. Before distributing a public installer, bundle
the API and edge agent as platform-specific binaries (PyInstaller or an
equivalent packager) and update `src/main.js` to launch those binaries from
Electron's resources directory.

Build the Windows installer on Windows:

```powershell
npm run dist:win
```

Build the macOS DMG on macOS:

```bash
npm run dist:mac
```

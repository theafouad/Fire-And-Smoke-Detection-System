"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Camera, createCamera, getCameras, getDashboardSummary, getIncidents, getSites, Incident, seedDemoWorkspace, Site, testCamera, testDetection, uploadVideo } from "@/lib/api";

type SourceMode = "local" | "system" | "upload";

function sourceLabel(camera: Camera) {
  if (camera.stream_url?.startsWith("local://")) return `USB camera ${camera.stream_url.replace("local://", "")}`;
  if (camera.stream_url?.startsWith("file://")) return "Video file";
  if (camera.stream_url?.startsWith("rtsp")) return "RTSP stream";
  return "Network stream";
}

function cameraColor(index: number) {
  return ["#315d57", "#8b674b", "#425f78", "#6f6142", "#4c6654", "#665769"][index % 6];
}

function CameraPreview({ camera }: { camera: Camera }) {
  const isDemo = camera.stream_url?.startsWith("demo://") ?? false;
  const [previewError, setPreviewError] = useState(false);
  const previewUrl = `http://127.0.0.1:8765/cameras/${encodeURIComponent(camera.id)}/stream`;
  return (
    <>
      {isDemo ? <div className="demo-feed-mark"><span>FLAMEEYE DEMO</span><b>Sample camera feed</b><small>Illustrative footage · not a live camera</small></div> : <img className="camera-feed" src={previewUrl} alt={`${camera.name} live camera preview`} onError={() => setPreviewError(true)} onLoad={() => setPreviewError(false)} />}
      {!isDemo && previewError && <div className="feed-waiting">Waiting for edge camera feed<span>Start the edge agent and check the camera connection.</span></div>}
      <div className="scene-lines" />
    </>
  );
}

export default function PlatformPage() {
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof getDashboardSummary>>>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [showConnect, setShowConnect] = useState(false);
  const [mode, setMode] = useState<SourceMode>("local");
  const [selectedSite, setSelectedSite] = useState("");
  const [name, setName] = useState("");
  const [source, setSource] = useState("0");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [roomTime, setRoomTime] = useState("--:--");

  async function refresh() {
    const [nextSummary, nextIncidents, nextSites, nextCameras] = await Promise.all([
      getDashboardSummary(), getIncidents(), getSites(), getCameras()
    ]);
    setSummary(nextSummary);
    setIncidents(nextIncidents);
    setSites(nextSites);
    setCameras(nextCameras);
    if (!selectedSite && nextSites[0]) setSelectedSite(nextSites[0].id);
  }

  useEffect(() => {
    void refresh();
    if (new URLSearchParams(window.location.search).get("upload") === "1") {
      setMode("upload");
      setShowConnect(true);
    }
    if (window.localStorage.getItem("flameeye-first-run-seen") !== "true") setShowWelcome(true);
    setRoomTime(new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit" }).format(new Date()));
    const timer = window.setInterval(() => {
      setRoomTime(new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit" }).format(new Date()));
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const openIncidents = incidents.filter((incident) => incident.status !== "resolved");
  const currentSite = sites.find((site) => site.id === selectedSite);
  const siteCameras = useMemo(
    () => cameras.filter((camera) => !selectedSite || camera.site_id === selectedSite),
    [cameras, selectedSite]
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!selectedSite) {
      setMessage("Choose a site first.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      if (mode === "upload") {
        const fileInput = form.elements.namedItem("video_file") as HTMLInputElement | null;
        const file = fileInput?.files?.[0];
        if (!file) throw new Error("Choose a video file to analyze.");
        const analysis = await uploadVideo(selectedSite, file);
        window.location.assign(`/videos/${analysis.id}`);
        return;
      }
      if (!name.trim() || !source.trim()) {
        throw new Error("Complete the camera details before connecting.");
      }
      const created = await createCamera({
        site_id: selectedSite,
        name: name.trim(),
        stream_url: mode === "local" ? `local://${source.trim()}` : source.trim()
      });
      setMessage("Camera connected. Testing the source...");
      const result = await testCamera(created.id);
      setMessage(result.detail);
      await refresh();
      setName("");
      setSource(mode === "local" ? "0" : "");
      setShowConnect(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to connect this camera.");
    } finally {
      setSaving(false);
    }
  }

  async function runTest(camera: Camera) {
    setMessage(`Testing ${camera.name}...`);
    try {
      const result = await testCamera(camera.id);
      setMessage(result.detail);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Camera test failed.");
    }

  }

  async function runDetectionTest(camera: Camera) {
    setMessage(`Running a smoke detection test on ${camera.name}...`);
    try {
      const result = await testDetection(camera.id);
      setMessage(result.detail);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Detection test failed.");
    }
  }

  function dismissWelcome() {
    window.localStorage.setItem("flameeye-first-run-seen", "true");
    setShowWelcome(false);
  }

  function startCameraOnboarding() {
    dismissWelcome();
    setShowConnect(true);
  }

  async function startDemo() {
    setSeeding(true);
    try {
      await seedDemoWorkspace();
      dismissWelcome();
      await refresh();
      setMessage("Demo workspace ready. Explore the camera wall and incident queue.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to prepare the demo workspace.");
    } finally {
      setSeeding(false);
    }
  }

  return (
    <main className="control-room">
      <aside className="control-rail">
        <a className="rail-brand" href="/"><span>✦</span><b>FE</b></a>
        <nav className="rail-nav" aria-label="Operations navigation">
          <a className="rail-link active" href="/platform"><span>▦</span><small>Live</small></a>
          <a className="rail-link" href="/analytics"><span>◌</span><small>People</small></a>
          <a className="rail-link" href="/incidents"><span>◉</span><small>Events</small></a>
          <a className="rail-link" href="#cameras"><span>▣</span><small>Views</small></a>
          <a className="rail-link" href="#sites"><span>⌘</span><small>Sites</small></a>
        </nav>
        <div className="rail-bottom"><a className="rail-link" href="/"><span>↩</span><small>Exit</small></a></div>
      </aside>

      <section className="room-content">
        <header className="room-header">
          <div className="room-title"><span className="live-pulse" /> <div><b>LIVE OPERATIONS</b><small>{currentSite?.name || "All connected sites"}</small></div></div>
          <div className="room-actions">
            <span className="room-clock">{roomTime}</span>
            <a className="room-workspace-link" href="/workspace">Workspace</a>
            <button className="room-icon" type="button" aria-label="Refresh cameras" onClick={() => void refresh()}>↻</button>
            <button className="connect-button" type="button" onClick={() => setShowConnect(true)}>＋ Connect source</button>
          </div>
        </header>

        <div className="room-toolbar">
          <div><h1>Camera wall</h1><p>{siteCameras.length} connected views · {summary?.cameras_online ?? 0} online</p></div>
          <div className="toolbar-controls">
            <select value={selectedSite} onChange={(event) => setSelectedSite(event.target.value)} aria-label="Filter by site">
              <option value="">All sites</option>
              {sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
            </select>
            <a className="view-incidents" href="/incidents">Incident queue <b>{openIncidents.length}</b></a>
          </div>
        </div>

        <section className="people-strip" aria-label="People analytics overview">
          <div><span>PEOPLE IN VIEW</span><b>{summary?.people_now ?? "—"}</b><small>Latest count from reporting cameras</small></div>
          <div><span>CROWD ALERTS TODAY</span><b>{summary?.crowd_alerts_today ?? "—"}</b><small>Configured occupancy thresholds</small></div>
          <a href="/analytics">Open people analytics <b>↗</b></a>
        </section>

        <section className="camera-wall" id="cameras">
          {siteCameras.length === 0 ? (
            <div className="wall-empty"><span>▦</span><h2>Connect your first camera</h2><p>Use a local USB camera or bring an existing DVR, NVR, VMS, or RTSP stream.</p><div className="wall-empty-actions"><button className="connect-button" type="button" onClick={() => setShowConnect(true)}>Connect a source</button><button className="ghost-room-button" type="button" onClick={() => void startDemo()}>Load demo workspace</button></div></div>
          ) : siteCameras.map((camera, index) => (
            <article className="camera-tile" key={camera.id}>
              <div className="camera-scene" style={{ background: `linear-gradient(135deg, ${cameraColor(index)}, #121b24)` }}>
                <CameraPreview camera={camera} />
                <span className="tile-label">{camera.name}</span>
                <span className={`tile-status ${camera.status === "online" ? "online" : ""}`}><i />{camera.status === "online" ? "LIVE" : "OFFLINE"}</span>
                {camera.status !== "online" && <button className="tile-test" type="button" onClick={() => void runTest(camera)}>Test source</button>}
                {camera.status === "online" && camera.stream_url?.startsWith("demo://") && <button className="tile-test detection-test" type="button" onClick={() => void runDetectionTest(camera)}>Create sample event</button>}
                {camera.status === "online" && !camera.stream_url?.startsWith("demo://") && <span className="tile-test detection-test">Live analysis active</span>}
                <span className="tile-source">{sourceLabel(camera)}</span>
              </div>
              <footer><a href={`/platform/cameras/${camera.id}`}><b>{camera.name}</b><small>{camera.status === "online" ? "Monitoring active" : "Needs connection test"}</small></a><button type="button" onClick={() => void runTest(camera)} aria-label={`Test ${camera.name}`}>⋯</button></footer>
            </article>
          ))}
        </section>

        <section className="room-lower">
          <div className="room-panel event-panel">
            <header><div><span className="panel-eyebrow">EVENTS</span><h2>Recent detections</h2></div><a href="/incidents">View all ↗</a></header>
            {openIncidents.slice(0, 4).map((incident) => <a className="event-row" href="/incidents" key={incident.id}><span className={`event-signal ${incident.detection_type}`} /><div><b>{incident.detection_type} detected</b><small>Camera {incident.camera_id.slice(0, 8)} · {new Date(incident.detected_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small></div><strong>{incident.confidence == null ? "—" : `${Math.round(incident.confidence * 100)}%`}</strong></a>)}
            {openIncidents.length === 0 && <div className="panel-empty">No active fire or smoke events.</div>}
          </div>
          <div className="room-panel site-panel" id="sites">
            <header><div><span className="panel-eyebrow">SYSTEM HEALTH</span><h2>Connected systems</h2></div><button type="button" onClick={() => setShowConnect(true)}>Manage ↗</button></header>
            <div className="system-list"><div><span className="system-icon">◉</span><p><b>FlameEye edge</b><small>{summary?.cameras_online ?? 0} cameras reporting</small></p><em>READY</em></div><div><span className="system-icon">⌁</span><p><b>{sites.length} protected sites</b><small>Existing infrastructure supported</small></p><em>SYNCED</em></div></div>
          </div>
        </section>
        {message && <p className="room-message" role="status">{message}</p>}
      </section>

      {showConnect && <div className="connect-overlay" role="dialog" aria-modal="true" aria-labelledby="connect-title">
        <form className="connect-sheet" onSubmit={submit}>
          <button className="sheet-close" type="button" onClick={() => setShowConnect(false)} aria-label="Close">×</button>
          <span className="panel-eyebrow">SOURCE ONBOARDING</span><h2 id="connect-title">Connect a camera or system</h2><p>Keep your existing hardware. FlameEye processes the video locally and sends only actionable events to the platform.</p>
          <div className="source-tabs"><button className={mode === "local" ? "selected" : ""} type="button" onClick={() => { setMode("local"); setSource("0"); }}>Local camera</button><button className={mode === "system" ? "selected" : ""} type="button" onClick={() => { setMode("system"); setSource(""); }}>Network stream</button><button className={mode === "upload" ? "selected" : ""} type="button" onClick={() => { setMode("upload"); setSource(""); }}>Analyze a video</button></div>
          <label>Site<select value={selectedSite} onChange={(event) => setSelectedSite(event.target.value)} required><option value="">Choose a site</option>{sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label>
          {mode !== "upload" ? <><label>Camera name<input value={name} onChange={(event) => setName(event.target.value)} placeholder={mode === "local" ? "Front desk camera" : "Warehouse loading bay"} required /></label><label>{mode === "local" ? "Camera index" : "Stream URL"}<input value={source} onChange={(event) => setSource(event.target.value)} placeholder={mode === "local" ? "0" : "rtsp://user:password@192.168.1.20:554/stream"} required /></label><small className="form-help">{mode === "local" ? "The built in laptop camera is usually index 0. If it is busy, try 1. The edge agent analyzes the feed and returns an annotated preview." : "Supports RTSP, RTSPS, HTTP, and HTTPS network streams."}</small></> : <><label>Video file<input type="file" name="video_file" accept="video/mp4,video/quicktime,video/x-msvideo,video/x-matroska,video/webm,.m4v" required /></label><small className="form-help">Upload an MP4, MOV, AVI, MKV, WEBM, or M4V up to 200 MB and 15 minutes. We’ll scan it for fire, smoke, and people, then show the source video with detection overlays. Video analysis creates review results only; it does not send alerts.</small></>}
          {message && <p className="form-error">{message}</p>}
          <button className="connect-submit" type="submit" disabled={saving}>{saving ? (mode === "upload" ? "Uploading…" : "Connecting…") : mode === "upload" ? "Upload and analyze ↗" : "Connect and test source ↗"}</button>
        </form>
      </div>}
      {showWelcome && <div className="welcome-overlay" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
        <div className="welcome-card">
          <div className="welcome-visual"><span className="welcome-orbit orbit-one" /><span className="welcome-orbit orbit-two" /><b>FE</b><small>FLAMEEYE</small></div>
          <div className="welcome-copy"><span className="panel-eyebrow">FIRST RUN · 2 MINUTES</span><h2 id="welcome-title">Prove your first camera.</h2><p>Connect a USB, RTSP, or demo source, verify the stream, then run a safe smoke test that creates a reviewable incident.</p><div className="welcome-steps"><div><b>01</b><span>Connect a video source</span></div><div><b>02</b><span>Verify the live stream</span></div><div><b>03</b><span>Run a detection test</span></div></div><div className="welcome-actions"><button className="connect-submit" type="button" onClick={startCameraOnboarding}>Connect my first camera ↗</button><button className="welcome-skip" type="button" onClick={() => void startDemo()} disabled={seeding}>{seeding ? "Preparing demo…" : "Explore a demo workspace instead"}</button></div><small className="welcome-note">The detection test is safe: it creates a review event and does not notify your contacts.</small></div>
        </div>
      </div>}
    </main>
  );
}

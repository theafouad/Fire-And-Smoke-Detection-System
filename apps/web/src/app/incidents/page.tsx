"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Camera, getCameras, getIncidents, Incident, updateIncident } from "@/lib/api";

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const [nextIncidents, nextCameras] = await Promise.all([getIncidents(), getCameras()]);
      if (!active) return;
      setIncidents(nextIncidents);
      setCameras(nextCameras);
      setLoading(false);
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 10_000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  const cameraNames = useMemo(() => new Map(cameras.map((camera) => [camera.id, camera.name])), [cameras]);
  const filtered = useMemo(() => incidents.filter((incident) => {
    const name = cameraNames.get(incident.camera_id) ?? incident.camera_id;
    return (typeFilter === "all" || incident.detection_type === typeFilter)
      && (statusFilter === "all" || incident.status === statusFilter)
      && (!search.trim() || `${name} ${incident.notes ?? ""} ${incident.camera_id}`.toLowerCase().includes(search.trim().toLowerCase()));
  }), [incidents, typeFilter, statusFilter, search, cameraNames]);
  const openCount = incidents.filter((event) => event.status === "open").length;
  const fireCount = incidents.filter((event) => event.detection_type === "fire" || event.detection_type === "both").length;
  const smokeCount = incidents.filter((event) => event.detection_type === "smoke" || event.detection_type === "both").length;

  async function changeStatus(incident: Incident, status: Incident["status"]) {
    setSavingId(incident.id);
    setMessage("");
    try {
      const updated = await updateIncident(incident.id, status);
      setIncidents((current) => current.map((item) => item.id === updated.id ? updated : item));
      setMessage(`Event marked ${status}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update event status.");
    } finally {
      setSavingId("");
    }
  }

  return <main className="control-room">
    <aside className="control-rail"><Link className="rail-brand" href="/platform"><span>✦</span><b>FE</b></Link><nav className="rail-nav" aria-label="Operations navigation"><Link className="rail-link" href="/platform"><span>▦</span><small>Live</small></Link><Link className="rail-link" href="/analytics"><span>◌</span><small>People</small></Link><Link className="rail-link active" href="/incidents"><span>◉</span><small>Events</small></Link><Link className="rail-link" href="/workspace#sites"><span>⌘</span><small>Sites</small></Link></nav><div className="rail-bottom"><Link className="rail-link" href="/workspace"><span>⚙</span><small>Settings</small></Link></div></aside>
    <section className="room-content events-content">
      <header className="room-header"><div className="room-title"><span className="live-pulse" /><div><b>EVENT REVIEW</b><small>Detection history and response</small></div></div><div className="room-actions"><Link className="room-workspace-link" href="/platform">Camera wall</Link><Link className="room-workspace-link" href="/workspace">Workspace</Link></div></header>
      <div className="room-toolbar events-toolbar"><div><h1>Events</h1><p>Review detections, check the source camera, and track response status.</p></div><Link className="connect-button event-video-cta" href="/platform?upload=1">＋ Analyze a video</Link></div>
      <section className="event-summary" aria-label="Event summary"><div><span>OPEN EVENTS</span><b>{openCount}</b><small>Need operator review</small></div><div><span>FIRE EVENTS</span><b>{fireCount}</b><small>Includes combined events</small></div><div><span>SMOKE EVENTS</span><b>{smokeCount}</b><small>Includes combined events</small></div><div><span>ALL EVENTS</span><b>{incidents.length}</b><small>Newest first</small></div></section>
      <section className="events-panel">
        <div className="events-toolbar-row"><div className="events-filter-title"><h2>Detection log</h2><span>{filtered.length} of {incidents.length}</span></div><div className="events-filters"><label className="event-search"><span>⌕</span><input aria-label="Search events" placeholder="Search camera or notes" value={search} onChange={(event) => setSearch(event.target.value)} /></label><label className="sr-only" htmlFor="event-type-filter">Detection type</label><select id="event-type-filter" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="all">All detections</option><option value="fire">Fire</option><option value="smoke">Smoke</option><option value="both">Fire + smoke</option></select><label className="sr-only" htmlFor="event-status-filter">Event status</label><select id="event-status-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="open">Open</option><option value="acknowledged">Acknowledged</option><option value="resolved">Resolved</option></select></div></div>
        {message && <p className="events-status-message" role="status">{message}</p>}
        {loading ? <div className="events-loading"><span /><span /><span /><span /></div> : filtered.length === 0 ? <div className="events-empty"><span>✓</span><h3>{incidents.length ? "No events match these filters" : "No events recorded"}</h3><p>{incidents.length ? "Change the search or filters to see more detections." : "Detections from connected cameras will appear here. Upload a recorded video to review it safely."}</p>{incidents.length === 0 && <Link href="/platform" className="connect-button">Open camera wall ↗</Link>}</div> : <div className="events-table-wrap"><table className="events-table"><thead><tr><th>Detection</th><th>Camera / source</th><th>Confidence</th><th>Detected</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{filtered.map((incident) => <tr key={incident.id}><td><Link href={`/incidents/${incident.id}`} className="event-detection-link"><span className={`event-type-dot ${incident.detection_type}`} />{incident.detection_type === "both" ? "Fire + smoke" : incident.detection_type}</Link><small className="event-note">{incident.notes?.startsWith("DEMO MODE:") ? "Local demo · no alerts sent" : incident.notes?.slice(0, 84) || "Automated camera detection"}</small></td><td><Link className="event-camera-link" href={`/platform/cameras/${incident.camera_id}`}>{cameraNames.get(incident.camera_id) ?? `Camera ${incident.camera_id.slice(0, 8)}`}</Link><small className="event-camera-id">{incident.camera_id.slice(0, 8)}</small></td><td className="event-confidence">{incident.confidence == null ? "—" : `${Math.round(incident.confidence * 100)}%`}</td><td className="event-datetime">{formatDate(incident.detected_at)}</td><td><span className={`event-status ${incident.status}`}>{incident.status}</span></td><td className="event-actions"><Link href={`/incidents/${incident.id}`} aria-label={`Review ${incident.detection_type} event`} title="Review details">↗</Link>{incident.status === "open" && <button type="button" disabled={savingId === incident.id} onClick={() => void changeStatus(incident, "acknowledged")} aria-label="Acknowledge event">Acknowledge</button>}{incident.status === "acknowledged" && <button type="button" disabled={savingId === incident.id} onClick={() => void changeStatus(incident, "resolved")} aria-label="Resolve event">Resolve</button>}</td></tr>)}</tbody></table></div>}
      </section>
      <footer className="events-footer">Live camera events refresh every 10 seconds. Uploaded video analysis stays attached to its review page and does not dispatch alerts.</footer>
    </section>
  </main>;
}

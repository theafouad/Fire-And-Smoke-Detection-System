"use client";

import { useEffect, useState } from "react";
import { getIncident, Incident, updateIncident } from "@/lib/api";

export default function IncidentDetailPage({ params }: { params: { incidentId: string } }) {
  const [incident, setIncident] = useState<Incident | null>(null);
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("Loading incident...");

  useEffect(() => {
    void getIncident(params.incidentId).then((next) => {
      setIncident(next);
      setNotes(next?.notes || "");
      setMessage(next ? "" : "Incident not found.");
    });
  }, [params.incidentId]);

  async function setStatus(status: Incident["status"]) {
    if (!incident) return;
    setMessage("Saving response...");
    try {
      const next = await updateIncident(incident.id, status, notes);
      setIncident(next);
      setMessage("Response saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save response.");
    }
  }

  if (!incident) return <main className="detail-shell"><p>{message}</p><a href="/incidents">Back to incidents</a></main>;
  return (
    <main className="detail-shell">
      <header className="detail-header"><a href="/incidents">← Incident queue</a><span className={`status-pill ${incident.status}`}>{incident.status}</span></header>
      <section className="detail-hero"><div><p className="eyebrow">Incident response</p><h1>{incident.detection_type} detected</h1><p className="muted">{new Date(incident.detected_at).toLocaleString()} · Camera {incident.camera_id.slice(0, 8)}</p></div><div className="response-actions"><button className="secondary-button" onClick={() => void setStatus("acknowledged")}>Acknowledge</button><button className="hero-button" onClick={() => void setStatus("resolved")}>Resolve incident</button></div></section>
      <section className="incident-detail-grid"><div className="evidence-panel"><div className="evidence-placeholder"><span>◉</span><b>Evidence capture</b><small>Video evidence will appear here when the edge recorder uploads an incident asset.</small></div><div className="timeline"><div><i className="timeline-dot alert" /><p><b>Detection created</b><small>{new Date(incident.detected_at).toLocaleString()}</small></p></div><div><i className="timeline-dot" /><p><b>Edge analysis</b><small>{incident.confidence == null ? "Confidence unavailable" : `${Math.round(incident.confidence * 100)}% confidence signal`}</small></p></div><div><i className="timeline-dot" /><p><b>Response status</b><small>{incident.status === "resolved" && incident.resolved_at ? `Resolved ${new Date(incident.resolved_at).toLocaleString()}` : "Awaiting operator action"}</small></p></div></div></div><div className="detail-panel"><p className="eyebrow">Operator notes</p><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Record what the team saw and how they responded." /><button className="secondary-button save-notes" onClick={() => void setStatus(incident.status)}>Save notes</button><p className="detail-message" role="status">{message}</p></div></section>
    </main>
  );
}

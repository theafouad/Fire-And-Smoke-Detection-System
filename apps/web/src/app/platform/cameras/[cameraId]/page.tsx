"use client";

import { useEffect, useState } from "react";
import { Camera, getCamera, testCamera } from "@/lib/api";

export default function CameraDetailPage({ params }: { params: { cameraId: string } }) {
  const [camera, setCamera] = useState<Camera | null>(null);
  const [message, setMessage] = useState("Loading camera...");

  async function load() {
    const next = await getCamera(params.cameraId);
    setCamera(next);
    setMessage(next ? "" : "Camera not found.");
  }

  useEffect(() => { void load(); }, [params.cameraId]);

  async function diagnose() {
    setMessage("Testing source...");
    try {
      const result = await testCamera(params.cameraId);
      setMessage(result.detail);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Camera test failed.");
    }
  }

  if (!camera) return <main className="detail-shell"><p>{message}</p><a href="/platform">Back to camera wall</a></main>;
  return (
    <main className="detail-shell">
      <header className="detail-header"><a href="/platform">← Camera wall</a><span className={`status-pill ${camera.status}`}>{camera.status}</span></header>
      <section className="detail-hero"><div><p className="eyebrow">Camera profile</p><h1>{camera.name}</h1><p className="muted">Source diagnostics and local edge monitoring status.</p></div><button className="hero-button" onClick={() => void diagnose()}>Run connection test</button></section>
      <section className="detail-grid">
        <div className="detail-preview"><div className="preview-placeholder"><span>▣</span><b>Live preview</b><small>Video preview is processed by the local edge agent.</small></div></div>
        <div className="detail-panel"><p className="eyebrow">Connection</p><dl><div><dt>Source</dt><dd>{camera.stream_url || "Not configured"}</dd></div><div><dt>Type</dt><dd>{camera.stream_url?.startsWith("local://") ? "Local USB camera" : "Network camera system"}</dd></div><div><dt>Last seen</dt><dd>{camera.last_seen_at ? new Date(camera.last_seen_at).toLocaleString() : "Never connected"}</dd></div><div><dt>Camera ID</dt><dd>{camera.id}</dd></div></dl><p className="detail-message" role="status">{message}</p></div>
      </section>
    </main>
  );
}

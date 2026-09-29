"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { API_BASE_URL, getVideoAnalysis, VideoAnalysis } from "@/lib/api";

export default function VideoAnalysisPage({ params }: { params: { videoId: string } }) {
  const [analysis, setAnalysis] = useState<VideoAnalysis | null>(null);
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let mounted = true;
    let timer: number | undefined;
    const load = async () => {
      try {
        const result = await getVideoAnalysis(params.videoId);
        if (!mounted) return;
        setAnalysis(result);
        if (result.status === "queued" || result.status === "processing") timer = window.setTimeout(load, 1200);
      } catch (cause) {
        if (mounted) setError(cause instanceof Error ? cause.message : "Unable to load video analysis.");
      }
    };
    void load();
    return () => { mounted = false; if (timer) window.clearTimeout(timer); };
  }, [params.videoId]);

  const samples = analysis?.samples ?? [];
  const drawOverlay = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth || !video.videoHeight) return;
    if (canvas.width !== video.clientWidth * devicePixelRatio || canvas.height !== video.clientHeight * devicePixelRatio) {
      canvas.width = video.clientWidth * devicePixelRatio;
      canvas.height = video.clientHeight * devicePixelRatio;
    }
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    const sample = samples.reduce<(typeof samples)[number] | null>((nearest, item) => {
      if (Math.abs(item.time_seconds - video.currentTime) > 0.6) return nearest;
      return !nearest || Math.abs(item.time_seconds - video.currentTime) < Math.abs(nearest.time_seconds - video.currentTime) ? item : nearest;
    }, null);
    if (!sample) return;
    const sourceAspect = video.videoWidth / video.videoHeight;
    const canvasAspect = canvas.width / canvas.height;
    const drawnWidth = sourceAspect > canvasAspect ? canvas.width : canvas.height * sourceAspect;
    const drawnHeight = sourceAspect > canvasAspect ? canvas.width / sourceAspect : canvas.height;
    const offsetX = (canvas.width - drawnWidth) / 2;
    const offsetY = (canvas.height - drawnHeight) / 2;
    const label = (text: string, x: number, y: number, color: string) => {
      context.font = `${13 * devicePixelRatio}px Arial`;
      const pad = 5 * devicePixelRatio;
      const width = context.measureText(text).width + pad * 2;
      context.fillStyle = color;
      context.fillRect(x, Math.max(0, y - 22 * devicePixelRatio), width, 22 * devicePixelRatio);
      context.fillStyle = "#fff";
      context.fillText(text, x + pad, Math.max(14 * devicePixelRatio, y - 6 * devicePixelRatio));
    };
    for (const hazard of sample.hazards) {
      const [x1, y1, x2, y2] = hazard.box;
      const x = offsetX + x1 * drawnWidth, y = offsetY + y1 * drawnHeight, width = (x2 - x1) * drawnWidth, height = (y2 - y1) * drawnHeight;
      const color = hazard.type === "fire" ? "#f36c49" : "#edb34d";
      context.strokeStyle = color;
      context.lineWidth = 3 * devicePixelRatio;
      context.strokeRect(x, y, width, height);
      label(`${hazard.type.toUpperCase()} · ${Math.round(hazard.confidence * 100)}%`, x, y, color);
    }
    for (const [x1, y1, x2, y2] of sample.people) {
      context.strokeStyle = "#64d88a";
      context.lineWidth = 2 * devicePixelRatio;
      context.strokeRect(offsetX + x1 * drawnWidth, offsetY + y1 * drawnHeight, (x2 - x1) * drawnWidth, (y2 - y1) * drawnHeight);
    }
  }, [samples]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.addEventListener("timeupdate", drawOverlay);
    video.addEventListener("loadedmetadata", drawOverlay);
    window.addEventListener("resize", drawOverlay);
    return () => {
      video.removeEventListener("timeupdate", drawOverlay);
      video.removeEventListener("loadedmetadata", drawOverlay);
      window.removeEventListener("resize", drawOverlay);
    };
  }, [drawOverlay, analysis?.status]);

  const flaggedSamples = useMemo(() => samples.filter((sample) => sample.hazards.length > 0), [samples]);
  const totalHazards = (analysis?.fire_count ?? 0) + (analysis?.smoke_count ?? 0);

  return <main className="control-room">
    <aside className="control-rail"><Link className="rail-brand" href="/platform"><span>✦</span><b>FE</b></Link><nav className="rail-nav" aria-label="Operations navigation"><Link className="rail-link" href="/platform"><span>▦</span><small>Live</small></Link><Link className="rail-link" href="/analytics"><span>◌</span><small>People</small></Link><Link className="rail-link active" href="/incidents"><span>◉</span><small>Events</small></Link><Link className="rail-link" href="/workspace#sites"><span>⌘</span><small>Sites</small></Link></nav></aside>
    <section className="room-content video-analysis-content">
      <header className="room-header"><div className="room-title"><span className="live-pulse" /><div><b>VIDEO REVIEW</b><small>{analysis?.filename ?? "Loading uploaded video"}</small></div></div><div className="room-actions"><Link className="room-workspace-link" href="/platform">Camera wall</Link><Link className="room-workspace-link" href="/incidents">Events</Link></div></header>
      <div className="room-toolbar"><div><h1>Video analysis</h1><p>Local inference · fire, smoke, and people boxes over the source clip</p></div><Link className="view-incidents" href="/platform">← Back to operations</Link></div>
      {error && <div className="video-error" role="alert">{error}</div>}
      {!analysis ? <div className="video-loading">Loading analysis record…</div> : <>
        <div className="video-status-line"><span className={`video-job-status ${analysis.status}`}>{analysis.status}</span><span>{analysis.duration_seconds ? `${Math.floor(analysis.duration_seconds / 60)}:${String(Math.floor(analysis.duration_seconds % 60)).padStart(2, "0")} duration` : "Preparing video"}</span><span>{analysis.frame_width && analysis.frame_height ? `${analysis.frame_width} × ${analysis.frame_height}` : ""}</span></div>
        {(analysis.status === "queued" || analysis.status === "processing") ? <div className="video-processing"><span className="video-processing-indicator" />Analyzing sampled frames. This page will update automatically.</div> : analysis.status === "failed" ? <div className="video-error" role="alert">{analysis.error || "The video could not be analyzed."}</div> : <>
          <section className="video-player-panel"><div className="video-player-stage"><video ref={videoRef} src={`${API_BASE_URL}/api/videos/${analysis.id}/source`} controls playsInline preload="metadata" onTimeUpdate={drawOverlay} /><canvas ref={canvasRef} className="video-detection-overlay" aria-hidden="true" /></div><div className="video-player-caption"><span>DETECTIONS OVERLAY</span><span>Boxes align to analyzed frames · sample interval 0.5 sec</span></div></section>
          <section className="video-summary-strip" aria-label="Video analysis totals"><div><span>FIRE FRAMES</span><b>{analysis.fire_count}</b></div><div><span>SMOKE FRAMES</span><b>{analysis.smoke_count}</b></div><div><span>PEAK PEOPLE</span><b>{analysis.people_count}</b></div><div><span>FLAGGED MOMENTS</span><b>{flaggedSamples.length}</b></div></section>
          <section className="video-moments-panel"><header><div><span className="panel-eyebrow">TIMELINE</span><h2>Flagged moments</h2></div><span>{flaggedSamples.length} moments</span></header>{flaggedSamples.length === 0 ? <p className="video-no-events">No fire or smoke detections crossed the current model thresholds in this video. Review a clear, well-lit clip or adjust the model for your camera before relying on results.</p> : <div className="video-moments-list">{flaggedSamples.slice(0, 150).map((sample) => <button className="video-moment-row" key={sample.time_seconds} type="button" onClick={() => { if (videoRef.current) { videoRef.current.currentTime = sample.time_seconds; void videoRef.current.play(); } }}><span className="video-moment-time">{Math.floor(sample.time_seconds / 60)}:{String(Math.floor(sample.time_seconds % 60)).padStart(2, "0")}</span><span className="video-moment-labels">{sample.hazards.map((hazard, index) => <em className={hazard.type} key={`${hazard.type}-${index}`}>{hazard.type} {Math.round(hazard.confidence * 100)}%</em>)}</span><span>{sample.people_count} people</span><span className="video-moment-play">↗</span></button>)}</div>}</section>
        </>}
      </>}
    </section>
  </main>;
}

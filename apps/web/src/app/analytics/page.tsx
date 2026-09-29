"use client";

import { useCallback, useEffect, useState } from "react";
import { AnalyticsEvent, AnalyticsSummary, getAnalyticsEvents, getAnalyticsSummary } from "@/lib/api";

const eventLabel: Record<AnalyticsEvent["event_type"], string> = {
  people_count: "People count",
  crowd_alert: "Crowd threshold",
  zone_presence: "Work zone presence",
  line_crossing: "Line crossing",
};

export default function AnalyticsPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try {
      const [nextSummary, nextEvents] = await Promise.all([getAnalyticsSummary(), getAnalyticsEvents()]);
      setSummary(nextSummary);
      setEvents(nextEvents);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Analytics service is unavailable.");
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  return (
    <main className="analytics-shell">
      <aside className="control-rail">
        <a className="rail-brand" href="/platform"><span>✦</span><b>FE</b></a>
        <nav className="rail-nav" aria-label="Operations navigation">
          <a className="rail-link" href="/platform"><span>▦</span><small>Live</small></a>
          <a className="rail-link active" href="/analytics"><span>◌</span><small>People</small></a>
          <a className="rail-link" href="/incidents"><span>◉</span><small>Events</small></a>
          <a className="rail-link" href="/workspace"><span>⌘</span><small>Sites</small></a>
        </nav>
      </aside>
      <section className="analytics-content">
        <header className="analytics-topbar"><div className="room-title"><span className="live-pulse" /><div><b>PEOPLE ANALYTICS</b><small>Aggregate occupancy and work-zone activity</small></div></div><button type="button" className="analytics-refresh" onClick={() => void refresh()}>Refresh ↻</button></header>
        <div className="analytics-heading"><div><span className="panel-eyebrow">SITE ACTIVITY</span><h1>People &amp; crowd analysis</h1><p>Anonymous counts from configured cameras, updated every few seconds.</p></div><a href="/platform">Camera wall ↗</a></div>
        <section className="analytics-metrics" aria-label="People analytics summary">
          <article><span>PEOPLE IN VIEW</span><strong>{summary?.people_now ?? "—"}</strong><small>Most recent count per reporting camera</small></article>
          <article><span>CROWD ALERTS TODAY</span><strong>{summary?.crowd_alerts_today ?? "—"}</strong><small>Threshold alerts across monitored cameras</small></article>
          <article><span>REPORTING CAMERAS</span><strong>{summary?.monitored_cameras ?? "—"}</strong><small>Sending people analytics events</small></article>
        </section>
        <section className="analytics-feed"><header><div><span className="panel-eyebrow">LIVE FEED</span><h2>Recent activity</h2></div><span className="analytics-auto"><i /> Refreshes every 5 sec</span></header>
          {error && <p className="analytics-error" role="status">{error}</p>}
          {events.length === 0 && !error ? <div className="analytics-empty"><b>No people analytics received</b><p>Connect a camera, configure its camera ID for the edge agent, and enable the person detection model to start counting.</p></div> : <div className="analytics-table-wrap"><table><thead><tr><th>EVENT</th><th>CAMERA</th><th>PEOPLE</th><th>WORK ZONE</th><th>CONFIDENCE</th><th>TIME</th></tr></thead><tbody>{events.map((event) => <tr key={event.id} className={event.event_type === "crowd_alert" ? "crowd-row" : ""}><td><span className={`analytics-kind ${event.event_type}`}>{eventLabel[event.event_type]}</span></td><td>{event.camera_id.slice(0, 8)}</td><td><b>{event.people_count}</b></td><td>{event.details.work_zone_count ?? "—"}</td><td>{event.confidence == null ? "—" : `${Math.round(event.confidence * 100)}%`}</td><td>{new Date(event.detected_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</td></tr>)}</tbody></table></div>}
        </section>
        <p className="analytics-privacy">Work-zone monitoring reports group counts only. It does not identify or score individual employees.</p>
      </section>
    </main>
  );
}

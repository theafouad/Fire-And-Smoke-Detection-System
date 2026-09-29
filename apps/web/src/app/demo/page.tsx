"use client";

import { FormEvent, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function DemoPage() {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`${API_URL}/api/demo-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form.entries()))
      });
      if (!response.ok) throw new Error("Unable to submit request");
      setSubmitted(true);
    } catch {
      setError("We couldn't send your request. Please try again or email the team directly.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="demo-page">
      <a className="demo-back" href="/">← Back to FlameEye</a>
      <section className="demo-layout">
        <div className="demo-copy"><p className="section-kicker">Book a free demo</p><h1>See what your existing cameras can do.</h1><p>Tell us a little about your sites and we&apos;ll show you how FlameEye can fit into your current security operation.</p><div className="demo-points"><span>✓ Connect existing DVR and RTSP feeds</span><span>✓ Review your fire and smoke workflow</span><span>✓ Get a practical pilot plan</span></div></div>
        <div className="demo-form-wrap">{submitted ? <div className="success-state"><span>✓</span><h2>Request received.</h2><p>Thanks for reaching out. We&apos;ll be in touch to arrange your demo.</p><a href="/">Return home</a></div> : <form onSubmit={submit}><label>Name<input required name="name" placeholder="Your name" /></label><label>Work email<input required type="email" name="email" placeholder="you@company.com" /></label><label>Company<input required name="company" placeholder="Company name" /></label><label>What are you protecting?<select name="industry" defaultValue="" required><option value="" disabled>Select an industry</option><option>Manufacturing</option><option>Warehousing</option><option>Data center</option><option>Education or healthcare</option></select></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="hero-button" type="submit" disabled={submitting}>{submitting ? "Sending request…" : "Request my demo"} <span>↗</span></button><small>We&apos;ll only use this information to contact you about your demo.</small></form>}</div>
      </section>
    </main>
  );
}

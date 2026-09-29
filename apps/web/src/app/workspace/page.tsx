"use client";

import { FormEvent, useEffect, useState } from "react";
import { Camera, createNotificationContact, createSite, getCameras, getNotificationContacts, getOrganizations, getSites, NotificationContact, Organization, Site, testNotificationContact } from "@/lib/api";

export default function WorkspacePage() {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [contacts, setContacts] = useState<NotificationContact[]>([]);
  const [contactMessage, setContactMessage] = useState("");
  const [contactSaving, setContactSaving] = useState(false);
  const [siteSaving, setSiteSaving] = useState(false);
  const [siteMessage, setSiteMessage] = useState("");

  useEffect(() => {
    void Promise.all([getOrganizations(), getSites(), getCameras()]).then(async ([orgs, nextSites, nextCameras]) => {
      setOrganization(orgs[0] ?? null);
      setSites(nextSites);
      setCameras(nextCameras);
      if (orgs[0]) setContacts(await getNotificationContacts(orgs[0].id));
    });
  }, []);

  async function addContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organization) return;
    setContactSaving(true);
    setContactMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const contact = await createNotificationContact({
        organization_id: organization.id,
        name: String(form.get("name") ?? ""),
        role: String(form.get("role") ?? ""),
        email: String(form.get("email") ?? "") || null,
        phone: String(form.get("phone") ?? "") || null,
        email_enabled: form.get("email_enabled") === "on",
        whatsapp_enabled: form.get("whatsapp_enabled") === "on"
      });
      setContacts((current) => [...current, contact]);
      event.currentTarget.reset();
      setContactMessage("Contact saved. Send a test from the contact row.");
    } catch (error) {
      setContactMessage(error instanceof Error ? error.message : "Unable to save contact.");
    } finally {
      setContactSaving(false);
    }
  }

  async function addSite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organization) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSiteSaving(true);
    setSiteMessage("");
    try {
      const site = await createSite({
        organization_id: organization.id,
        name: String(form.get("site_name") ?? ""),
        address: String(form.get("site_address") ?? "") || null,
        timezone: String(form.get("site_timezone") ?? "UTC")
      });
      setSites((current) => [site, ...current]);
      formElement.reset();
      setSiteMessage(`${site.name} is ready. You can now connect cameras or analyze a video for this site.`);
    } catch (error) {
      setSiteMessage(error instanceof Error ? error.message : "Unable to create site.");
    } finally {
      setSiteSaving(false);
    }
  }

  async function sendTest(contact: NotificationContact, channel: "email" | "whatsapp") {
    if (!organization) return;
    setContactMessage(`Sending ${channel} test to ${contact.name}...`);
    try {
      await testNotificationContact(organization.id, contact.id, channel);
      setContactMessage(`${channel === "email" ? "Email" : "WhatsApp"} test sent to ${contact.name}.`);
    } catch (error) {
      setContactMessage(error instanceof Error ? error.message : "Unable to send notification test.");
    }
  }

  return (
    <main className="workspace-shell">
      <header className="workspace-header"><a className="marketing-brand" href="/"><span className="brand-mark">✦</span><span>FLAME<span className="brand-accent">EYE</span></span></a><a className="secondary-button link-button" href="/platform">Open operations ↗</a></header>
      <section className="workspace-intro"><p className="eyebrow">Workspace settings</p><h1>{organization?.name || "Your FlameEye workspace"}</h1><p className="muted">The control plane for sites, camera coverage, and team access.</p></section>
      <section className="workspace-layout">
        <aside className="workspace-nav"><a className="active" href="#overview">Overview</a><a href="#sites">Sites & cameras</a><a href="#team">Team access</a><a href="#integrations">Integrations</a></aside>
        <div className="workspace-main">
          <section className="workspace-section" id="overview"><div className="workspace-section-heading"><div><p className="eyebrow">Workspace overview</p><h2>Operational coverage</h2></div><span className="status-pill online">ACTIVE</span></div><div className="workspace-stats"><div><strong>{sites.length}</strong><span>Protected sites</span></div><div><strong>{cameras.length}</strong><span>Connected cameras</span></div><div><strong>{cameras.filter((camera) => camera.status === "online").length}</strong><span>Online now</span></div></div></section>
          <section className="workspace-section" id="sites"><div className="workspace-section-heading"><div><p className="eyebrow">Infrastructure</p><h2>Sites and cameras</h2></div><a href="/platform">Manage in operations ↗</a></div><form className="site-create-form" onSubmit={addSite}><input name="site_name" aria-label="Site name" placeholder="New site name" required maxLength={200} /><input name="site_address" aria-label="Site address" placeholder="Address or location (optional)" maxLength={500} /><input name="site_timezone" aria-label="Site time zone" defaultValue="UTC" placeholder="IANA time zone, e.g. Africa/Cairo" required maxLength={64} /><button className="secondary-button" type="submit" disabled={siteSaving || !organization}>{siteSaving ? "Creating…" : "Add site"}</button></form>{siteMessage && <p className="form-help" role="status">{siteMessage}</p>}{sites.length === 0 ? <p className="muted">No sites yet. Add a site above to organize its cameras and video analyses.</p> : sites.map((site) => <div className="workspace-site" key={site.id}><div><b>{site.name}</b><small>{site.address || "Address not added"}</small></div><span>{cameras.filter((camera) => camera.site_id === site.id).length} cameras</span></div>)}</section>
          <section className="workspace-section" id="team"><div className="workspace-section-heading"><div><p className="eyebrow">People</p><h2>Team access</h2></div><button className="secondary-button" type="button">Invite teammate</button></div><div className="team-row"><span className="avatar">AD</span><div><b>Workspace administrator</b><small>Owner · Full access</small></div><span className="status-pill online">ACTIVE</span></div><p className="muted workspace-note">Role-based invitations are the next layer of the workspace. Keep response permissions separate from camera administration as your team grows.</p></section>
          <section className="workspace-section" id="integrations"><div className="workspace-section-heading"><div><p className="eyebrow">Response routing</p><h2>Owners and guards</h2></div><span className="status-pill online">TESTABLE</span></div><p className="muted">Add the people who should receive an alert. Email uses SMTP; WhatsApp uses the Meta WhatsApp Cloud API configured on the server.</p><form className="contact-form" onSubmit={addContact}><input name="name" placeholder="Contact name" aria-label="Contact name" required /><select name="role" defaultValue="guard" aria-label="Contact role"><option value="owner">Owner</option><option value="guard">Guard</option><option value="manager">Manager</option></select><input name="email" type="email" placeholder="Email address" aria-label="Email address" /><input name="phone" placeholder="+15551234567" aria-label="WhatsApp phone number" /><label><input type="checkbox" name="email_enabled" defaultChecked /> Email</label><label><input type="checkbox" name="whatsapp_enabled" /> WhatsApp</label><button className="secondary-button" type="submit" disabled={contactSaving}>{contactSaving ? "Saving…" : "Add contact"}</button></form>{contactMessage && <p className="form-help" role="status">{contactMessage}</p>}<div className="contact-list">{contacts.map((contact) => <div className="contact-row" key={contact.id}><div><b>{contact.name}</b><small>{contact.role} · {contact.email || contact.phone}</small></div><div className="contact-actions">{contact.email && <button type="button" onClick={() => void sendTest(contact, "email")}>Test email</button>}{contact.phone && <button type="button" onClick={() => void sendTest(contact, "whatsapp")}>Test WhatsApp</button>}</div></div>)}{contacts.length === 0 && <p className="muted">No alert recipients yet.</p>}</div></section>
        </div>
      </section>
    </main>
  );
}

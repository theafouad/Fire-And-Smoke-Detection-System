const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
export const API_BASE_URL = API_URL;

export type DashboardSummary = {
  sites_total: number;
  cameras_total: number;
  cameras_online: number;
  incidents_open: number;
  incidents_today: number;
  people_now: number;
  crowd_alerts_today: number;
};

export type AnalyticsEvent = {
  id: string;
  camera_id: string;
  event_type: "people_count" | "crowd_alert" | "zone_presence" | "line_crossing";
  people_count: number;
  confidence: number | null;
  details: Record<string, string | number | boolean | null>;
  detected_at: string;
};

export type AnalyticsSummary = { people_now: number; crowd_alerts_today: number; monitored_cameras: number };

export type Incident = {
  id: string;
  camera_id: string;
  detection_type: "fire" | "smoke" | "both";
  confidence: number | null;
  status: "open" | "acknowledged" | "resolved";
  detected_at: string;
  notes: string | null;
  resolved_at?: string | null;
};

export type Organization = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
};

export type Site = {
  id: string;
  name: string;
  address: string | null;
  timezone: string;
  created_at: string;
};

export type VideoAnalysis = {
  id: string;
  site_id: string;
  filename: string;
  status: "queued" | "processing" | "complete" | "failed";
  duration_seconds: number | null;
  frame_width: number | null;
  frame_height: number | null;
  fire_count: number;
  smoke_count: number;
  people_count: number;
  error: string | null;
  created_at: string;
  samples?: Array<{
    time_seconds: number;
    hazards: Array<{ type: "fire" | "smoke"; confidence: number; box: number[] }>;
    people: number[][];
    people_count: number;
    work_zone_count: number;
  }>;
};

export type Camera = {
  id: string;
  site_id: string;
  name: string;
  stream_url: string | null;
  status: string;
  last_seen_at: string | null;
  is_active: boolean;
};

export type NotificationContact = {
  id: string;
  organization_id: string;
  name: string;
  role: string;
  email: string | null;
  phone: string | null;
  email_enabled: boolean;
  whatsapp_enabled: boolean;
  is_active: boolean;
};

export type CameraCreateInput = {
  site_id: string;
  name: string;
  stream_url: string;
  is_active?: boolean;
};

export async function getDashboardSummary(): Promise<DashboardSummary | null> {
  try {
    const response = await fetch(`${API_URL}/api/dashboard/summary`, { next: { revalidate: 10 } });
    if (!response.ok) return null;
    return (await response.json()) as DashboardSummary;
  } catch {
    return null;
  }
}

export async function getIncidents(): Promise<Incident[]> {
  try {
    const response = await fetch(`${API_URL}/api/incidents`, { next: { revalidate: 5 } });
    if (!response.ok) return [];
    return (await response.json()) as Incident[];
  } catch {
    return [];
  }
}

export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  const response = await fetch(`${API_URL}/api/analytics/summary`, { cache: "no-store" });
  if (!response.ok) throw new Error("Unable to load analytics summary");
  return (await response.json()) as AnalyticsSummary;
}

export async function getAnalyticsEvents(): Promise<AnalyticsEvent[]> {
  const response = await fetch(`${API_URL}/api/analytics/events?limit=100`, { cache: "no-store" });
  if (!response.ok) throw new Error("Unable to load analytics events");
  return (await response.json()) as AnalyticsEvent[];
}

export async function getIncident(incidentId: string): Promise<Incident | null> {
  try {
    const response = await fetch(`${API_URL}/api/incidents/${incidentId}`, { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as Incident;
  } catch {
    return null;
  }
}

export async function updateIncident(incidentId: string, status: Incident["status"], notes?: string): Promise<Incident> {
  const response = await fetch(`${API_URL}/api/incidents/${incidentId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, notes })
  });
  if (!response.ok) throw new Error("Unable to update this incident");
  return (await response.json()) as Incident;
}

export async function getSites(): Promise<Site[]> {
  try {
    const response = await fetch(`${API_URL}/api/sites`, { next: { revalidate: 30 } });
    if (!response.ok) return [];
    return (await response.json()) as Site[];
  } catch {
    return [];
  }
}

export async function getOrganizations(): Promise<Organization[]> {
  try {
    const response = await fetch(`${API_URL}/api/organizations`, { cache: "no-store" });
    if (!response.ok) return [];
    return (await response.json()) as Organization[];
  } catch {
    return [];
  }
}

export async function getCameras(): Promise<Camera[]> {
  try {
    const response = await fetch(`${API_URL}/api/cameras`, { next: { revalidate: 10 } });
    if (!response.ok) return [];
    return (await response.json()) as Camera[];
  } catch {
    return [];
  }
}

export async function getCamera(cameraId: string): Promise<Camera | null> {
  try {
    const response = await fetch(`${API_URL}/api/cameras/${cameraId}`, { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as Camera;
  } catch {
    return null;
  }
}

export async function createCamera(input: CameraCreateInput): Promise<Camera> {
  const response = await fetch(`${API_URL}/api/cameras`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  if (!response.ok) throw new Error("Unable to connect this camera");
  return (await response.json()) as Camera;
}

export async function createSite(input: { organization_id: string; name: string; address: string | null; timezone: string }): Promise<Site> {
  const response = await fetch(`${API_URL}/api/sites`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(body?.detail ?? "Unable to create this site");
  }
  return (await response.json()) as Site;
}

export async function uploadVideo(siteId: string, file: File): Promise<VideoAnalysis> {
  const body = new FormData();
  body.set("site_id", siteId);
  body.set("video", file);
  const response = await fetch(`${API_URL}/api/videos`, { method: "POST", body });
  if (!response.ok) {
    const result = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(result?.detail ?? "Unable to upload video");
  }
  return (await response.json()) as VideoAnalysis;
}

export async function getVideoAnalysis(videoId: string): Promise<VideoAnalysis> {
  const response = await fetch(`${API_URL}/api/videos/${videoId}`, { cache: "no-store" });
  if (!response.ok) throw new Error("Unable to load this video analysis");
  return (await response.json()) as VideoAnalysis;
}

export async function testCamera(cameraId: string): Promise<{ reachable: boolean; status: string; detail: string }> {
  const response = await fetch(`${API_URL}/api/cameras/${cameraId}/test`, { method: "POST" });
  if (!response.ok) throw new Error("Camera test failed");
  return (await response.json()) as { reachable: boolean; status: string; detail: string };
}

export async function testDetection(cameraId: string): Promise<{ incident_id: string | null; detail: string }> {
  const response = await fetch(`${API_URL}/api/cameras/${cameraId}/test-detection`, { method: "POST" });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(body?.detail ?? "Detection test failed");
  }
  return (await response.json()) as { incident_id: string | null; detail: string };
}

export async function getNotificationContacts(organizationId: string): Promise<NotificationContact[]> {
  const response = await fetch(`${API_URL}/api/organizations/${organizationId}/notifications/contacts`, { cache: "no-store" });
  if (!response.ok) throw new Error("Unable to load notification contacts");
  return (await response.json()) as NotificationContact[];
}

export async function createNotificationContact(input: Omit<NotificationContact, "id" | "is_active">): Promise<NotificationContact> {
  const response = await fetch(`${API_URL}/api/organizations/${input.organization_id}/notifications/contacts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(body?.detail ?? "Unable to save notification contact");
  }
  return (await response.json()) as NotificationContact;
}

export async function testNotificationContact(organizationId: string, contactId: string, channel: "email" | "whatsapp"): Promise<void> {
  const response = await fetch(`${API_URL}/api/organizations/${organizationId}/notifications/contacts/${contactId}/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ channel })
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(body?.detail ?? "Unable to send notification test");
  }
}

export async function seedDemoWorkspace(): Promise<{ status: string; sites: number; cameras: number; incidents: number }> {
  const response = await fetch(`${API_URL}/api/demo/seed`, { method: "POST" });
  if (!response.ok) throw new Error("Unable to prepare the demo workspace");
  return (await response.json()) as { status: string; sites: number; cameras: number; incidents: number };
}

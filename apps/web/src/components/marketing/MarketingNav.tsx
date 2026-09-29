"use client";

import { useState } from "react";

type MenuItem = { label: string; href: string; description?: string };
type Menu = { label: string; items: MenuItem[] };

const menus: Menu[] = [
  {
    label: "Products",
    items: [
      { label: "Fire & Smoke Detection", href: "#product", description: "Detect visual hazards early." },
      { label: "Incident Intelligence", href: "#analytics", description: "Turn signals into action." },
      { label: "Multi-site Operations", href: "#product", description: "One view across every site." },
      { label: "On-Premise VMS", href: "#works-with", description: "Keep your existing video stack." }
    ]
  },
  {
    label: "AI Analytics",
    items: [
      { label: "Fire & Smoke Detection", href: "#analytics", description: "Early visual warning." },
      { label: "People Counting", href: "#analytics", description: "Understand occupancy." },
      { label: "Crowd Analysis", href: "#analytics", description: "See patterns at a glance." },
      { label: "Safety & Compliance", href: "#analytics", description: "Support safer operations." }
    ]
  },
  {
    label: "Industries",
    items: [
      { label: "Manufacturing", href: "#industries" },
      { label: "Warehousing & Logistics", href: "#industries" },
      { label: "Data Centers", href: "#industries" },
      { label: "Education & Healthcare", href: "#industries" }
    ]
  },
  {
    label: "Works With",
    items: [
      { label: "DVR & NVR Systems", href: "#works-with" },
      { label: "RTSP Cameras", href: "#works-with" },
      { label: "ONVIF Discovery", href: "#works-with" },
      { label: "Existing VMS Platforms", href: "#works-with" }
    ]
  },
  {
    label: "Resources",
    items: [
      { label: "How it works", href: "#analytics" },
      { label: "Book a free demo", href: "/demo" },
      { label: "Camera command center", href: "/platform", description: "Monitor connected sources." },
      { label: "Incident response", href: "/incidents", description: "Review and resolve events." },
      { label: "Workspace", href: "/workspace", description: "Manage sites and coverage." },
      { label: "Contact the team", href: "/demo" }
    ]
  }
];

export function MarketingNav() {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <nav className="marketing-nav" aria-label="Main navigation">
      <a className="marketing-brand" href="/">
        <span className="brand-mark">✦</span>
        <span>FLAME<span className="brand-accent">EYE</span></span>
      </a>
      <div className="marketing-links">
        <a href="/">Home</a>
        {menus.map((menu) => (
          <div className="nav-menu" key={menu.label}>
            <button
              className={open === menu.label ? "nav-menu-trigger is-open" : "nav-menu-trigger"}
              onClick={() => setOpen(open === menu.label ? null : menu.label)}
              aria-expanded={open === menu.label}
            >
              {menu.label} <span className="chevron">⌄</span>
            </button>
            {open === menu.label && (
              <div className={`mega-menu ${menu.label === "Products" || menu.label === "AI Analytics" ? "two-column-menu" : ""}`}>
                <div className="mega-menu-heading">{menu.label === "Products" || menu.label === "AI Analytics" ? "Explore FlameEye" : menu.label}</div>
                {menu.items.map((item) => (
                  <a className="mega-menu-item" href={item.href} key={item.label} onClick={() => setOpen(null)}>
                    <span className="menu-icon">{menu.label === "Industries" ? "◆" : "✦"}</span>
                    <span><b>{item.label}</b>{item.description && <small>{item.description}</small>}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
        <a href="/platform">Open app</a>
      </div>
      <a className="nav-cta" href="/demo">Book a free demo <span>↗</span></a>
      <button className="mobile-menu-button" onClick={() => setOpen(open === "mobile" ? null : "mobile")} aria-label="Toggle navigation">☰</button>
      {open === "mobile" && (
        <div className="mobile-menu">
          <a href="/">Home</a>
          {menus.flatMap((menu) => menu.items.map((item) => ({ ...item, menu: menu.label }))).map((item) => <a href={item.href} key={`${item.menu}-${item.label}`}>{item.label}</a>)}
          <a href="/platform">Open app</a>
          <a href="/workspace">Workspace</a>
          <a href="/incidents">Incident response</a>
          <a href="/demo">Book a free demo ↗</a>
        </div>
      )}
    </nav>
  );
}

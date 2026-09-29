# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The primary buyers and daily users are manufacturing and site security teams responsible for monitoring facilities, responding to hazards, and reducing time to intervention.

## Product Purpose

FlameEye is an AI fire and smoke detection product that helps teams monitor sites, detect hazards from camera feeds, review evidence, and respond to incidents from a central operations experience.

## Positioning

FlameEye is designed to work with existing cameras and DVR systems rather than requiring customers to replace their surveillance hardware. The initial product position is practical fire and smoke intelligence across standard USB and RTSP camera sources.

## Operating Context

Customers operate factories and other physical sites with existing CCTV/DVR infrastructure. Security teams need a centralized view of connected sites, cameras, incidents, video evidence, and response status.

## Capabilities and Constraints

- The project has a working Python/OpenCV/YOLO prototype for local camera and RTSP stream processing.
- The product is being evolved toward a Next.js frontend, FastAPI backend, and edge processing agent.
- Standard RTSP camera streams are supported in the current prototype.
- ONVIF discovery and broader DVR onboarding are planned, not yet complete.
- The first website should support product discovery, AI analytics, industry use cases, and booking a free demo.
- Authentication, billing, customer proof, and production-grade deployment are not yet complete.

## Brand Commitments

- Product name: FlameEye.
- The voice should be credible, direct, and operational rather than exaggerated.
- The website should present FlameEye as a real startup product, while avoiding unsupported customer, performance, or deployment claims.

## Evidence on Hand

- Working prototype source in `agents/`.
- Fire detection model in `fire.pt`.
- Existing recorded alert clips in `alert_records/`.
- No confirmed customer case studies, testimonials, or production benchmarks are available yet.

## Product Principles

- Work with the infrastructure customers already own.
- Make detection actionable, not merely interesting.
- Show evidence and response status for every incident.
- Prefer a focused fire and smoke product before expanding into broad analytics.
- Be transparent about prototype capabilities and product maturity.

## Accessibility & Inclusion

The web experience should support keyboard navigation, readable contrast, responsive layouts, clear form labels, and concise status language suitable for security operations teams.

const products = [
  {
    number: "01",
    title: "Fire & smoke detection",
    text: "Detect the first visible signs of fire across existing camera feeds before a routine shift becomes an emergency.",
    accent: "orange"
  },
  {
    number: "02",
    title: "Incident intelligence",
    text: "Turn a detection into a clear event with confidence, site, camera, video evidence, and response status.",
    accent: "blue"
  },
  {
    number: "03",
    title: "Multi-site operations",
    text: "Give security teams one operational view across factories, warehouses, and facilities.",
    accent: "green"
  }
];

const industries = [
  ["Manufacturing", "Protect production floors, storage areas, and critical equipment."],
  ["Warehousing", "Watch high-risk inventory, loading bays, and remote zones."],
  ["Data centers", "Add an intelligent visual layer to existing physical security."],
  ["Education & healthcare", "Help teams spot incidents early across complex sites."]
];

export default function HomePage() {
  return (
    <main>
      <MarketingNav />

      <section className="hero">
        <div className="hero-copy">
          <p className="hero-kicker"><span className="live-dot" /> Visual intelligence for safer sites</p>
          <h1>See risk sooner.<br /><em>Respond with certainty.</em></h1>
          <p className="hero-lede">
            FlameEye brings AI fire and smoke detection to the cameras you already have — giving
            security teams the clarity to act before a small signal becomes a costly incident.
          </p>
          <div className="hero-actions">
            <a className="hero-button" href="/demo">Book a free demo <span>↗</span></a>
            <a className="text-button" href="/platform">Open the app <span>↗</span></a>
          </div>
          <p className="hero-note">Works with standard USB and RTSP camera sources. Built for real-world operations.</p>
        </div>
        <div className="hero-visual" aria-label="Illustration of a monitored facility">
          <div className="visual-grid" />
          <div className="scan-line" />
          <div className="camera-frame">
            <div className="frame-top"><span>LIVE / WAREHOUSE 04</span><span className="frame-status">● MONITORING</span></div>
            <div className="warehouse-scene">
              <div className="warehouse-roof" />
              <div className="warehouse-column one" /><div className="warehouse-column two" />
              <div className="warehouse-floor" />
              <div className="hazard-zone"><span>FIRE SIGNAL</span><b>92%</b></div>
            </div>
            <div className="frame-bottom"><span>CAM 04 · 18:42:07</span><span>AI ANALYSIS ACTIVE</span></div>
          </div>
          <div className="alert-card"><span className="alert-icon">!</span><div><b>Potential fire detected</b><span>Warehouse 04 · 2 sec ago</span></div><span className="alert-arrow">↗</span></div>
          <div className="visual-caption">A clearer signal in the moments that matter.</div>
        </div>
      </section>

      <section className="proof-strip">
        <span>Designed for teams protecting</span>
        <b>FACTORIES</b><b>WAREHOUSES</b><b>CRITICAL SITES</b><b>PEOPLE</b>
      </section>

      <section className="section product-section" id="product">
        <div className="section-intro">
          <p className="section-kicker">One focused platform</p>
          <h2>From camera feed<br /><span>to confident action.</span></h2>
          <p>Security software should reduce uncertainty, not add another screen to watch. FlameEye connects detection, evidence, and response in one focused workflow.</p>
        </div>
        <div className="product-list">
          {products.map((product, index) => (
            <a className={`product-row ${product.accent}`} href={index === 0 ? "/platform" : index === 1 ? "/incidents" : "/workspace"} key={product.number}>
              <span className="product-number">{product.number}</span>
              <div><h3>{product.title}</h3><p>{product.text}</p></div>
              <span className="row-arrow">↗</span>
            </a>
          ))}
        </div>
      </section>

      <section className="analytics-section" id="analytics">
        <div className="analytics-copy">
          <p className="section-kicker">AI analytics, without the black box</p>
          <h2>Make every alert<br /><span>easy to trust.</span></h2>
          <p>FlameEye is built around the operational questions teams ask in the moment: where is it, what happened, how certain are we, and who has responded?</p>
          <a className="inline-link" href="/platform">See the live workspace <span>↗</span></a>
        </div>
        <div className="analytics-panel">
          <div className="analytics-header"><span>INCIDENT / 00042</span><span className="resolved">● OPEN</span></div>
          <div className="analytics-main"><span className="large-signal">92<span>%</span></span><div><b>Fire confidence</b><span>Warehouse 04 · Camera 04</span></div></div>
          <div className="signal-bars"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
          <div className="analytics-details"><span>DETECTED <b>18:42:05</b></span><span>PEOPLE <b>03</b></span><span>STATUS <b>REVIEW NOW</b></span></div>
        </div>
      </section>

      <section className="works-with-section" id="works-with">
        <div><p className="section-kicker">Works with what you have</p><h2>Connect your existing<br /><span>video infrastructure.</span></h2></div>
        <div className="works-with-list"><a href="/platform">RTSP cameras ↗</a><a href="/platform">DVR &amp; NVR systems ↗</a><a href="/platform">ONVIF discovery ↗</a><a href="/platform">Existing VMS platforms ↗</a></div>
      </section>

      <section className="section industries-section" id="industries">
        <div className="section-intro wide-intro">
          <p className="section-kicker">Built for the environments you run</p>
          <h2>One platform.<br /><span>Every critical site.</span></h2>
        </div>
        <div className="industry-grid">
          {industries.map(([title, text], index) => (
            <article className="industry-card" key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{text}</p><a href="/workspace">Explore workspace ↗</a></article>
          ))}
        </div>
      </section>

      <section className="demo-banner">
        <div><p className="section-kicker">Ready to see your sites differently?</p><h2>Start with a conversation.<br /><em>Not a hard sell.</em></h2></div>
        <a className="hero-button light" href="/demo">Book a free demo <span>↗</span></a>
      </section>

      <footer className="marketing-footer"><a className="marketing-brand" href="/"><span className="brand-mark">✦</span><span>FLAME<span className="brand-accent">EYE</span></span></a><span>AI visual intelligence for safer operations.</span><div className="footer-links"><a href="/platform">App</a><a href="/workspace">Workspace</a><a href="/incidents">Incidents</a><a href="/demo">Demo</a></div><span>© 2026 FlameEye</span></footer>
    </main>
  );
}
import { MarketingNav } from "@/components/marketing/MarketingNav";

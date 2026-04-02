import React, { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import "./Home.css";


/* ── Animation Variants ─────────────────────────────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 44 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] },
  }),
};

const slideFromLeft = {
  hidden: { opacity: 0, x: -64 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
  },
};

const slideFromRight = {
  hidden: { opacity: 0, x: 64 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
  },
};

/* ── Static Data ────────────────────────────────────────── */
const WARDROBE_ITEMS = [
  { emoji: "👕", label: "White Tee",    bg: "#f0f0f0" },
  { emoji: "👗", label: "Floral Dress", bg: "#fce4ec" },
  { emoji: "👟", label: "Sneakers",     bg: "#e3f2fd" },
  { emoji: "👔", label: "Dress Shirt",  bg: "#e8f5e9" },
  { emoji: "🧥", label: "Overcoat",     bg: "#f3e5f5" },
  { emoji: "👜", label: "Tote Bag",     bg: "#fff3e0" },
];

const STEPS = [
  {
    number: "01",
    emoji: "📸",
    title: "Upload Your Clothes",
    desc: "Photograph your clothing and upload it. ClosetMate automatically strips the background and uses AI to detect the item name, season, and weather classification.",
  },
  {
    number: "02",
    emoji: "✨",
    title: "Generate AI Outfits",
    desc: "Choose your occasion, season, and style preference. The AI engine picks the best combinations from your wardrobe and gives each outfit a cohesion score with reasoning.",
  },
  {
    number: "03",
    emoji: "🌍",
    title: "Share & Discover",
    desc: "Publish your favourite outfits to the community feed. Collect emoji reactions, star ratings, and comments — and get inspired by looks from other users.",
  },
];

const FEATURES = [
  {
    side: "left",
    emoji: "🗂️",
    title: "Smart Wardrobe Management",
    desc: "Upload photos of your clothes and watch ClosetMate instantly remove backgrounds, auto-tag item names, and classify each piece by season and weather. Every item neatly catalogued — one click away.",
    highlights: ["Auto background removal", "AI item name detection", "Season & weather tagging"],
    mockup: "wardrobe",
  },
  {
    side: "right",
    emoji: "🤖",
    title: "AI-Powered Outfit Generation",
    desc: "Tell the AI your occasion (work, date night, gym, beach…), your style preference (casual, formal, streetwear…) and the season. It draws from your actual wardrobe and returns outfits with a cohesion score and detailed AI reasoning.",
    highlights: ["10+ occasion filters", "12 style preferences", "Cohesion score & AI reasoning"],
    mockup: "outfits",
  },
  {
    side: "left",
    emoji: "🌐",
    title: "Community Style Feed",
    desc: "Share your best outfits with a growing community. React with 5 emoji types, rate looks with stars, and leave comments. See what others are wearing and find fresh inspiration every day.",
    highlights: ["5 emoji reaction types", "Star ratings (1–5)", "Comments per outfit"],
    mockup: "community",
  },
];

/* ── Mockup Components ──────────────────────────────────── */
const WardrobeMockup = () => (
  <div className="lp-mockup lp-mockup--wardrobe">
    <div className="lp-mockup__bar">
      <span className="lp-mockup__bar-title">My Wardrobe</span>
      <span className="lp-mockup__pill">6 items</span>
    </div>
    <div className="lp-mockup__grid3">
      {WARDROBE_ITEMS.map((item, i) => (
        <div key={i} className="lp-mockup__cloth-card" style={{ background: item.bg }}>
          <span className="lp-mockup__cloth-emoji">{item.emoji}</span>
          <span className="lp-mockup__cloth-label">{item.label}</span>
        </div>
      ))}
    </div>
  </div>
);

const OutfitMockup = () => (
  <div className="lp-mockup lp-mockup--outfits">
    <div className="lp-mockup__outfit-label">✨ AI Generated Outfit</div>
    <div className="lp-mockup__outfit-row">
      <div className="lp-mockup__outfit-piece">👔</div>
      <span className="lp-mockup__plus">+</span>
      <div className="lp-mockup__outfit-piece">👖</div>
      <span className="lp-mockup__plus">+</span>
      <div className="lp-mockup__outfit-piece">👟</div>
    </div>
    <div className="lp-mockup__tags">
      <span className="lp-tag lp-tag--blue">Business Casual</span>
      <span className="lp-tag lp-tag--green">Spring</span>
      <span className="lp-tag lp-tag--purple">Work</span>
    </div>
    <div className="lp-mockup__score-row">
      <span>Cohesion Score</span>
      <span className="lp-mockup__score-val">9 / 10</span>
    </div>
    <p className="lp-mockup__reasoning">
      "The structured shirt and slim trousers balance each other perfectly for a sharp, effortless office look."
    </p>
  </div>
);

const CommunityMockup = () => (
  <div className="lp-mockup lp-mockup--community">
    <div className="lp-mockup__post-head">
      <div className="lp-mockup__avatar">S</div>
      <div>
        <div className="lp-mockup__username">@sarah_styles</div>
        <div className="lp-mockup__time">2h ago</div>
      </div>
    </div>
    <div className="lp-mockup__post-items">
      <span>👗</span>
      <span>👠</span>
      <span>👜</span>
    </div>
    <div className="lp-mockup__reactions">
      <span>👍 24</span>
      <span>❤️ 18</span>
      <span>🔥 12</span>
      <span>😎 9</span>
    </div>
    <div className="lp-mockup__stars-row">
      <span>⭐⭐⭐⭐⭐</span>
      <span className="lp-mockup__rating">4.8</span>
    </div>
    <div className="lp-mockup__comments">💬 14 comments</div>
  </div>
);

const MOCKUP_MAP = {
  wardrobe: <WardrobeMockup />,
  outfits: <OutfitMockup />,
  community: <CommunityMockup />,
};

/* ── Page ───────────────────────────────────────────────── */
const Home = () => {
  const navigate = useNavigate();
  const howItWorksRef = useRef(null);
  const featuresRef = useRef(null);

  const scrollToHIW = () =>
    howItWorksRef.current?.scrollIntoView({ behavior: "smooth" });

  const scrollToFeatures = () =>
    featuresRef.current?.scrollIntoView({ behavior: "smooth" });

  return (
    <main className="lp-page">

      {/* ════════════════════ HERO ════════════════════════ */}
      <section className="lp-hero">
        <div className="lp-hero__content">
          <motion.div
            className="lp-hero__eyebrow"
            initial="hidden" animate="visible" custom={0} variants={fadeUp}
          >
            <span className="lp-eyebrow-dot" />
            AI-Powered Style
          </motion.div>

          <motion.h1
            className="lp-hero__headline"
            initial="hidden" animate="visible" custom={0.1} variants={fadeUp}
          >
            Stop Guessing<br />
            <span className="lp-hero__gradient-text">What To Wear.</span>
          </motion.h1>

          <motion.p
            className="lp-hero__sub"
            initial="hidden" animate="visible" custom={0.22} variants={fadeUp}
          >
            ClosetMate digitizes your wardrobe and uses AI to suggest perfect
            outfits — every single day.
          </motion.p>

          <motion.div
            className="lp-hero__ctas"
            initial="hidden" animate="visible" custom={0.34} variants={fadeUp}
          >
            <motion.button
              className="lp-btn lp-btn--primary"
              onClick={scrollToFeatures}
              whileHover={{ scale: 1.03, transition: { type: "spring", stiffness: 380, damping: 18 } }}
              whileTap={{ scale: 0.97 }}
            >
              Features
            </motion.button>
            <motion.button
              className="lp-btn lp-btn--ghost"
              onClick={scrollToHIW}
              whileHover={{ scale: 1.03, transition: { type: "spring", stiffness: 380, damping: 18 } }}
              whileTap={{ scale: 0.97 }}
            >
              See How It Works
            </motion.button>
          </motion.div>
        </div>

        <motion.div
          className="lp-hero__mockup-wrap"
          initial={{ opacity: 0, x: 56 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.85, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.div
            animate={{ y: [0, -14, 0] }}
            transition={{ repeat: Infinity, duration: 4.2, ease: "easeInOut" }}
          >
            <div className="lp-hero__panel">
              <div className="lp-hero__panel-header">
                <span>My Wardrobe</span>
                <span className="lp-pill">12 items</span>
              </div>
              <div className="lp-hero__panel-grid">
                {WARDROBE_ITEMS.map((item, i) => (
                  <div
                    key={i}
                    className="lp-hero__panel-card"
                    style={{ background: item.bg }}
                  >
                    <span>{item.emoji}</span>
                    <span className="lp-hero__panel-label">{item.label}</span>
                  </div>
                ))}
              </div>
              <div className="lp-hero__panel-footer">
                ✨ 3 outfits ready to wear
              </div>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* ════════════════ HOW IT WORKS ════════════════════ */}
      <section className="lp-hiw" ref={howItWorksRef}>
        <motion.span
          className="lp-section-chip"
          initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }}
          custom={0} variants={fadeUp}
        >
          Simple Process
        </motion.span>
        <motion.h2
          className="lp-section-title"
          initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }}
          custom={0.1} variants={fadeUp}
        >
          Get Dressed Smarter in 3 Steps
        </motion.h2>

        <div className="lp-hiw__row">
          {STEPS.map((step, i) => (
            <React.Fragment key={step.number}>
              <motion.div
                className="lp-hiw__step"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.3 }}
                custom={i * 0.16 + 0.2}
                variants={fadeUp}
              >
                <div className="lp-hiw__step-num">{step.number}</div>
                <div className="lp-hiw__step-icon">{step.emoji}</div>
                <h3 className="lp-hiw__step-title">{step.title}</h3>
                <p className="lp-hiw__step-desc">{step.desc}</p>
              </motion.div>
              {i < STEPS.length - 1 && (
                <div className="lp-hiw__connector" aria-hidden="true" />
              )}
            </React.Fragment>
          ))}
        </div>
      </section>

      {/* ════════════════ FEATURES ════════════════════════ */}
      <section className="lp-features" ref={featuresRef}>
        <motion.span
          className="lp-section-chip"
          initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }}
          custom={0} variants={fadeUp}
        >
          Features
        </motion.span>
        <motion.h2
          className="lp-section-title"
          initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }}
          custom={0.1} variants={fadeUp}
        >
          Everything Your Wardrobe Needs
        </motion.h2>

        <div className="lp-features__list">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className={`lp-feature-block lp-feature-block--${f.side}`}
            >
              <motion.div
                className="lp-feature-block__text"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.25 }}
                variants={f.side === "left" ? slideFromLeft : slideFromRight}
              >
                <div className="lp-feature-block__emoji">{f.emoji}</div>
                <h3 className="lp-feature-block__title">{f.title}</h3>
                <p className="lp-feature-block__desc">{f.desc}</p>
                <ul className="lp-feature-block__list">
                  {f.highlights.map((h) => (
                    <li key={h}>
                      <span className="lp-check">✓</span>
                      {h}
                    </li>
                  ))}
                </ul>
              </motion.div>

              <motion.div
                className="lp-feature-block__visual"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.25 }}
                variants={f.side === "left" ? slideFromRight : slideFromLeft}
              >
                {MOCKUP_MAP[f.mockup]}
              </motion.div>
            </div>
          ))}
        </div>
      </section>

      {/* ════════════════ FOOTER ══════════════════════════ */}
      <footer className="lp-footer">
        <div className="lp-footer__top">
          <div className="lp-footer__brand">
            <div className="lp-footer__logo">ClosetMate</div>
            <p className="lp-footer__tagline">Your AI-powered wardrobe companion.</p>
          </div>
          <div className="lp-footer__nav">
            <div className="lp-footer__col">
              <h4>✦ Explore</h4>
              <span className="lp-footer__sep">|</span>
              <button className="lp-footer__link" onClick={() => navigate("/wardrobe")}>Wardrobe</button>
              <button className="lp-footer__link" onClick={() => navigate("/outfits")}>Outfits</button>
              <button className="lp-footer__link" onClick={() => navigate("/community")}>Community</button>
            </div>
          </div>
        </div>
        <div className="lp-footer__bottom">
          <span>© 2026 ClosetMate.</span>
        </div>
      </footer>

    </main>
  );
};

export default Home;

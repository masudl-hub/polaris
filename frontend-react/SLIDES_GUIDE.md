# Polaris Slide Deck — Test Version

**This is a test version put together as a starting point — not the final deck. Everything here is open to feedback, revision, and being thrown out entirely if the team wants to go a different direction.**

**MSIS 521 Final Project | Team 8 | 15 minutes total (~9 min slides, ~5 min demo)**

Access: `http://localhost:5178/#slides`
Navigation: Arrow keys, Space (forward), F (fullscreen), Escape (exit to app)

---

## PROPOSED Presenter Assignments

| Person | Slides | ~Time | Section |
|--------|--------|-------|---------|
| **Person 1** | S1, S2, S3 | 2:15 | Opening — Context & Audience |
| **Person 2** | S4, S5 | 2:15 | Product — Solution & Architecture |
| **Person 3** | S6, S7 | 2:00 | Technical — Models & Data |
| **Person 4** | S8, S9 | 1:45 | Rigor — Validation & Evolution |
| **Person 5** | S10, S11 + Demo | 6:45 | Demo — Live walkthrough & Close |

---

## Slide-by-Slide Breakdown

### S1 — Title (Person 1)

**Visual:** Cinematic intro animation. The "P" drops in from above with spring physics, glow pulse, and shadow. "OLARIS" slides in from the right with a blur-to-sharp reveal. Radial gold glow blooms behind the logo. Team names stagger in at the bottom.

**On screen:** POLARIS logo, "Ad & Post Performance Analysis Platform", "MSIS 521 — Final Project", Team 8, five member names.

**POTENTIAL narrative:** *"We're Team 8, and today we're presenting Polaris — a platform we built to solve a problem that costs advertisers hundreds of billions of dollars a year."*

---

### S2 — Problem (Person 1)

**Visual:** Three large gold stat numbers ($740B, ~26%, 0) with icons above each, animated count-up feel. Three pain-point cards below with icons.

**On screen:**
- $740B global digital ad spend (2025)
- ~26% wasted on poor creative
- 0 pre-flight tools exist
- Cards: No pre-testing / Platform blind spots / Post-hoc only

**POTENTIAL narrative:** *"Digital advertising is a $740 billion market, and roughly a quarter of that is wasted on underperforming creative. The problem isn't that advertisers don't care — it's that there are zero tools to evaluate an ad before it goes live. You launch, you spend, and only then do you find out it didn't work."*

---

### S3 — Personas (Person 1)

**Visual:** Three cards, each with an icon, role title, a large gold stat number ($500, 20+, 3-5x) as the visual anchor, a pain point, and a gold action line at the bottom.

**On screen:**
- SMB Marketer — $500/day budget, one shot to get it right → "Score before publishing"
- Media Buyer — 20+ accounts, needs fast quality checks → "Compare options instantly"
- Social Manager — 3-5x/week posts, wants optimal timing → "Predict before posting"

**POTENTIAL narrative:** *"We identified three core users. The SMB marketer with a tight daily budget who can't afford to waste a single campaign. The media buyer juggling 20+ client accounts who needs to make fast calls. And the social media manager posting multiple times a week who wants to know if their hook will land before they hit publish."*

---

### S4 — Solution (Person 2)

**Visual:** Three miniature app mockups (Compose → Analyze → Results) connected by chevron arrows, showing the actual user journey. Below, six platform pills with real SVG icons (Meta, Google, TikTok, X, LinkedIn, Snapchat).

**On screen:** Mockups show upload zone, text fields, platform selection, streaming step counter, results dashboard with QS, eCPC, sentiment, trend chart, and entity tags.

**POTENTIAL narrative:** *"Polaris is a three-step workflow. You compose your ad — upload the creative, write the copy, pick your platform. The system analyzes it through a 13-step ML pipeline, streaming results in real time. And you get a full results dashboard: quality score, estimated CPC, sentiment breakdown, trend data, and actionable suggestions — all before spending a dollar."*

---

### S5 — Architecture (Person 2)

**Visual:** Animated pipeline diagram. Three parallel input tracks (Semantic/gold, Visual/purple, Forecast/green) each with 3 pipeline nodes. Convergence arrow leads to a second row: Scoring (4 nodes, green) → Intelligence (4 nodes, purple) → Synthesis (1 node, gold). Flowing dot animations on connector lines. Below, an SSE streaming visualization showing data packets flowing from Server to Client with event labels.

**On screen:** 13 pipeline nodes organized by function, SSE event stream with labels (text_data → NER + Sentiment, vision_data → Image Analysis, etc.)

**POTENTIAL narrative:** *"Under the hood, the pipeline has three parallel input tracks — semantic analysis, visual analysis, and trend forecasting. These converge into scoring, intelligence, and synthesis layers. The whole thing streams results to the browser via Server-Sent Events, so you see each step complete in real time — typically under 30 seconds total."*

---

### S6 — ML Models (Person 3)

**Visual:** Four grouped columns, color-coded to match the pipeline tracks from S5. NLP group (gold): spaCy, RoBERTa, GloVe. Vision (purple): Gemini Vision. Intelligence (green): MiniLM-L6, HistGBR. Synthesis (orange): Gemini Flash. Below, the QS formula visualization showing Sentiment (0.35) + Trend (0.30) + Visual (0.35) → 1-10 score → eCPC.

**On screen:** 7 model cards grouped by function, QS formula equation with color-coded components.

**POTENTIAL narrative:** *"We use seven purpose-built models, each chosen for a specific task. The NLP trio handles entity extraction, sentiment, and hashtag expansion. Gemini Vision analyzes the creative itself. MiniLM handles audience matching, HistGBR predicts LinkedIn engagement, and Gemini Flash writes the diagnostic summary — but only the prose. Every number you see is computed by deterministic, traditional ML."*

---

### S7 — Data Sources (Person 3)

**Visual:** Six data source cards in a 3x2 grid. Each has a colored icon, source name, stat badge, and a mini data preview visualization:
- Google Trends: SVG line chart with gradient fill, data points, time axis
- IAB Taxonomy: Hierarchical drill-down bars (Tier 1 → Technology → Consumer Electronics → Smartphones) + category tags
- Reddit API: Subreddit sentiment rows (r/marketing, r/advertising, r/socialmedia) with score bars + mini histogram
- Meta Ad Library: Competitor intelligence rows (ad counts, spend, format) + creative thumbnail grid
- Benchmarks DB: 5x6 heatmap matrix (CPC/CTR/CVR/CPM/CPA across 6 platforms) with intensity coding
- Published Research: Five study rows with source names and key findings

**On screen:** Title: "Grounded in 6 live data sources and 1,558 IAB taxonomy segments"

**POTENTIAL narrative:** *"Everything Polaris outputs is grounded in real data. We pull 90-day trend series from Google, map content to 1,558 IAB taxonomy segments for audience matching, scrape live Reddit sentiment, pull competitor intelligence from Meta's Ad Library, benchmark against a 10-by-6 industry matrix, and validate against 10 published research studies."*

---

### S8 — Validation (Person 4)

**Visual:** Four proof panels in a 2x2 grid, each with animated data visualizations:
- QS Gauges: Three semicircle SVG gauges (green 8.7 / amber 5.2 / red 2.1) showing QS responds correctly to positive, neutral, and negative inputs
- CPC Bars: Four platform bars (LinkedIn, Google, Meta, TikTok) with industry benchmark markers — our multipliers match WordStream data
- LinkedIn CompBars: Side-by-side comparison bars (Polaris vs Social Insider) for Carousel/Video/Text engagement rates — exact match
- Sentiment Tests: Three test cases with input text, animated score bars, and color-coded labels (Positive 0.92 / Neutral 0.51 / Negative 0.08)

**On screen:** Title: "Validated against industry benchmarks and known-good inputs"

**POTENTIAL narrative:** *"We validated every output against industry data. The quality score correctly differentiates good from bad inputs — an 8.7 for positive trending content, a 2.1 for negative dying content. Our CPC multipliers match WordStream's published benchmarks within 5%. Our LinkedIn engagement predictions exactly match Social Insider's published rates. And our sentiment model correctly classifies positive, neutral, and negative ad copy."*

---

### S9 — Evolution (Person 4)

**Visual:** Six upgrade cards in a 3x2 grid. Each has a colored icon, component name, strikethrough "before" text → colored "after" text, and a highlighted detail badge.

**On screen:**
- Vision: ~~EfficientNetB0~~ → Gemini Vision (30+ prompts)
- LLM: ~~GPT-4o-mini~~ → Gemini Flash (Deterministic-first)
- Frontend: ~~Streamlit~~ → React + Framer (Full SPA)
- Streaming: ~~Single response~~ → SSE (13 live events)
- Pipeline: ~~4 steps~~ → 13 steps (3.25x deeper)
- Audience: ~~Hardcoded~~ → IAB + Transformers (1,558 segments)

**POTENTIAL narrative:** *"We diverged significantly from our original proposal — and every change made the platform stronger. We replaced EfficientNet with Gemini Vision for richer image understanding. We swapped Streamlit for a full React SPA. We went from a single API response to real-time SSE streaming. And we expanded the pipeline from 4 steps to 13. The thesis stayed the same — pre-deployment evaluation — but the execution went far beyond what we initially scoped."*

---

### S10 — Demo Transition (Person 5)

**Visual:** Cinematic layout with radial gold glow, "Live Demo" label, large title, and two scenario cards with platform pills.

**On screen:**
- Scenario 1: Ad Evaluation — upload creative + copy, full streaming pipeline (Meta, Google, TikTok)
- Scenario 2: LinkedIn Post — engagement prediction + timing heatmap (LinkedIn, Timing, Predict)

**POTENTIAL narrative:** *"Let's see it live. We'll walk through two scenarios — first, a full ad evaluation on Meta showing the complete 13-step pipeline. Then a LinkedIn post analysis showing our engagement predictions and timing heatmap."*

---

### S11 — Impact & Q&A (Person 5, post-demo)

**Visual:** Three large pillars (Evaluate, Predict, Act) with big gold icons, a divider, team name, member names, and "Questions?" Large radial glow behind.

**On screen:**
- EVALUATE: 7 models score every dimension before deployment
- PREDICT: CPC, engagement, and trend timing in real-time
- ACT: Suggestions grounded in benchmarks and market data

**POTENTIAL narrative:** *"Polaris turns guesswork into data. It evaluates creative across every dimension before you spend. It predicts performance using real market signals. And it gives you actionable next steps grounded in industry benchmarks. Thank you — we'd love to take your questions."*

---

## Rubric Coverage

| Criteria (25% each) | Where it's covered |
|---|---|
| **Topic & Scope** | S2 (problem + market size), S3 (user personas), S9 (evolution from proposal) |
| **Impact & Relevance** | S2 ($740B market, 26% waste), S7 (real data sources), S11 (evaluate/predict/act) |
| **Technical & AI** | S5 (13-step pipeline), S6 (7 ML models + QS formula), S7 (6 data sources), S8 (validation) |
| **Presentation Quality** | Cinematic animations, visual-first design, live demo, consulting-style action titles |

---

## Technical Notes

- Built as a React component (`src/components/Slides.jsx`) using Framer Motion
- Accessed via hash routing (`/#slides`) — no router library needed
- Keyboard: Arrow keys navigate, Space advances, F toggles fullscreen, Escape exits
- Click: Left third of screen = back, right two-thirds = forward
- Dot indicators at bottom show position, clickable for direct navigation
- All animations use spring physics and staggered reveals
- Platform SVGs sourced from the actual Compose.jsx component

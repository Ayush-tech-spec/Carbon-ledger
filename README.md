# Carbon Ledger

**Hack2Skill Challenge 3: Carbon Footprint Awareness Platform**

A personal carbon accounting app built on the double-entry bookkeeping metaphor. Every emission is a debit, every offset is a credit, and your net CO2 balance is what you owe the atmosphere. Includes a WebAR feature to visualize your footprint as 3D objects in the real world.

---

## Live Demo

Deploy to Netlify (instructions below) and paste the URL in your submission.

---

## Features

- Double-entry ledger for logging emissions and offsets
- AI insights after every entry (Claude or Grok, switchable)
- Category breakdown with bar charts
- 6-month history grid
- India-specific benchmarks vs global average and Paris Agreement target
- Personalised reduction action cards with estimated annual savings
- AI planner for free-text carbon reduction questions
- **WebAR visualizer**: point your phone camera at a surface to see your footprint as 3D columns
- **3D fallback**: drag-to-rotate orbit view for devices without WebXR
- Dark mode support
- Fully accessible (ARIA labels, keyboard nav, reduced-motion)
- localStorage persistence

---

## Project Structure

```
carbon-ledger/
├── index.html          # Main ledger app
├── ar.html             # WebAR / 3D visualizer
├── css/
│   └── styles.css      # All styles (responsive, dark mode, a11y)
├── js/
│   ├── config.js       # Emission factors, categories, AI endpoints (frozen)
│   ├── store.js        # Data layer: in-memory + localStorage
│   ├── ai.js           # AI abstraction: Claude + Grok
│   ├── journal.js      # Entry posting, table render, XSS-safe deletion
│   ├── analysis.js     # Category bars, monthly grid, benchmark
│   ├── actions.js      # Reduction cards + AI planner
│   ├── settings.js     # API key management (sessionStorage only), data reset
│   ├── ui.js           # Tab switching, totals banner, model badge
│   └── app.js          # Bootstrap entry point
└── tests/
    ├── index.html      # Browser test runner (open this to run all tests)
    ├── runner.js       # Zero-dependency test framework
    ├── config.test.js  # CONFIG constants: completeness, ranges, types
    ├── store.test.js   # Store: add, remove, totals, persistence
    ├── emission.test.js# Emission calculations vs real-world values
    └── utils.test.js   # XSS escaping, input validation, security
```

---

## Running the Tests

Open `tests/index.html` in any browser. No build step, no Node, no npm. All tests run in-browser and report pass/fail instantly.

You should see 60+ passing tests across 4 suites.

---

## Setup

### Local

```bash
git clone https://github.com/YOUR_USERNAME/carbon-ledger.git
cd carbon-ledger
# Just open index.html in a browser. No build step needed.
```

### API Keys

Go to the **Settings** tab in the app and paste your keys:

- Claude: get one at https://console.anthropic.com
- Grok: get one at https://console.x.ai

Keys are stored in `sessionStorage` only (cleared on tab close). They never touch a server.

---

## Deploy on Netlify (5 minutes)

1. Push this folder to a public GitHub repo
2. Go to https://netlify.com and sign up with GitHub
3. Click **Add new site > Import an existing project**
4. Pick your repo
5. Set **Publish directory** to `/` (leave blank or type `/`)
6. Click **Deploy site**
7. Netlify gives you a URL like `https://carbon-ledger-xyz.netlify.app`

That URL goes in your submission form.

---

## WebAR Feature

The `ar.html` page uses the WebXR Device API with hit-test to place 3D carbon emission columns on real surfaces detected by your phone camera.

- Each emission category (transport, food, energy, shopping) renders as a colored 3D cylinder, height proportional to kg CO2
- Your net balance renders as a sphere with particle cloud
- On devices without WebXR, falls back to a drag-to-rotate 3D orbit view using Three.js
- Works on Android Chrome with ARCore; iOS Safari support pending WebXR rollout

---

## Emission Factors

| Activity | Factor | Source |
|---|---|---|
| Car journey | 0.21 kg CO2/km | DEFRA 2023 |
| Domestic flight | 255 kg CO2/flight | IPCC AR6 |
| Meat meal | 6.0 kg CO2/meal | Our World in Data |
| Vegetarian meal | 1.8 kg CO2/meal | Our World in Data |
| Electricity (India) | 0.82 kg CO2/kWh | CEA India 2022-23 |
| LPG gas | 2.04 kg CO2/kg | IPCC |
| Online order | 3.2 kg CO2/order | MIT logistics study |
| Tree planted | -21.7 kg CO2/yr | IPCC avg sequestration |
| Public transit trip | -0.89 kg CO2/trip | vs avg 10km car trip |
| Solar energy | -0.82 kg CO2/kWh | displaces India grid |

---

## Tech Stack

- Vanilla HTML, CSS, JavaScript (no framework, no build tool)
- Three.js r128 (via CDN) for 3D and AR rendering
- WebXR Device API for augmented reality
- Anthropic Claude API + xAI Grok API for AI insights
- Fonts: Courier Prime + Inter via Google Fonts

---

## License

MIT

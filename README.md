# Carbon Ledger

**Hack2Skill Challenge 3: Carbon Footprint Awareness Platform**

A personal carbon accounting app built on the double-entry bookkeeping concept. Every emission is a debit, every offset is a credit, and your net CO2 balance is what you owe the atmosphere.

The AR feature lets you point your phone camera at any real-world object and get its carbon footprint instantly, powered by Gemini Vision AI.

**Live demo:** https://fancy-cannoli-d8257b.netlify.app
**GitHub:** https://github.com/Ayush-tech-spec/Carbon-ledger

---

## What it does

**Ledger (main app):**
- Log emissions and offsets using a double-entry ledger system
- AI insights after every entry (Claude or Groq/Llama3)
- Category breakdown with bar charts
- 6-month history grid
- India-specific benchmarks vs the Paris Agreement target
- Personalised reduction action cards with estimated annual savings
- AI planner for free-text carbon questions
- Dark and light mode
- localStorage persistence

**AR and 3D (ar.html):**
- Scan any object with your camera: Gemini Vision identifies it and tells you its CO2 impact and what to swap it for
- 3D carbon footprint overlay on your camera feed (works on iPhone and desktop Chrome)
- Full WebXR AR mode on Android Chrome with ARCore
- Drag-to-rotate 3D view with no camera required as a fallback

---

## Project structure

```
carbon-ledger/
├── index.html            main ledger app
├── ar.html               AR scanner and 3D visualiser
├── _headers              Netlify headers for camera permissions
├── css/
│   └── styles.css
├── js/
│   ├── config.js         emission factors, categories, AI config (frozen)
│   ├── store.js          data layer with localStorage
│   ├── ai.js             Claude + Groq proxy calls
│   ├── journal.js        entry posting, table rendering, XSS escaping
│   ├── analysis.js       category bars, monthly grid, benchmark
│   ├── actions.js        reduction cards and AI planner
│   ├── settings.js       data management
│   ├── ui.js             tab switching, totals, theme toggle
│   └── app.js            bootstrap entry point
├── backend/
│   ├── server.js         Express proxy: Claude, Groq, Gemini Vision
│   ├── package.json
│   ├── .env.example      template for environment variables
│   └── .gitignore        keeps .env out of git
├── tests/
│   ├── index.html        browser test runner
│   ├── runner.js         zero-dependency test framework
│   ├── config.test.js    emission factor validation
│   ├── store.test.js     data layer tests
│   ├── emission.test.js  calculation accuracy vs IPCC values
│   └── utils.test.js     XSS, input validation, security
└── README.md
```

---

## Running the tests

Open `tests/index.html` in any browser. No build step, no Node needed. You should see 60+ tests pass across 4 suites covering emission calculations, store persistence, XSS escaping, and input validation.

---

## Setup

**Local dev:**
```bash
git clone https://github.com/Ayush-tech-spec/Carbon-ledger.git
cd Carbon-ledger
# Open index.html in a browser via Live Server or any local server
```

**Backend locally:**
```bash
cd backend
cp .env.example .env
# Fill in your keys in .env
npm install
node server.js
```

---

## API keys you need

| Key | Where to get it | Cost |
|-----|----------------|------|
| `CLAUDE_API_KEY` | console.anthropic.com | $5 free credit |
| `GROK_API_KEY` | console.groq.com | Free |
| `GEMINI_API_KEY` | aistudio.google.com | Free (1500 req/day) |

---

## Deploy

**Frontend on Netlify:**
1. Connect your GitHub repo at netlify.com
2. Publish directory: `/` (leave blank)
3. Build command: leave blank
4. Deploy

The `_headers` file automatically tells Netlify to send the right `Permissions-Policy` headers so Chrome and Safari allow camera access on the AR page.

**Backend on Render:**
1. Connect the same GitHub repo at render.com
2. Root directory: `backend`
3. Build command: `npm install`
4. Start command: `node server.js`
5. Add environment variables:

```
CLAUDE_API_KEY   = sk-ant-...
GROK_API_KEY     = gsk_...
GEMINI_API_KEY   = AIza...
FRONTEND_URL     = https://your-site.netlify.app
NODE_ENV         = production
```

---

## How the AR scanner works

1. User taps "Scan Objects with AI" and allows camera access
2. They point the camera at any object (burger, car, plastic bottle, AC unit, etc.)
3. They tap the scan button
4. The app captures a frame and sends it to `/api/vision` on the backend
5. The backend sends it to Gemini 1.5 Flash Vision API (free)
6. Gemini identifies the object and returns: name, CO2 level (high/medium/low), impact description, and a specific swap tip
7. The result card slides up on screen with colour-coded CO2 badge

Works on Android Chrome, iPhone Safari, and desktop Chrome. No special hardware needed.

---

## Emission factors

| Activity | Factor | Source |
|----------|--------|--------|
| Car journey | 0.21 kg CO2/km | DEFRA 2023 |
| Domestic flight | 255 kg CO2/flight | IPCC AR6 |
| Meat meal | 6.0 kg CO2/meal | Poore & Nemecek 2018 |
| Vegetarian meal | 1.8 kg CO2/meal | Poore & Nemecek 2018 |
| Electricity (India) | 0.82 kg CO2/kWh | CEA India 2022-23 |
| LPG gas | 2.04 kg CO2/kg | IPCC AR6 |
| Online order | 3.2 kg CO2/order | MIT logistics study |
| Tree planted | -21.7 kg CO2/yr | IPCC AR6 average |
| Public transit trip | -0.89 kg CO2/trip | vs avg 10km car trip |
| Solar energy | -0.82 kg CO2/kWh | displaces India grid |

---

## Tech stack

- Vanilla HTML, CSS, JavaScript (no framework, no build tool)
- Three.js r128 for 3D and WebXR rendering
- WebXR Device API for AR on Android
- getUserMedia for camera access on iOS and desktop
- Google Gemini 1.5 Flash Vision API for object recognition
- Anthropic Claude API + Groq API for AI insights
- Node.js + Express backend proxy on Render
- Hosted on Netlify (frontend) and Render (backend)

---

## License

MIT

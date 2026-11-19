<p align="center">
  <img src="https://img.shields.io/badge/Status-Live-brightgreen?style=for-the-badge" alt="Status: Live" />
  <img src="https://img.shields.io/badge/Zero%20Build-Vanilla%20JS-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="Zero Build" />
  <img src="https://img.shields.io/badge/Map-Leaflet%201.9-199900?style=for-the-badge&logo=leaflet&logoColor=white" alt="Leaflet" />
  <img src="https://img.shields.io/badge/Data-OpenStreetMap-7EBC6F?style=for-the-badge&logo=openstreetmap&logoColor=white" alt="OSM" />
  <img src="https://img.shields.io/badge/Deploy-Vercel-000?style=for-the-badge&logo=vercel&logoColor=white" alt="Vercel" />
</p>

# 🚦 Traffic Command Centre

### 🔗 [**Live Demo → traffic-sim-xi.vercel.app**](https://traffic-sim-xi.vercel.app)

> **A real-time traffic simulation and emergency response system built on real OpenStreetMap road networks. Zero build step, zero API keys, runs entirely in the browser.**

An interactive, browser-based traffic simulation platform that loads **real road geometry** from OpenStreetMap, simulates hundreds of vehicles with congestion-aware routing (Dijkstra / A*), supports live road closures with automatic rerouting, load-balanced traffic distribution, and a full **emergency vehicle dispatch system** with priority corridors — wrapped in an **Apple Maps × Pinterest card board** frosted glass UI with light/dark theme support.

---

## ✨ Features

### 🗺️ Real-World Road Networks
- Loads **actual road geometry** from OpenStreetMap via the Overpass API
- Supports 4 scale levels: **Neighbourhood** (1.5 km), **District** (3 km), **City** (6 km), **Region** (30 km)
- Centered on **Bangalore** with geolocation support — pan the map and load roads anywhere in the city
- Offline fallback: import Overpass JSON files directly
- Road data cached in IndexedDB for instant repeat loads

### 🚗 Traffic Simulation Engine
- Simulates **up to 1,500 vehicles** with realistic movement along road polylines
- Vehicles rendered as emoji icons (🚗 🚕 🚙 🛺 🏍️ 🛵 🚌 🚚) on a high-performance `<canvas>` layer
- **Seeded RNG** — simulations are deterministic and reproducible
- Fixed-timestep simulation loop with adjustable speed (1× / 2× / 5× / 10×)
- Vehicles that arrive are respawned to maintain traffic density

### 🧠 Smart Routing & Congestion
- **Dijkstra** and **A\*** pathfinding with a shared min-heap implementation
- **BPR-style congestion model:** `cost = length/speed × (1 + 0.6 × (V/C)³ + 0.5 × cellDensity)`
- **Load balancing:** sequential assignment where each routed vehicle's load updates the cost for the next
- **Auto jam rerouting:** periodically detects congested roads and reroutes upcoming traffic (only if the alternative is >10% cheaper)
- Side-by-side **A\* vs Dijkstra comparison** with expanded-node counts and timing

### 🚧 Road Closures & Rerouting
- Close any road by name or by clicking on the map
- Instant rerouting of all affected vehicles using load-balanced assignment
- Visual indicators: red dashed lines for closed roads, white glow for roads receiving diverted traffic
- Reopen roads and watch stranded vehicles recover
- **What-if experiments:** compare load balancing ON vs OFF on the same pre-closure snapshot

### 🚨 Emergency Vehicle System
- Dispatch **Ambulance** 🚑, **Police Car** 🚓, or **Fire Truck** 🚒
- Units use a **priority cost model** (1.4× road speed, weak congestion penalty)
- **Dynamic re-planning** every 3 seconds from the next junction
- **Priority corridor:** civilians within 300m ahead pull over (yellow ring); civilians about to enter the unit's 500m corridor are diverted with a 6× cost penalty
- Pick incident locations on the map or dispatch to random points
- Full event log with dispatch, redirect, and arrival timestamps
- Statistics: average trip time vs normal-traffic estimate

### 📊 Real-Time Analytics Dashboard
- **Masonry card board** layout with live telemetry cards
- **Peak V/C saturation** card with progress bar and status badge
- Sparkline charts for average speed and congested corridor counts
- **Hottest grid cells** ranked by density score with heatmap badges
- Reroute distribution breakdown with per-route vehicle counts and costs
- Vehicle inspection: click any road, vehicle, or grid cell for route visualization with origin/destination markers

### 🎨 Apple Maps × Pinterest Glass UI
- **Frosted glass** design with `backdrop-filter: blur(28px) saturate(190%)` and hairline borders
- **Light and Dark theme** toggle — crisp daylight mode and deep midnight mode
- **Floating transport dock** (bottom-centre pill) with playback controls and segmented speed selector
- **Glass circle button stack** (top-right): zoom, location, layers, fit, theme toggle
- **Expandable legend pill** (bottom-left) with scale badge, congestion gradient, and emoji fleet roster
- **Event log strip** with real-time timestamped notifications
- Apple system palette: `#0A84FF` accent, `#34C759` free, `#FFD60A` busy, `#FF9F0A` heavy, `#FF3B30` jam
- Inter + JetBrains Mono typography with tabular numbers
- Three map modes: Street map, Heatmap, Schematic (no tiles)
- Collapsible side panels with masonry board analytics
- Responsive layout with mobile support

---

## 🚀 Quick Start

### Run Locally

```bash
# Clone the repository
git clone https://github.com/rishikeshyadavv/Traffic-Command-Centre.git
cd Traffic-Command-Centre

# Start the dev server (Node.js 18+)
npm start
# → Open http://localhost:8080
```

Any static server works:
```bash
npx serve .
python3 -m http.server 8080
```

> [!NOTE]
> Opening `index.html` directly (double-click) won't work because ES modules require HTTP.

### Run Tests

```bash
npm test    # 18 engine unit tests (Node 18+ built-in test runner)
```

---

## 🌐 Deploy on Vercel

This is a **zero-build static site** — deploy directly with no framework configuration.

### One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Frishikeshyadavv%2FTraffic-Command-Centre)

### Manual Deploy via CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy (from the project root)
vercel

# Deploy to production
vercel --prod
```

A `vercel.json` is included with the correct static-site configuration.

---

## 🎮 How to Use

### 1. Load a Road Network
- The app auto-loads **real OSM roads** around central Bangalore on startup
- Change the **Area** scale (Neighbourhood → Region) in the left panel's Map tab
- Click the **⌖** button (top-right) to center on your GPS position (Bangalore area)
- Or **import** a saved Overpass JSON file for offline use

### 2. Run the Simulation
- Use the **floating transport dock** (bottom-centre) — click **Start**, adjust speed with the segmented control (1×–10×)
- Set vehicle count (10–1500) in the **Simulate** tab (left panel)
- Click **Run demo** for a guided scenario: traffic builds up, then busy roads close automatically

### 3. Create Road Closures
- Switch to the **Closures** tab in the left panel
- Select a road from the dropdown or **click any road on the map**
- Choose a reason (construction / accident / manual test) and close it
- Watch vehicles get rerouted in real time with white glow on alternative roads

### 4. Dispatch Emergency Vehicles
- Click **Dispatch Emergency** on the transport dock, or switch to the **Emergency** tab
- Select a unit type and click **Dispatch** (random) or **Pick incident location** (click map)
- Or hit **Run emergency demo** — dispatches all three units, then closes a road ahead at 5s
- Toggle **"Clear the way"** to enable/disable priority corridors

### 5. Analyze & Compare
- The right **Analytics & Board** panel shows masonry telemetry cards with live stats
- Monitor **Peak V/C**, sparklines, and hotspot rankings
- Switch to **Compare** tab and click **Compare load balancing ON vs OFF** for a headless what-if experiment
- Use **A\* vs Dijkstra** comparison mode to see expanded-node counts

---

## 🏗️ Architecture

```
traffic-sim/
├── index.html              # Single-page app entry (Apple Maps glass layout)
├── style.css               # Apple Maps × Pinterest frosted glass stylesheet
│                             (~1200 lines, light/dark themes, responsive)
├── serve.mjs               # Minimal Node.js static server (dev)
├── vercel.json             # Vercel deployment configuration
├── package.json            # Scripts: start, test
│
├── src/
│   ├── app.js              # Leaflet UI, canvas rendering, event wiring,
│   │                         transport dock, theme toggle, event strip
│   ├── data/
│   │   └── osm.js          # Overpass API client, road parser, IndexedDB cache
│   │                         Hedged requests to 4 endpoints for reliability
│   └── engine/
│       ├── graph.js         # Road graph builder (nodes = junctions, edges = segments)
│       ├── routing.js       # Dijkstra & A* with binary min-heap, shared search
│       ├── edgeCost.js      # BPR congestion model + emergency vehicle cost model
│       ├── assignment.js    # Load-balanced sequential route assignment
│       ├── grid.js          # Spatial density grid (edge → cell by midpoint)
│       ├── sim.js           # Core simulation: tick, spawn, closures, experiments,
│       │                      emergency dispatch, corridor clearing, re-planning
│       └── util.js          # Haversine distance + seeded PRNG
│
├── design/                  # Design reference screens (Stitch-generated)
│   ├── main_light.html/png  # Light theme mockup
│   ├── main_dark.html/png   # Dark theme mockup
│   └── compare_light.html/png # Compare panel mockup
│
└── tests/
    └── engine.test.mjs     # 18 unit tests for the simulation engine
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Zero build** (no bundler, no TypeScript) | Instant dev reload, deployable anywhere as static files |
| **Sim state is plain data** (`structuredClone`-able) | Enables headless what-if experiments on cloned snapshots |
| **Canvas rendering** (not SVG/DOM) | Handles 1,500+ vehicles at 60fps without DOM thrashing |
| **Seeded PRNG** | Deterministic, reproducible runs for fair A/B comparisons |
| **Hedged Overpass requests** | First server fires immediately; backups start at 4s/8s/12s intervals — first success wins |
| **UI ↔ Engine separation** | `app.js` handles rendering; all simulation logic in `engine/` |
| **Light/Dark theme** | Manual toggle via CSS custom properties, no flicker |
| **Frosted glass surfaces** | `backdrop-filter: blur() saturate()` for depth over the live map |

---

## 🔬 Technical Deep Dive

### Routing Algorithms

Both **Dijkstra** and **A\*** share a single search function with a binary min-heap:
- **Dijkstra:** `h(n) = 0` — optimal, explores more nodes
- **A\*:** `h(n) = haversine(n, goal) / maxNetworkSpeed` — admissible & consistent heuristic
- **Emergency A\*:** divides heuristic by `EM.boost` (1.4) to stay admissible for faster units

### Congestion Model (BPR-Style)

```
edgeCost = (length / speed) × (1 + 0.6 × min(V/C, 3)³ + 0.5 × cellDensityScore)
```

Where:
- `V` = current vehicles on edge + predicted load from planned routes
- `C` = edge capacity (derived from road length and lane count)
- `cellDensityScore` = normalized vehicle density in the spatial grid cell (0–1)

### Load Balancing

Vehicles are sorted by remaining trip length (longest first). In **balanced mode**, each assigned route immediately updates predicted loads so the next vehicle sees updated costs. In **unbalanced mode**, all vehicles price against a frozen snapshot — everyone picks the same "cheapest" route.

### Emergency Vehicle Priority

| Mechanism | Range | Effect |
|-----------|-------|--------|
| **Pull over** | 300m ahead, same direction | Civilians stop (speed = 0), yellow ring indicator |
| **Divert** | 500m corridor, next 4 roads | Load-balanced rerouting with 6× cost penalty on corridor roads |
| **Re-plan** | Every 3s | Switch route if >12% faster or if blocked |

---

## ⚡ Performance

- **Vehicle rendering:** single `<canvas>` layer, not individual DOM/SVG nodes
- **Heatmap:** kernel-density render on a separate canvas, only repaints when running or view changes
- **Road rendering:** Leaflet canvas renderer; click-picking via nearest-segment search (not interactive polylines)
- **Shape point thinning:** points < 6m apart are dropped at import
- **Road color updates:** throttled to every 600ms
- **Tick budget:** predicted-load rebuild runs every 4s (not every tick); simulation loop capped at 12ms/frame
- **Overpass caching:** IndexedDB + in-memory Map for instant repeat loads

---

## 🧪 Testing

```bash
npm test
```

Runs **18 unit tests** using Node.js built-in test runner (`node --test`), covering:
- Graph construction from OSM data
- Dijkstra and A* pathfinding correctness
- Cost function calculations
- Simulation creation, tick stepping, and vehicle spawning
- Road closure and rerouting logic
- Emergency vehicle dispatch and re-planning
- Load balancing behavior
- Grid density scoring

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Vanilla JavaScript (ES Modules), HTML5, CSS3 |
| **Map** | [Leaflet 1.9.4](https://leafletjs.com/) with Canvas renderer |
| **Tiles** | [OpenStreetMap](https://www.openstreetmap.org/) standard tiles |
| **Road Data** | [Overpass API](https://overpass-api.de/) (real OSM geometry) |
| **Typography** | [Inter](https://fonts.google.com/specimen/Inter) + [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono) |
| **Rendering** | HTML5 Canvas (vehicles, heatmap), CSS Frosted Glass |
| **Server** | Minimal Node.js static server (`serve.mjs`) |
| **Testing** | Node.js built-in test runner |
| **Deployment** | [Vercel](https://vercel.com/) (zero-build static) |

---

## 📄 License

This project is open source. Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors.

---

<p align="center">
  Built with ❤️ by <a href="https://github.com/rishikeshyadavv">Rishikesh Yadav</a>
</p>

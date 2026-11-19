# Stitch Design Project: Traffic Command Centre

**Project Name:** Traffic Command Centre  
**Project ID:** `projects/6405253363685461463` (ID: `6405253363685461463`)  
**Design Aesthetic:** "Apple Maps meets a Pinterest card board"
- Edge-to-edge Apple Maps canvas shell with floating frosted glass cards (`backdrop-filter: blur(20px) saturate(180%)`, hairline border, 16–22px border radii, soft drop shadows).
- Apple system palette (#0A84FF accent, #34C759 free, #FFD60A busy, #FF9F0A heavy, #FF3B30 jam/closure).
- San Francisco / Inter typography with tabular numbers.
- Rich emoji accents: 🚗 🚕 🚙 🛺 🏍️ 🛵 🚌 🚚 🚑 🚧 ⚠️ 🔁 🟢 🟡 🟠 🔴.

---

## Generated Screens

### 1. Main (light)
- **Screen ID:** `e311cce4625149a5a6994ee7b3339e36` (`projects/6405253363685461463/screens/e311cce4625149a5a6994ee7b3339e36`)
- **HTML File:** [main_light.html](file:///D:/dumpyard/BUG%20HUNT%20ISACA/trafficc-sim/traffic-sim/design/main_light.html)
- **Preview Image:** [main_light.png](file:///D:/dumpyard/BUG%20HUNT%20ISACA/trafficc-sim/traffic-sim/design/main_light.png)
- **Key Features:**
  - Full-bleed desaturated light map background.
  - Floating top-left card with title, segmented switcher (Map | Simulate | Closures), and search-styled area picker.
  - Top-right vertical glass circle stack: zoom (+/-), my location, layer switcher, fit network, theme toggle.
  - Right-hand Pinterest masonry card board: Peak V/C big number, Congested corridors with inline progress bars, average velocity sparkline, Apple Maps style reroute card with blue route & white casing, ETA pill and green saved-time chip.
  - Bottom-center floating glass transport pill with playback controls, speed segmented selector, and "🚀 Run demo" button.
  - Bottom-left expandable scale and emoji fleet legend.

---

### 2. Main (dark)
- **Screen ID:** `8c74c1a0cdac4ae48faf8709e98436ff` (`projects/6405253363685461463/screens/8c74c1a0cdac4ae48faf8709e98436ff`)
- **HTML File:** [main_dark.html](file:///D:/dumpyard/BUG%20HUNT%20ISACA/trafficc-sim/traffic-sim/design/main_dark.html)
- **Preview Image:** [main_dark.png](file:///D:/dumpyard/BUG%20HUNT%20ISACA/trafficc-sim/traffic-sim/design/main_dark.png)
- **Key Features:**
  - Deep midnight/slate map background with luminous neon glowing traffic corridors.
  - Dark frosted glass surfaces (`rgba(28,28,30,0.72)`) with hairline white borders (`rgba(255,255,255,0.12)`).
  - High contrast tabular metrics and typography (`#F5F5F7` text, `#98989D` muted).
  - Glowing corridor bars and neon red jam indicators.
  - One-line floating glass event log strip at bottom.

---

### 3. Compare (light)
- **Screen ID:** `c7bedc862c484860a2c0f1fcc4900280` (`projects/6405253363685461463/screens/c7bedc862c484860a2c0f1fcc4900280`)
- **HTML File:** [compare_light.html](file:///D:/dumpyard/BUG%20HUNT%20ISACA/trafficc-sim/traffic-sim/design/compare_light.html)
- **Preview Image:** [compare_light.png](file:///D:/dumpyard/BUG%20HUNT%20ISACA/trafficc-sim/traffic-sim/design/compare_light.png)
- **Key Features:**
  - Primary "Load balancing ON vs OFF" card with two columns:
    - Rows: Peak V/C, Overload edge-s, Avg trip s, Active Routes with green/red delta badges.
    - Amber warning notice banner: "⚠️ No alternative routes: balancing could not change the outcome".
  - Diverted traffic breakdown card and corridor impact matrix.
  - Floating playback pill and Apple Maps routing overlays.

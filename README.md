# PLEX — Power Load EXaminer

**A free, browser-based power load estimation tool for ICT and physical security systems.**

PLEX helps you size telecom room and equipment room infrastructure — power, UPS, generator, PoE budget, and cooling load — from a list of devices you actually plan to install. No account required. No data leaves your browser.

[![Live Tool](https://img.shields.io/badge/Live%20Tool-limitedenergy.net%2Fplex-red?style=flat-square)](https://limitedenergy.net/plex)
[![License: MIT](https://img.shields.io/badge/License-MIT-teal?style=flat-square)](LICENSE)
[![Version](https://img.shields.io/badge/Version-2.51-gray?style=flat-square)](site/plex.html)

---

## What It Does

- **Guided Design mode** — answer a few questions and PLEX builds a starting load list for you
- **Advanced Calculator** — add rack and wall devices from a curated preset library, or enter custom equipment
- **Power summary** — total watts, VA, BTU/hr, cooling tons, recommended breaker sizes, generator kW
- **PoE budget tracking** — per-switch port and wattage budget
- **UPS sizing** — runtime estimates per rack based on UPS capacity and load
- **Export** — save your project as a portable `.plex` file, reload it anytime, or print to PDF

Designed for Division 27/28 coordination — structured cabling, access control, video surveillance, intercom, and related ICT systems.

---

## Who Built This

Hi. I'm Shawn Tovey — a [BICSI RCDD](https://www.bicsi.org) (Registered Communications Distribution Designer) and ICT design consultant based in Texas. I built PLEX to solve a real problem: there's no lightweight, free tool for preliminary power load estimation in the limited energy space.

This is the **first version I've ever released publicly.** I'm not a professional software developer — I'm a systems designer who writes code. PLEX is a single HTML file with no build process, no framework, and no backend. It just works.

I built it with help from AI tools (Claude, primarily) and a lot of iteration on real project data.

---

## Honest Disclaimers

PLEX produces **preliminary estimates for coordination purposes only.**

- Values are based on typical nameplate wattages and standard assumptions — not measured loads
- Always verify against manufacturer datasheets before final design
- Final electrical design must be performed by a licensed electrical engineer (PE/EE)
- PLEX does not replace the Engineer of Record — it helps you get organized before you get there
- NEC 125% continuous load factor is applied to breaker and generator sizing — verify with your AHJ

---

## Self-Hosting

PLEX is a single file. Drop it anywhere.

```
site/
└── plex.html       ← this is the whole tool
```

To run locally, just open `plex.html` in a browser. No server required. No npm install. No build step.

To host it yourself, copy `plex.html` (and optionally `dude.png` and `dude-guide.png` for the assistant avatar) to any static host — Netlify, GitHub Pages, S3, whatever you have.

---

## Sample Files

| File | Description |
|---|---|
| `Sample-ER-TR-Security.plex` | Multi-rack ER/TR security closet example — 5 racks, 208V, NVRs, switches, servers |
| `Sample-Office-Limited-Energy.json` | Sample office building estimating file (for The Estimator tool) |
| `PLEX_Library_v2.32.xlsx` | Excel export of the PLEX device preset library |

Load `.plex` files directly into PLEX via the "Load Existing .plex File" button on the landing screen.

---

## Tech Stack

| | |
|---|---|
| Language | HTML5 / CSS3 / Vanilla JavaScript (ES6+) |
| Build | None — single file, no bundler, no transpiler |
| Dependencies | None — no npm, no CDN, no external calls |
| Storage | Browser `localStorage` + `.plex` file export/import |
| Hosting | Any static host |

---

## Feedback & Collaboration

This is my first public release of anything. I'd genuinely love to hear from you.

If something is wrong, confusing, or missing — open an issue. If you work in ICT design, physical security, or limited energy systems and want to contribute device presets, wattage corrections, or workflow improvements, I'm all for it.

I'm not precious about this. If you have a better way to do something, show me.

**Ways to connect:**
- GitHub Issues — bug reports, feature ideas, preset corrections
- [limitedenergy.net](https://limitedenergy.net) — contact form
- LinkedIn — [Shawn C. Tovey, RCDD](https://www.linkedin.com/in/shawntovey)

---

## License

MIT — free to use, modify, and distribute with credit.

```
Copyright (c) 2026 Shawn C. Tovey, RCDD — Limited Energy eXperts
```

See [LICENSE](LICENSE) for full text.

---

*Built with care for the people doing real work in the field.*
*Limited Energy eXperts · [limitedenergy.net](https://limitedenergy.net)*

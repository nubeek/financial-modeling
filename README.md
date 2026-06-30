# Wefranch — Financial Modeling Landing Page

Static marketing site for Wefranch’s compliant franchise financial modeling product. The main page introduces prospective franchisees to the problem, solution, and interactive modeling experience. A separate models demo page shows the summary income statement table used in the product UI.

## Pages

| Path | Description |
|------|-------------|
| `index.html` | Primary landing page — hero, problem, and solution sections |
| `models/index.html` | Standalone summary income statement table (Year 1–4) with table switcher |

## Project structure

```
.
├── index.html              # Landing page
├── styles/
│   └── styles.css          # Landing page styles
├── scripts/
│   ├── page-load.js        # Intro reveal animations on load
│   ├── carousel.js         # Hero carousel auto-scroll
│   ├── summary-card.js     # Animated financial metrics in the hero card
│   ├── problem-papers.js   # Problem-section paper spread animation
│   ├── solution-features.js # Solution showcase accordion and screenshot modal
│   └── split-text.js       # Shared split-text animation utilities
├── models/
│   ├── index.html          # Income statement table demo
│   ├── styles.css
│   └── summary-income-statement.js  # Year 1–4 metric data (shared with landing page)
└── assets/
    └── favicon/            # Icons and web app manifest
```

## Local development

There is no build step. The site uses native ES modules (`import` / `export`), so open it through a local HTTP server rather than `file://`.

From the project root:

```bash
# Python 3
python3 -m http.server 8080

# or Node (npx, no install required)
npx serve .
```

Then visit:

- Landing page: [http://localhost:8080/](http://localhost:8080/)
- Models demo: [http://localhost:8080/models/](http://localhost:8080/models/)

Port numbers may differ depending on the tool you use.

## Scripts overview

- **page-load.js** — Staggered fade/slide reveals for hero content; respects `prefers-reduced-motion`.
- **carousel.js** — Infinite horizontal scroll of hero screenshots; pauses on hover when content overflows.
- **summary-card.js** — Cycles through Years 1–4 on the hero summary card, animating gross sales, expenses, cost of sales, and gross profit using data from `models/summary-income-statement.js`.
- **problem-papers.js** — Spreads stacked “paper” elements when the problem section enters the viewport.
- **solution-features.js** — Expandable feature list with a sliding indicator and optional screenshot lightbox.
- **split-text.js** — Character-level text transitions used by the summary card.

## Tech stack

- Plain HTML, CSS, and JavaScript (ES modules)
- [Inter](https://fonts.google.com/specimen/Inter) and [Poppins](https://fonts.google.com/specimen/Poppins) via Google Fonts
- No bundler, framework, or package manager required

## Notes

- Financial figures in `models/summary-income-statement.js` are sample data aligned with the models table demo.
- Animations throughout the site honor the user’s reduced-motion preference where implemented.

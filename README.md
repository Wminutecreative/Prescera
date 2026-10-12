# Prescera Labs website

Astro build of the Prescera Labs homepage (v10 prototype, 12 Oct 2026). Copy, layout and motion match the HTML prototype.

## Run

```bash
npm install
npm run dev       # http://localhost:4321
npm run build     # static site in dist/
npm run preview   # serve the build
```

Copy `.env.example` to `.env` and set `PUBLIC_FORM_ENDPOINT` to connect the form (see [apps-script/README.md](apps-script/README.md)).

## Structure

```
src/
  layouts/BaseLayout.astro     <head>, SEO meta, fonts, reduced-motion flag, header/footer
  pages/index.astro            homepage: sections + script imports (order matters)
  components/
    Header.astro               floating glass nav, mobile menu
    Footer.astro
    MobileBar.astro            sticky "Request access" bar on phones
    Tooltip.astro              shared tooltip for the hero picture
    Button.astro, Wordmark.astro
    Hero.astro + HeroHud.astro 3D attack story and the stage card
    Belief.astro               "Why does cyber defence need specialised models?"
    WhatChanged.astro + StatTile.astro
    Defenders.astro + WorkflowTimeline.astro
    Briefing.astro             request-access form
  data/site.ts                 nav links, stat tiles, traits, form roles
  scripts/
    pl-data.js                 hero network data + 2D SVG twin engine
    page.js                    stage card, nav, reveals, form submit
    tiles.js                   the four stat charts
    workflow.js                defender timeline animation
    hero3d.js                  three.js hero (lazy-loaded after first paint)
  styles/global.css            all styles, in the prototype's cascade order
apps-script/                   Google Sheet + email handler for the form
```

## Motion

- The 3D hero loads three.js after first paint, plays the attack to stage 05, raises the dome, then idles at 30 fps (and freezes on phones).
- With `prefers-reduced-motion` or no WebGL, the static SVG twin shows the end state and the stage card can be stepped by hand.
- Add `?tier=low|medium|high` to the URL to force a 3D quality tier.

## Deploy

Static output works on Vercel, Netlify or Cloudflare Pages. Set `PUBLIC_FORM_ENDPOINT` in the host's environment variables before building.

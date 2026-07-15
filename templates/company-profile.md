# Company profile - the branding + product context mockups are built from

Lives in your repo at `docs/company/company-profile.md` (kickoff seeds it from this template).
The plan builder reads it before generating any mockup, so mockups come out looking like YOUR
software. Fill in what you have; every unset token degrades a mockup toward generic. Screenshots
referenced here live alongside it in `docs/company/`.

---

## Company

- **Name:**
- **What the software is:** one paragraph on the product/internal app this instance plans for -
  what it does, who uses it.
- **Primary URL(s):** production app, staging if relevant.

## Brand tokens

The mockup generator maps these straight into CSS. Use real values from your product, not
aspirations.

| Token | Value | Notes |
|---|---|---|
| Primary color | `#` | buttons, links, active states |
| Secondary color | `#` | |
| Accent / success / warning / danger | `#` / `#` / `#` / `#` | |
| Background / surface | `#` / `#` | page bg, card bg |
| Text primary / muted | `#` / `#` | |
| Font family (headings) | | include fallback stack |
| Font family (body) | | |
| Border radius | | e.g. `6px` - sharp vs rounded changes the whole feel |
| Density | compact / comfortable | tables and forms |

## Layout conventions

How screens in the existing product are shaped, so new-screen mockups fit in:

- **Navigation:** sidebar / top bar / both; where the user menu lives.
- **Page skeleton:** e.g. "page title + action button top-right, filter bar, table below".
- **Tables / forms / cards:** which is the default vehicle for lists and detail views.
- **Terminology:** what a "record" is called here (order, job, case, client...).

## Screenshots

Reference screenshots of the current application committed next to this file - the strongest
signal the mockup generator gets. Name them by screen:

- `dashboard.png` - <one line on what it shows>
- `<screen>.png` - ...

## Product documentation

Links/paths to any deeper docs of the current application (user guides, admin manuals, the
Canonify design canons if present) that describe how existing features behave.

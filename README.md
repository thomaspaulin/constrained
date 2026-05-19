# what the f*** should I make?

A creative-constraints idea generator. Tell it your hobbies, what tools you have, and what craft you're in the mood for. It hands you a random idea with five layered constraints.

Inspired by [whatthefuckshouldimakefordinner.com](https://whatthefuckshouldimakefordinner.com/), but for makers.

## How it works

Pure static site. No build step, no framework, no backend. JSON data files + vanilla JS.

Each generated idea is assembled from five categories:

1. **Format** — the shape of the output (CLI tool, triptych, kinetic sculpture, ...)
2. **Material** — what you make it with (Python, acrylic paint, scrap wood, ...) plus any tools you checked
3. **Scope** — quantitative limit (under $25, fits in a shoebox, exactly 12 pieces, ...)
4. **Technique** — *how* you're forced to make it (monochrome, no measuring tools, non-dominant hand, ...)
5. **Quirk** — the twist (must be giftable, must reference a specific year, must look amateur, ...)

Up to one category is randomly dropped per roll. Items are tagged by compatible craft, so a software project won't get suggested acrylic paint.

Click any chip in the output to exclude that item from future rolls. Exclusions persist in `localStorage`.

## Run locally

```sh
cd idea-generator
python3 -m http.server 8000
# open http://localhost:8000
```

That's it. No npm install, no build.

## Deploy

Any free static host works. Options:

- **GitHub Pages**: push to a repo, enable Pages on the `main` branch, point at root. Done.
- **Cloudflare Pages**: connect repo, leave build command empty, output directory `/`.
- **Netlify**: drag the folder into the deploy UI.

## Customize

All content lives in `data/*.json`. To add or remove:

- **New craft**: add an entry to `crafts.json` and a template array to `templates.json` with the same `id`.
- **New format / material / scope / technique / quirk**: add an entry with a `crafts` array. Use `["*"]` for craft-agnostic items.
- **New tool checkbox**: add to `common_tools.json` with applicable crafts.

The JSON is loaded at runtime via `fetch()` so no rebuild is needed — edit, save, refresh.

## File layout

```
index.html         page structure
style.css          editorial / brutalist styling
app.js             load JSON, read form, generate idea, handle exclusions
data/
  crafts.json
  formats.json
  materials.json
  scope.json
  techniques.json
  quirks.json
  common_tools.json
  templates.json   per-craft sentence templates
```

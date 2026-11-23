# Portfolio

Personal portfolio of Bharath Pisay. A static site with no build step: `index.html`, `styles.css`, `script.js` and `boot.js`, with the font self-hosted in `fonts/`.

The page is laid out like a printed wall calendar. The hero is a working month grid (a leave planner): pick a first and last day, or use the arrow keys, Enter, Home/End and PageUp/PageDown.

## Preview

Serve the folder with any static server, for example `python3 -m http.server`, and open it in a browser.

## Publish

The site is served by GitHub Pages from the `main` branch, root folder. There is no server code and no external request at runtime; a strict Content-Security-Policy is set in `index.html`.

## Licences

Archivo is under the SIL Open Font License (see `fonts/`).

# Portfolio

Personal portfolio of Bharath Pisay. A static site: `index.html`, `styles.css`, `script.js` and `boot.js`, with the fonts self-hosted in `fonts/`. The hero is a real WebGL scene built with [Three.js](https://threejs.org) (MIT), bundled into `assets/hero3d.js`.

## Preview

Serve the folder with any static server, for example `python3 -m http.server`, and open it in a browser. The page also works without WebGL (it falls back to a CSS 3D grid) and respects reduced motion.

## Rebuild the 3D scene

The scene source is `src/hero3d.js`. The bundle in `assets/` is committed, so the site needs no build to be served. To change the scene:

```
npm install
npm run build
```

## Publish

The site is served by GitHub Pages from the `main` branch, root folder. There is no server code and no external request at runtime; a strict Content-Security-Policy is set in `index.html`.

## Licences

Bricolage Grotesque and Source Serif 4 are under the SIL Open Font License (see `fonts/`). Three.js is MIT-licensed and its notice is kept in the bundle.

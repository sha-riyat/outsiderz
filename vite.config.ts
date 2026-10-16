import { defineConfig } from "vite";

/**
 * Le build de la station sol n'écrit QUE le dossier `assets/`.
 *
 * Pourquoi pas le schéma habituel (Vite produit son propre HTML) : ici les trois pages de la
 * présentation — `index.html`, `station.html`, `figure.html` — sont écrites à la main et vivent
 * à la racine du projet. Si Vite produisait un HTML, il écraserait la source.
 *
 * On lui donne donc directement le point d'entrée TypeScript. Il en sort deux fichiers aux noms
 * stables, que `station.html` appelle :
 *
 *     assets/station.js    — l'application (Leaflet compris, 100 % hors-ligne)
 *     assets/station.css   — l'habillage, tokens compris
 *
 * Reconstruire la station : `npx vite build`, puis recharger la page.
 */
export default defineConfig({
  base: "./",
  build: {
    outDir: "assets",
    emptyOutDir: true,
    rollupOptions: {
      input: "src/main.ts",
      output: {
        entryFileNames: "station.js",
        chunkFileNames: "station-[name].js",
        assetFileNames: "station.css",
      },
    },
  },
});

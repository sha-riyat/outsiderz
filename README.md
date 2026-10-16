# Outsiderz — Station sol de démonstration

Démonstration visuelle du projet **drone d'inspection préventive du réseau électrique de la CEET**
(Concours Étudiant de Conception et de Fabrication de Drones, ANAC Togo, édition 2026).

Toutes les données sont **simulées** : le drone n'existe pas encore, cette démo présente la station sol,
la mission et le rapport d'inspection.

## Pages

| Page | Contenu |
| --- | --- |
| `index.html` | Présentation du système et de l'équipe |
| `station.html` | Station sol : mission simulée, carte, anomalies |
| `figure.html` | Anatomie du drone en vue isométrique interactive |

## Lancer en local

Prérequis : Node.js (version gérée avec `nvm`).

```bash
npm install
npm run dev       # serveur de développement Vite
npm run build     # build de production
npm run preview   # prévisualisation sur le port 4173
```

Pour regarder les pages sans compilation, hors-ligne :

```bash
node srv.mjs
```

puis ouvrir `http://localhost:4180/`. `station.html` doit passer par un serveur, un double-clic ne suffit pas.

## Déploiement

Le dossier `deploy/` contient une copie figée des pages, prête pour un hébergement statique
(Netlify Drop, Cloudflare Pages, Vercel ou GitHub Pages). Voir `deploy/README.md`.

## Réseau

Seul le fond de carte OpenStreetMap utilise Internet. Il est décoché par défaut : sans réseau,
la carte affiche un quadrillage et le reste fonctionne.

## Structure

```
src/sim/      simulation du vol, de la mission et des anomalies
src/ui/       carte Leaflet et panneau de la station
src/design/   jetons de couleurs et de typographie
src/outils/   génération de la figure du drone
assets/       feuille de style et script de la station
deploy/       paquet statique à publier
```

## Équipe

Outsiderz — SEDJRO Koffi Jacques, AKPO GNANDI Augustin Nighen, ADJRAKOU Kodjo Ewozan Benjamin,
GANSE Sewa Shariyat Godwin. Encadrant : AKAKPO Ablamvi Justin, expert drone.

# Outsiderz — CECFD 2026 · paquet à publier

Copie figée des trois pages de la démonstration, prête à déposer telle quelle sur un hébergement
statique. **C'est une copie** : les fichiers de travail vivent à la racine du projet, pas ici.

## Contenu

| Fichier | Rôle |
| --- | --- |
| `index.html` | Page d'accueil (présentation du système) |
| `station.html` | Station sol — mission complète simulée |
| `figure.html` | Anatomie du drone — vue isométrique interactive |
| `assets/station.css` | Habillage de la station |
| `assets/station.js` | Application de la station (Leaflet compris, aucun CDN) |
| `src/design/tokens.css` | Jetons de couleurs et de typographie, appelés par `index.html` |
| `srv.mjs` | Serveur statique local (uniquement pour regarder les pages hors-ligne) |

## Publier

- **Netlify Drop** (`app.netlify.com/drop`) : glisser-déposer ce dossier, l'URL est immédiate.
- **Cloudflare Pages** ou **Vercel** : « Upload » du même dossier.
- **GitHub Pages** : pousser ces fichiers dans un dépôt, activer Pages, l'URL est
  `https://<compte>.github.io/<dépôt>/` — les chemins sont relatifs, tout fonctionne en sous-dossier.

Aucune étape de compilation, aucun serveur applicatif : ce sont des fichiers statiques.

## Regarder les pages hors-ligne (répétition, salle sans réseau)

```
node srv.mjs
```

puis ouvrir `http://localhost:4180/`. `station.html` est chargé comme module JavaScript : il
**doit** passer par un serveur (ou un hébergement), un double-clic sur le fichier ne suffit pas.

## Réseau

Seul le fond de carte OpenStreetMap sort sur Internet, et il est **décoché par défaut** : sans
réseau, la carte affiche son quadrillage clair, le reste de la page ne bouge pas.

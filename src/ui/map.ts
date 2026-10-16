/**
 * Vue carte (Leaflet) : itinéraire de mission, pylônes, geofence, position du drone.
 *
 * Choix hors-ligne : le fond de carte par défaut est une grille générée en CSS, alignée sur la
 * projection Leaflet (elle suit donc les déplacements et les zooms). Les tuiles OSM sont une option
 * à cocher : si le wifi tombe, la grille reste visible et la démo ne casse pas.
 */

import L from 'leaflet';
import { GEOFENCE, HOME, LIGNE, PYLONES, WAYPOINTS, amplitudeGeofenceM, type LatLon } from '../sim/mission';
import { ANOMALIES, type Gravite } from '../sim/anomalies';

/**
 * Palette de la carte — dessinée pour un fond clair.
 *
 * Discipline de couleur : le cobalt appartient à ce qui est à nous (itinéraire, trace, position),
 * l'orange à ce qui est anormal, et tout le reste — environnement, pylônes, clôture — se contente
 * du gris d'encre. Rien d'autre n'a le droit à une teinte. Les contrastes indiqués sont mesurés
 * sur le fond blanc de la carte : c'est une image qu'on regarde de loin, on vise 4,5:1 minimum.
 */
const COULEURS = {
  itineraire: '#1f58f2', // 5,9:1 — itinéraire planifié : même cobalt, mais pointillé et plus fin
  pylone: '#1b2430', // 15:1 — l'ouvrage, c'est le décor : il reste sombre
  waypoint: '#5a6371', // 5,8:1
  geofence: '#6b7a8f', // 4,2:1 — une clôture se voit sans crier
  drone: '#0b1b33', // 17:1 — notre appareil, au centre de l'attention
  home: '#1f58f2', // 5,9:1 — point de décollage
  trace: '#1f58f2', // 5,9:1 — le vol réellement parcouru : plein et épais
};

/** Couleurs d'anomalie : un seul ton chaud, par paliers de gravité. Toutes ≥ 4,5:1 sur blanc. */
const COULEUR_GRAVITE: Record<Gravite, string> = {
  haute: '#c2410c',
  moyenne: '#b45309',
  faible: '#5b6a80',
};

const TAILLE_GRILLE_PX = 64;

/** Mentions de bas de carte : la grille hors-ligne et les tuiles OSM ne se cumulent pas. */
const ATTRIBUTION_GRILLE = 'Fond hors-ligne (grille) — démo Outsiderz, données simulées';
const ATTRIBUTION_OSM = '© OpenStreetMap';

let carte: L.Map | null = null;
let marqueurDrone: L.Marker | null = null;
let coucheOsm: L.TileLayer | null = null;
let coucheItineraire: L.Polyline | null = null;
let coucheTrace: L.Polyline | null = null;
let angleDrone = 0;
const marqueursAnomalies = new Map<string, L.CircleMarker>();
const pointsTrace: L.LatLngExpression[] = [];
const marqueursWaypoints: L.CircleMarker[] = [];
/** Vrai quand le drone a atteint le dernier waypoint : l'itinéraire se pose alors en plein. */
let itineraireTermine = false;

/** Icône du drone : sa couleur est peinte dans le SVG, elle vient de la palette. */
function iconeDrone(): L.DivIcon {
  return L.divIcon({
    className: 'icone-drone',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    html: `
    <div class="drone-rotor">
      <svg viewBox="0 0 48 48" width="40" height="40" aria-hidden="true">
        <g fill="none" stroke="${COULEURS.drone}" stroke-width="3" stroke-linecap="round">
          <path d="M15 15 L33 33 M33 15 L15 33" />
          <circle cx="11" cy="11" r="5.5" /><circle cx="37" cy="11" r="5.5" />
          <circle cx="11" cy="37" r="5.5" /><circle cx="37" cy="37" r="5.5" />
        </g>
        <circle cx="24" cy="24" r="5" fill="${COULEURS.drone}" />
      </svg>
    </div>`,
  });
}

function iconePylone(nom: string): L.DivIcon {
  return L.divIcon({
    className: 'icone-pylone',
    iconSize: [46, 30],
    iconAnchor: [23, 15],
    html: `<div class="pylone-corps">${nom}</div>`,
  });
}

/** Aligne la grille CSS sur l'origine en pixels de la carte (effet « fond de carte »). */
function alignerGrille(m: L.Map): void {
  const origine = m.getPixelOrigin();
  const el = m.getContainer();
  el.style.backgroundPosition = `${-(origine.x % TAILLE_GRILLE_PX)}px ${-(origine.y % TAILLE_GRILLE_PX)}px`;
}

function dessinerGeofence(m: L.Map): void {
  const cadre = L.rectangle(
    [
      [GEOFENCE.sud, GEOFENCE.ouest],
      [GEOFENCE.nord, GEOFENCE.est],
    ],
    {
      color: COULEURS.geofence,
      weight: 2,
      dashArray: '8 6',
      fillColor: COULEURS.geofence,
      fillOpacity: 0.05,
    },
  );
  cadre.bindTooltip(`Geofence — ${amplitudeGeofenceM()}`, { sticky: true });
  cadre.addTo(m);
}

function dessinerPylones(m: L.Map): void {
  for (const pylone of PYLONES) {
    L.marker([pylone.lat, pylone.lon], { icon: iconePylone(pylone.nom) })
      .addTo(m)
      .bindTooltip(`Pylône ${pylone.nom} — hauteur 12 m — ligne HTA 20 kV`, { direction: 'top', offset: [0, -14] });
  }
}

function dessinerWaypoints(m: L.Map): void {
  for (const wp of WAYPOINTS) {
    const marqueur = L.circleMarker([wp.lat, wp.lon], {
      radius: 6,
      color: COULEURS.waypoint,
      weight: 2.5,
      // Disque plein : un waypoint translucide se confond avec le tracé qui passe dessous.
      fillColor: COULEURS.waypoint,
      fillOpacity: 0.9,
    })
      .addTo(m)
      .bindTooltip(`${wp.nom} — ${wp.altitudeM} m — 4 m/s`, { direction: 'right' });
    marqueursWaypoints.push(marqueur);
  }
}

function dessinerItineraire(m: L.Map): void {
  coucheItineraire = L.polyline(
    WAYPOINTS.map((wp) => [wp.lat, wp.lon] as [number, number]),
    { color: COULEURS.itineraire, weight: 2.5, dashArray: '10 7', opacity: 0.85 },
  ).addTo(m);
  coucheItineraire.bindTooltip('Itinéraire de mission (8 waypoints, 25 m)', { sticky: true });
}

function dessinerHome(m: L.Map): void {
  L.circleMarker([HOME.lat, HOME.lon], {
    radius: 7,
    color: COULEURS.home,
    weight: 2,
    fillColor: COULEURS.home,
    fillOpacity: 0.25,
  })
    .addTo(m)
    .bindTooltip('Point de décollage / atterrissage');
}

/**
 * Les anomalies existent dès le départ dans la carte, mais restent invisibles : elles ne sont
 * révélées que lorsque le drone les a « vues », exactement comme dans la chaîne réelle.
 */
function preparerAnomalies(): void {
  for (const anomalie of ANOMALIES) {
    const marqueur = L.circleMarker([anomalie.lat, anomalie.lon], {
      radius: 9,
      color: COULEUR_GRAVITE[anomalie.gravite],
      weight: 3,
      fillColor: COULEUR_GRAVITE[anomalie.gravite],
      fillOpacity: 0.5,
      className: 'anomalie-carte',
    });
    marqueur.bindTooltip(
      `<strong>${anomalie.id} — ${anomalie.type}</strong><br/>${anomalie.pylone} · gravité ${anomalie.gravite}`,
      { direction: 'top', offset: [0, -10] },
    );
    marqueursAnomalies.set(anomalie.id, marqueur);
  }
}

function preparerTrace(m: L.Map): void {
  coucheTrace = L.polyline([], { color: COULEURS.trace, weight: 4, opacity: 0.85 }).addTo(m);
}

export function initCarte(conteneur: HTMLElement): L.Map {
  carte = L.map(conteneur, {
    center: [LIGNE.depart.lat, LIGNE.depart.lon],
    zoom: 14,
    minZoom: 10,
    maxZoom: 19,
    zoomControl: true,
    preferCanvas: true,
  });

  carte.attributionControl.setPrefix(false);
  carte.attributionControl.addAttribution(ATTRIBUTION_GRILLE);

  alignerGrille(carte);
  carte.on('move zoom viewreset', () => carte && alignerGrille(carte));

  dessinerGeofence(carte);
  dessinerItineraire(carte);
  dessinerPylones(carte);
  dessinerWaypoints(carte);
  dessinerHome(carte);
  preparerTrace(carte);
  preparerAnomalies();

  marqueurDrone = L.marker([HOME.lat, HOME.lon], { icon: iconeDrone(), zIndexOffset: 1000 })
    .addTo(carte)
    .bindTooltip('Drone Outsiderz — X500 V2 (simulation)', { direction: 'top', offset: [0, -22] });

  centrerSurMission();
  return carte;
}

export function getCarte(): L.Map | null {
  return carte;
}

/** Recentre la vue sur l'ensemble du couloir inspecté. */
export function centrerSurMission(): void {
  if (!carte) return;
  const bornes = L.latLngBounds(WAYPOINTS.map((wp) => [wp.lat, wp.lon] as [number, number]));
  bornes.extend([HOME.lat, HOME.lon]);
  carte.fitBounds(bornes, { padding: [60, 60] });
}

/** Déplace le marqueur drone (appelé par la simulation à chaque tick). */
export function deplacerDrone(position: LatLon, capDeg?: number): void {
  if (!marqueurDrone) return;
  marqueurDrone.setLatLng([position.lat, position.lon]);
  if (capDeg !== undefined) {
    angleDrone = capDeg;
    const rotor = marqueurDrone.getElement()?.querySelector<HTMLElement>('.drone-rotor');
    if (rotor) rotor.style.transform = `rotate(${angleDrone}deg)`;
  }
}

/** Ajoute un point à la trace du vol réellement parcouru. */
export function tracerVol(position: LatLon): void {
  if (!coucheTrace) return;
  const dernier = pointsTrace[pointsTrace.length - 1] as [number, number] | undefined;
  if (dernier && Math.abs(dernier[0] - position.lat) < 1e-6 && Math.abs(dernier[1] - position.lon) < 1e-6) {
    return;
  }
  pointsTrace.push([position.lat, position.lon]);
  coucheTrace.setLatLngs(pointsTrace);
}

export function reinitialiserTrace(): void {
  pointsTrace.length = 0;
  coucheTrace?.setLatLngs([]);
}

/** Fait apparaître une anomalie sur la carte (elle vient d'être détectée par le drone). */
export function revelerAnomalie(id: string): void {
  const marqueur = marqueursAnomalies.get(id);
  if (marqueur && carte && !carte.hasLayer(marqueur)) marqueur.addTo(carte);
}

export function masquerAnomalies(): void {
  for (const marqueur of marqueursAnomalies.values()) {
    if (carte?.hasLayer(marqueur)) carte.removeLayer(marqueur);
  }
}

/** Recentre la carte sur le drone pendant le vol. */
export function suivreDrone(position: LatLon): void {
  carte?.panTo([position.lat, position.lon], { animate: true, duration: 0.4 });
}

/**
 * Affiche ou masque les tuiles OSM (option en ligne). Ne remplace jamais la grille hors-ligne, et
 * ne change plus rien aux couleurs : les deux fonds sont clairs, la palette des repères est la même.
 */
export function basculerFondOsm(actif: boolean): void {
  if (!carte) return;

  if (actif) {
    if (!coucheOsm) {
      coucheOsm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        opacity: 1,
        errorTileUrl:
          'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      });
    }
    coucheOsm.addTo(carte);
    carte.attributionControl.removeAttribution(ATTRIBUTION_GRILLE);
    carte.attributionControl.addAttribution(ATTRIBUTION_OSM);
  } else {
    if (coucheOsm) carte.removeLayer(coucheOsm);
    carte.attributionControl.removeAttribution(ATTRIBUTION_OSM);
    carte.attributionControl.addAttribution(ATTRIBUTION_GRILLE);
  }
}

/** Met en évidence l'itinéraire parcouru (utilisé aux étapes suivantes). */
export function mettreEnAvance(waypointAtteint: number, total: number): void {
  if (!coucheItineraire) return;
  itineraireTermine = waypointAtteint >= total;
  coucheItineraire.setStyle({
    color: itineraireTermine ? COULEURS.home : COULEURS.itineraire,
    opacity: itineraireTermine ? 1 : 0.85,
  });
}

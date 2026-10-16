/**
 * Géométrie de la mission de démonstration.
 * Zone fictive : couloir de ligne HTA autour de Lomé (≈ 6,17 N / 1,23 E).
 * Aucune donnée réelle de la CEET : tout est simulé (badge permanent à l'écran).
 */

export interface LatLon {
  lat: number;
  lon: number;
}

export interface Waypoint extends LatLon {
  id: number;
  nom: string;
  altitudeM: number;
}

export interface Pylone extends LatLon {
  id: number;
  nom: string;
  hauteurM: number;
}

/** Paramètres de vol retenus au dossier technique. */
export const VOL = {
  vitesseCroisiereMs: 4,
  altitudeLigneM: 25,
  distanceLateraleM: 12,
  autonomieMin: 30,
  seuilBatteriePourcent: 25,
  rayonDetectionM: 30,
};

export const SITE = {
  nom: 'Couloir HTA fictif — Lomé',
  centre: { lat: 6.1658, lon: 1.2224 } as LatLon,
};

/**
 * Tracé du tronçon inspecté.
 *
 * Une ligne HTA ne va jamais droit : elle suit les routes et change de direction aux pylônes
 * d'angle. Ces cinq sommets sont les positions relevées des cinq pylônes — le tracé passe
 * exactement par eux, et ce sont ces changements de direction qui font les angles sur la carte.
 * Coordonnées fictives (couloir autour de Lomé) ; aucune donnée réelle de la CEET.
 */
export const TRACE: LatLon[] = [
  { lat: 6.159, lon: 1.214 },
  { lat: 6.161537, lon: 1.21888 },
  { lat: 6.16596, lon: 1.222227 },
  { lat: 6.168218, lon: 1.227337 },
  { lat: 6.172502, lon: 1.2308 },
];

/** Extrémités du tronçon de ligne inspecté. */
export const LIGNE = {
  depart: TRACE[0],
  arrivee: TRACE[TRACE.length - 1],
};

/** Point de décollage, à l'écart de la ligne (sécurité). */
export const HOME: LatLon = { lat: LIGNE.depart.lat - 0.0016, lon: LIGNE.depart.lon - 0.0018 };

const NB_WAYPOINTS = 8;

function interpole(a: LatLon, b: LatLon, t: number): LatLon {
  return { lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t };
}

/** Longueurs cumulées le long du tracé, depuis le premier pylône. */
const CUMUL: number[] = (() => {
  const c = [0];
  for (let i = 1; i < TRACE.length; i++) c.push(c[i - 1] + distanceM(TRACE[i - 1], TRACE[i]));
  return c;
})();

/** Point situé à la fraction t du tracé (0 = premier pylône, 1 = dernier), en suivant les angles. */
function pointSurTrace(t: number): LatLon {
  const cible = CUMUL[CUMUL.length - 1] * t;
  let i = 1;
  while (i < CUMUL.length - 1 && CUMUL[i] < cible) i++;
  const part = (cible - CUMUL[i - 1]) / (CUMUL[i] - CUMUL[i - 1]);
  return interpole(TRACE[i - 1], TRACE[i], part);
}

/** 5 pylônes HTA : un à chaque sommet du tracé, là où la ligne change de direction. */
export const PYLONES: Pylone[] = TRACE.map((p, i) => ({
  id: i + 1,
  nom: `P${i + 1}`,
  hauteurM: 12,
  lat: p.lat,
  lon: p.lon,
}));

/** 8 waypoints régulièrement espacés le long du tracé, à l'altitude de ligne. */
export const WAYPOINTS: Waypoint[] = Array.from({ length: NB_WAYPOINTS }, (_, i) => {
  const p = pointSurTrace(i / (NB_WAYPOINTS - 1));
  return {
    id: i + 1,
    nom: `WP${String(i + 1).padStart(2, '0')}`,
    altitudeM: VOL.altitudeLigneM,
    lat: p.lat,
    lon: p.lon,
  };
});

/** Geofence : rectangle englobant le tronçon avec une marge de sécurité d'environ 250 m. */
export const GEOFENCE = {
  sud: Math.min(LIGNE.depart.lat, LIGNE.arrivee.lat) - 0.0022,
  nord: Math.max(LIGNE.depart.lat, LIGNE.arrivee.lat) + 0.0022,
  ouest: Math.min(LIGNE.depart.lon, LIGNE.arrivee.lon) - 0.0025,
  est: Math.max(LIGNE.depart.lon, LIGNE.arrivee.lon) + 0.0025,
};

export function amplitudeGeofenceM(): string {
  const hauteur = (GEOFENCE.nord - GEOFENCE.sud) * 111320;
  const largeur = (GEOFENCE.est - GEOFENCE.ouest) * 111320 * Math.cos((SITE.centre.lat * Math.PI) / 180);
  return `${(largeur / 1000).toFixed(1)} km × ${(hauteur / 1000).toFixed(1)} km`;
}

/** Distance approximative en mètres entre deux points (suffisant à l'échelle de la démo). */
export function distanceM(a: LatLon, b: LatLon): number {
  const dLat = (b.lat - a.lat) * 111320;
  const dLon = (b.lon - a.lon) * 111320 * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLon * dLon);
}

export function dansGeofence(p: LatLon): boolean {
  return p.lat >= GEOFENCE.sud && p.lat <= GEOFENCE.nord && p.lon >= GEOFENCE.ouest && p.lon <= GEOFENCE.est;
}

/** Longueur totale du tronçon inspecté, en mètres. */
export function longueurTronconM(): number {
  let total = 0;
  for (let i = 1; i < WAYPOINTS.length; i++) total += distanceM(WAYPOINTS[i - 1], WAYPOINTS[i]);
  return total;
}

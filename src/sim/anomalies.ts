/**
 * Anomalies simulées détectables le long du tronçon.
 *
 * Chaque anomalie est rattachée à un pylône du couloir. Aucune donnée réelle de la CEET :
 * les positions, les écarts de température et les gravités sont inventés pour la démonstration.
 * La liste est déterministe : la même démo donnera toujours le même rapport.
 */

import { PYLONES, type LatLon } from './mission';

export type Gravite = 'haute' | 'moyenne' | 'faible';
export type Canal = 'thermique' | 'visible';

export interface Anomalie extends LatLon {
  id: string;
  pylone: string;
  type: string;
  gravite: Gravite;
  canal: Canal;
  /** Écart de température mesuré par la caméra radiométrique (°C), si pertinent. */
  deltaTC?: number;
  /** Défaut observé. */
  defaut: string;
  /** Recommandation transmise aux équipes CEET. */
  action: string;
  /**
   * La même recommandation, en une ligne : c'est la version affichée sur la station, où la place
   * est comptée. Le rapport exporté, lui, garde la formule complète.
   */
  actionCourte: string;
}

/** Décale légèrement l'anomalie du pied du pylône (elle est en haut de la structure). */
function surPylone(nom: string, dLat: number, dLon: number): LatLon {
  const p = PYLONES.find((x) => x.nom === nom);
  if (!p) return { lat: 0, lon: 0 };
  return { lat: p.lat + dLat, lon: p.lon + dLon };
}

export const ANOMALIES: Anomalie[] = [
  {
    id: 'A-01',
    ...surPylone('P2', 0.00012, -0.00008),
    pylone: 'P2',
    type: 'Point chaud',
    canal: 'thermique',
    gravite: 'haute',
    deltaTC: 38,
    defaut: 'Échauffement du connecteur de phase — cosse probablement desserrée.',
    action: 'Consignation et resserrage du connecteur. Contrôle sous 72 h.',
    actionCourte: 'Resserrage du connecteur sous 72 h',
  },
  {
    id: 'A-02',
    ...surPylone('P3', -0.0001, 0.00009),
    pylone: 'P3',
    type: 'Isolateur défectueux',
    canal: 'visible',
    gravite: 'moyenne',
    deltaTC: 11,
    defaut: 'Éclat sur la jupe de l’isolateur, amorçage superficiel visible.',
    action: 'Remplacement de l’isolateur à la prochaine intervention programmée.',
    actionCourte: 'Remplacement de l’isolateur',
  },
  {
    id: 'A-03',
    ...surPylone('P4', 0.00014, 0.00012),
    pylone: 'P4',
    type: 'Végétation envahissante',
    canal: 'visible',
    gravite: 'faible',
    defaut: 'Branche à moins de 1,8 m du conducteur inférieur.',
    action: 'Élagage préventif avant la saison des pluies.',
    actionCourte: 'Élagage préventif avant les pluies',
  },
  {
    id: 'A-04',
    ...surPylone('P5', -0.00013, -0.00011),
    pylone: 'P5',
    type: 'Point chaud',
    canal: 'thermique',
    gravite: 'haute',
    deltaTC: 52,
    defaut: 'Point chaud marqué sur le manchon de jonction — 52 °C au-dessus de la ligne.',
    action: 'Intervention prioritaire : risque de rupture de conducteur.',
    actionCourte: 'Intervention prioritaire',
  },
];

export const ORDRE_GRAVITE: Record<Gravite, number> = { haute: 0, moyenne: 1, faible: 2 };

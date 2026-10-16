/**
 * Simulateur de vol de la mission de démonstration.
 *
 * Ce n'est pas un modèle aérodynamique : c'est un suivi de trajectoire le long des waypoints du
 * dossier technique, avec une consommation énergétique dérivée des chiffres du bilan de masse
 * (2 800 g, batterie 4S4P ≈ 237 Wh, puissance de croisière ≈ 280 W → ≈ 50 min d'autonomie).
 * L'objectif est que les chiffres affichés à l'écran ne contredisent pas le dossier.
 */

import { HOME, VOL, WAYPOINTS, distanceM, type LatLon } from './mission';

export type ModeVol = 'Prêt au décollage' | 'Vol automatique' | 'Retour automatique (RTL)' | 'Mission terminée';

/** Ce qui a déclenché le retour automatique — affiché tel quel à l'opérateur. */
export type MotifRtl = 'liaison' | 'batterie';

export interface Telemetrie {
  position: LatLon;
  altM: number;
  capDeg: number;
  vitesseMs: number;
  batteriePct: number;
  tempsVolS: number;
  etapeLabel: string;
  progressionPct: number;
  parcouruM: number;
  restantM: number;
  mode: ModeVol;
  liaisonOk: boolean;
  motifRtl: MotifRtl | null;
}

/** Énergie : ≈ 280 W sur une batterie de ≈ 237 Wh → ≈ 50 min de vol, soit ≈ 0,033 % par seconde. */
const CONSO_PCT_PAR_S = 0.033;

/** Rayon dans lequel une anomalie est considérée comme détectée par la charge utile. */
export const RAYON_DETECTION_M = VOL.rayonDetectionM;

function capEntre(a: LatLon, b: LatLon): number {
  const est = (b.lon - a.lon) * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  const nord = b.lat - a.lat;
  return (((Math.atan2(est, nord) * 180) / Math.PI) + 360) % 360;
}

export class SimulateurVol {
  private chemin: LatLon[];
  private cumul: number[] = [];
  private longueur = 0;
  private s = 0;
  private parcouruM = 0;
  private batterie = 100;
  private tempsS = 0;
  private rtlActif = false;
  private motifRtl: MotifRtl | null = null;
  private terminee = false;
  private liaisonOk = true;

  constructor() {
    this.chemin = this.cheminInitial();
    this.recalculer();
  }

  private cheminInitial(): LatLon[] {
    return [...[HOME], ...WAYPOINTS.map((w) => ({ lat: w.lat, lon: w.lon })), HOME];
  }

  private recalculer(): void {
    this.cumul = [0];
    for (let i = 1; i < this.chemin.length; i++) {
      this.cumul.push(this.cumul[i - 1] + distanceM(this.chemin[i - 1], this.chemin[i]));
    }
    this.longueur = this.cumul[this.cumul.length - 1];
  }

  reset(): void {
    this.chemin = this.cheminInitial();
    this.recalculer();
    this.s = 0;
    this.parcouruM = 0;
    this.batterie = 100;
    this.tempsS = 0;
    this.rtlActif = false;
    this.motifRtl = null;
    this.terminee = false;
    this.liaisonOk = true;
  }

  /** Fail-safe : on abandonne le reste du plan et on rentre directement au point de décollage. */
  declencherRtl(motif: MotifRtl): void {
    if (this.rtlActif || this.terminee) return;
    const ici = this.positionA(this.s).position;
    this.chemin = [ici, HOME];
    this.recalculer();
    this.s = 0;
    this.rtlActif = true;
    this.motifRtl = motif;
  }

  /** Coupure simulée de la liaison télémétrie (démonstration de la perte de liaison). */
  couperLiaison(): void {
    this.liaisonOk = false;
    this.declencherRtl('liaison');
  }

  /** Avance la simulation de `dtSim` secondes de vol réel. */
  avancer(dtSim: number): Telemetrie {
    if (!this.terminee) {
      const pas = VOL.vitesseCroisiereMs * dtSim;
      this.s = Math.min(this.longueur, this.s + pas);
      this.parcouruM += pas;
      this.tempsS += dtSim;
      this.batterie = Math.max(0, this.batterie - CONSO_PCT_PAR_S * dtSim);

      // Seuil de sécurité batterie du dossier technique.
      if (!this.rtlActif && this.batterie <= VOL.seuilBatteriePourcent) this.declencherRtl('batterie');
      if (this.longueur - this.s < 0.5) this.terminee = true;
    }
    return this.telemetrie();
  }

  private positionA(s: number): { position: LatLon; capDeg: number; segment: number; t: number } {
    let segment = 0;
    while (segment < this.chemin.length - 2 && this.cumul[segment + 1] < s) segment++;
    const a = this.chemin[segment];
    const b = this.chemin[segment + 1];
    const base = this.cumul[segment];
    const longueurSeg = Math.max(1e-6, this.cumul[segment + 1] - base);
    const t = Math.min(1, Math.max(0, (s - base) / longueurSeg));
    return {
      position: { lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t },
      capDeg: capEntre(a, b),
      segment,
      t,
    };
  }

  telemetrie(): Telemetrie {
    const { position, capDeg, segment } = this.positionA(this.s);
    let etapeLabel: string;
    if (this.rtlActif) etapeLabel = 'Retour au point de décollage';
    else if (segment >= WAYPOINTS.length) etapeLabel = 'Rentrée finale';
    else etapeLabel = `Waypoint ${String(segment + 1).padStart(2, '0')} / ${WAYPOINTS.length}`;

    const mode: ModeVol = this.terminee
      ? 'Mission terminée'
      : this.rtlActif
        ? 'Retour automatique (RTL)'
        : this.s <= 0
          ? 'Prêt au décollage'
          : 'Vol automatique';

    return {
      position,
      altM: VOL.altitudeLigneM,
      capDeg,
      vitesseMs: this.terminee ? 0 : VOL.vitesseCroisiereMs,
      batteriePct: this.batterie,
      tempsVolS: this.tempsS,
      etapeLabel,
      progressionPct: this.longueur > 0 ? (this.s / this.longueur) * 100 : 0,
      parcouruM: this.parcouruM,
      restantM: Math.max(0, this.longueur - this.s),
      mode,
      liaisonOk: this.liaisonOk,
      motifRtl: this.motifRtl,
    };
  }

  get estTerminee(): boolean {
    return this.terminee;
  }
}

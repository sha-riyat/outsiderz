/**
 * Point d'assemblage de la station sol.
 *
 * Boucle de démonstration :
 *   planification (carte déjà tracée) → vol automatique → détection des anomalies
 *   → rapport d'inspection exportable.
 *
 * Tout est simulé et fonctionne hors-ligne. Le badge permanent le rappelle à l'écran.
 */

import 'leaflet/dist/leaflet.css';
import './styles.css';

import {
  basculerFondOsm,
  centrerSurMission,
  deplacerDrone,
  initCarte,
  masquerAnomalies,
  reinitialiserTrace,
  revelerAnomalie,
  suivreDrone,
  tracerVol,
} from './ui/map';
import {
  ajouterImageInspection,
  genererRapportTexte,
  rendreRapport,
  rendreTelemetrie,
  reinitialiserPanneau,
} from './ui/panneau';
import { ANOMALIES, type Anomalie } from './sim/anomalies';
import { HOME, WAYPOINTS, distanceM } from './sim/mission';
import { RAYON_DETECTION_M, SimulateurVol, type Telemetrie } from './sim/vol';

const PAS_MAX_S = 0.5;

function monter(): void {
  const conteneur = document.getElementById('carte');
  if (!conteneur) throw new Error('Conteneur #carte introuvable');

  const carte = initCarte(conteneur);
  carte.zoomControl.setPosition('topleft');

  const sim = new SimulateurVol();
  const detectees: Anomalie[] = [];
  const idsDetectes = new Set<string>();

  let enCours = false;
  let suivre = true;
  let derniereMs = 0;
  /** Une seule fois par mission : amener le panneau sur le rapport quand le vol se termine. */
  let rapportMontre = false;

  const boutonPlay = document.getElementById('btn-play') as HTMLButtonElement;
  const boutonPause = document.getElementById('btn-pause') as HTMLButtonElement;
  const boutonReset = document.getElementById('btn-reset') as HTMLButtonElement;
  const boutonRtl = document.getElementById('btn-rtl') as HTMLButtonElement;
  const boutonRapport = document.getElementById('btn-rapport') as HTMLButtonElement;
  const selectVitesse = document.getElementById('vitesse-sim') as HTMLSelectElement;
  const caseOsm = document.getElementById('fond-osm') as HTMLInputElement;

  /* ---------------------------------------------------------------- Rendu */

  function appliquer(t: Telemetrie): void {
    rendreTelemetrie(t);
    deplacerDrone(t.position, t.capDeg);
    tracerVol(t.position);
    if (suivre) suivreDrone(t.position);
  }

  function detecter(t: Telemetrie): void {
    for (const anomalie of ANOMALIES) {
      if (idsDetectes.has(anomalie.id)) continue;
      if (distanceM(t.position, anomalie) > RAYON_DETECTION_M) continue;
      idsDetectes.add(anomalie.id);
      detectees.push(anomalie);
      revelerAnomalie(anomalie.id);
      ajouterImageInspection(anomalie, t.tempsVolS);
      rendreRapport(detectees);
      if (anomalie.gravite === 'haute') suivre = false; // on laisse l'opérateur cadrer l'anomalie
    }
  }

  /* ---------------------------------------------------------------- Boucle */

  function boucle(ms: number): void {
    if (enCours) {
      if (derniereMs === 0) derniereMs = ms;
      const dtReel = Math.min(0.1, (ms - derniereMs) / 1000);
      derniereMs = ms;

      let reste = dtReel * Number(selectVitesse.value);
      let derniere: Telemetrie | null = null;
      while (reste > 0) {
        const pas = Math.min(PAS_MAX_S, reste);
        derniere = sim.avancer(pas);
        detecter(derniere);
        reste -= pas;
      }
      if (derniere) appliquer(derniere);

      if (sim.estTerminee) {
        enCours = false;
        suivre = true;
        boutonPlay.disabled = true;
        boutonPause.disabled = true;
        centrerSurMission();
        // Le rapport est le livrable de la démonstration : on l'amène sous les yeux de l'opérateur.
        // Pas de défilement — la page tient entière à l'écran — mais un soulignement bref du bloc.
        if (!rapportMontre) {
          rapportMontre = true;
          const bloc = document.getElementById('bloc-rapport');
          bloc?.classList.add('atteint');
          window.setTimeout(() => bloc?.classList.remove('atteint'), 2400);
        }
      }
    }
    requestAnimationFrame(boucle);
  }

  /* ---------------------------------------------------------------- Actions */

  function lancer(): void {
    if (sim.estTerminee) return;
    enCours = true;
    derniereMs = 0;
    boutonPlay.disabled = true;
    boutonPause.disabled = false;
  }

  function mettreEnPause(): void {
    enCours = false;
    boutonPlay.disabled = false;
    boutonPause.disabled = true;
  }

  function reinitialiser(): void {
    enCours = false;
    suivre = true;
    rapportMontre = false;
    detectees.length = 0;
    idsDetectes.clear();
    sim.reset();
    reinitialiserTrace();
    masquerAnomalies();
    reinitialiserPanneau();
    boutonPlay.disabled = false;
    boutonPause.disabled = true;
    centrerSurMission();
    appliquer(sim.telemetrie());
  }

  function exportRapport(): void {
    const texte = genererRapportTexte(detectees, sim.telemetrie());
    const url = URL.createObjectURL(new Blob([texte], { type: 'text/plain;charset=utf-8' }));
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = 'rapport-inspection-outsiderz-demo.txt';
    lien.click();
    URL.revokeObjectURL(url);

    // Retour visuel de l'export : la coche se dessine, le libellé confirme, puis tout se remet en place.
    const libelle = document.getElementById('libelle-rapport');
    boutonRapport.classList.add('exporte');
    if (libelle) libelle.textContent = 'Rapport exporté';
    window.setTimeout(() => {
      boutonRapport.classList.remove('exporte');
      if (libelle) libelle.textContent = 'Export rapport CEET';
    }, 1800);
  }

  /* ---------------------------------------------------------------- Écouteurs */

  boutonPlay.addEventListener('click', lancer);
  boutonPause.addEventListener('click', mettreEnPause);
  boutonReset.addEventListener('click', reinitialiser);
  boutonRtl.addEventListener('click', () => {
    sim.couperLiaison();
    if (!enCours) lancer();
  });
  boutonRapport.addEventListener('click', exportRapport);
  caseOsm.addEventListener('change', () => basculerFondOsm(caseOsm.checked));

  carte.on('dragstart', () => {
    suivre = false;
  });
  document.addEventListener('keydown', (evt) => {
    if (evt.key === 'h' || evt.key === 'H') {
      suivre = true;
      centrerSurMission();
    }
    if (evt.code === 'Space') {
      evt.preventDefault();
      enCours ? mettreEnPause() : lancer();
    }
  });
  window.addEventListener('resize', () => carte.invalidateSize());

  /* ---------------------------------------------------------------- Départ */

  appliquer(sim.telemetrie());
  deplacerDrone(HOME, 0);
  rendreRapport([]);
  requestAnimationFrame(boucle);
}

monter();

// Rappel utile en console pendant la démonstration.
console.info(
  `[Outsiderz] Démo station sol — ${WAYPOINTS.length} waypoints, ${ANOMALIES.length} anomalies simulées, ` +
    `rayon de détection ${RAYON_DETECTION_M} m.`,
);

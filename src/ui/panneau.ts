/**
 * Panneau latéral de la station sol : télémétrie, flux d'images d'inspection et rapport.
 *
 * Les vignettes « thermique » et « visible » sont dessinées en CSS (dégradés radiaux) : aucune
 * image externe n'est nécessaire, la démo reste entièrement hors-ligne.
 */

import type { Anomalie } from '../sim/anomalies';
import { ORDRE_GRAVITE } from '../sim/anomalies';
import type { Telemetrie } from '../sim/vol';

const $ = <T extends HTMLElement>(id: string): T | null => document.getElementById(id) as T | null;

function mmss(secondes: number): string {
  const m = Math.floor(secondes / 60);
  const s = Math.floor(secondes % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Teintes de sévérité : un dégradé de température, du plus chaud au plus sourd.
 * Les mêmes valeurs vivent dans src/design/tokens.css (--severe, --modere, --faible),
 * et sont réglées pour rester lisibles sur le papier clair (≥ 4,5:1).
 */
function couleurGravite(gravite: Anomalie['gravite']): string {
  if (gravite === 'haute') return '#c2410c';
  if (gravite === 'moyenne') return '#b45309';
  return '#5b6a80';
}

/** Rejoue l'animation d'échange sur un élément : retrait, reflow forcé, ajout. */
function echanger(el: HTMLElement): void {
  el.classList.remove('echangera');
  void el.offsetWidth;
  el.classList.add('echangera');
}

/* ------------------------------------------------------------------ Télémétrie */

export function rendreTelemetrie(t: Telemetrie): void {
  /**
   * Écrit la valeur et ne la fait clignoter que si elle change réellement : les grandeurs
   * continues (cap, vitesse, altitude) se rafraîchissent à chaque image et ne doivent pas
   * animer, sous peine de clignotement permanent.
   */
  const set = (id: string, valeur: string, animer = false) => {
    const el = $(id);
    if (!el || el.textContent === valeur) return;
    el.textContent = valeur;
    if (animer) echanger(el);
  };

  set('m-mode', t.mode, true);
  set('m-etape', t.etapeLabel, true);
  set('m-cap', `${Math.round(t.capDeg)}°`);
  set('m-vitesse', `${t.vitesseMs.toFixed(1)} m/s`);
  set('m-altitude', `${t.altM} m`);
  set('m-temps', mmss(t.tempsVolS));
  set('m-parcouru', `${(t.parcouruM / 1000).toFixed(2)} km`);
  set('m-restant', `${(t.restantM / 1000).toFixed(2)} km`);
  set('m-batterie', `${t.batteriePct.toFixed(0)} %`, true);

  const jauge = $('jauge-batterie');
  if (jauge) {
    jauge.style.width = `${Math.max(0, Math.min(100, t.batteriePct))}%`;
    jauge.classList.toggle('bas', t.batteriePct <= 25);
  }

  // La ligne de liaison porte aussi l'état du retour automatique : plus de bandeau à l'écran,
  // l'information reste là où on la cherche.
  const liaison = $('m-liaison');
  if (liaison) {
    const enRtl = t.mode === 'Retour automatique (RTL)';
    const motif = t.motifRtl === 'batterie' ? 'batterie basse' : 'liaison perdue';
    liaison.textContent = enRtl
      ? `RTL — ${motif} · retour au décollage`
      : t.liaisonOk
        ? 'Liaison télémétrie 915 MHz — MAVLink : nominale'
        : 'Liaison perdue — retour automatique (RTL)';
    liaison.classList.toggle('liaison-perdue', enRtl || !t.liaisonOk);
  }
}

/* ------------------------------------------------------------------ Inspection */

/**
 * Vignette d'inspection.
 *
 * Format serré : le panneau doit tenir entier à l'écran, sans défilement. On ne montre que le
 * canal qui a détecté le défaut — radiométrique ou visible, la vignette parle d'elle-même — et
 * l'identification tient en deux lignes : la référence avec le type, puis la mesure, l'ouvrage
 * et l'horodatage.
 */
function extraitHtml(anomalie: Anomalie, tempsVolS: number): string {
  const couleur = couleurGravite(anomalie.gravite);
  const temperature = anomalie.deltaTC !== undefined ? `ΔT +${anomalie.deltaTC} °C` : 'défaut visuel';
  const image =
    anomalie.canal === 'thermique'
      ? `<div class="img img-thermique" style="--chaud:${couleur}"></div>`
      : `<div class="img img-visible" style="--marque:${couleur}"></div>`;
  return `
    <article class="vignette">
      ${image}
      <div class="vignette-texte">
        <strong>${anomalie.id} · ${anomalie.type}</strong>
        <span class="meta">${temperature} · ${anomalie.pylone} · T+${mmss(tempsVolS)}</span>
      </div>
    </article>`;
}

export function ajouterImageInspection(anomalie: Anomalie, tempsVolS: number): void {
  const flux = $('flux-inspection');
  if (!flux) return;
  const vide = flux.querySelector('.vide');
  if (vide) vide.remove();
  flux.insertAdjacentHTML('beforeend', extraitHtml(anomalie, tempsVolS));
}

/* ------------------------------------------------------------------ Rapport */

export function rendreRapport(anomalies: Anomalie[]): void {
  const liste = $('liste-anomalies');
  const synthese = $('synthese-texte');
  const bouton = $('btn-rapport') as HTMLButtonElement | null;
  if (!liste) return;

  if (anomalies.length === 0) {
    liste.innerHTML = '<p class="vide">Aucune anomalie détectée pour l\'instant.</p>';
  } else {
    const triees = [...anomalies].sort(
      (a, b) => ORDRE_GRAVITE[a.gravite] - ORDRE_GRAVITE[b.gravite],
    );
    liste.innerHTML = triees
      .map(
        (a) => `
      <div class="ligne-anomalie" data-gravite="${a.gravite}">
        <div class="ligne-tete">
          <strong>${a.id} · ${a.type}</strong>
          <span class="etiquette-gravite">${a.gravite}</span>
        </div>
        <p class="defaut">${a.defaut}</p>
        <p class="action">${a.actionCourte}</p>
      </div>`,
      )
      .join('');
  }

  const hautes = anomalies.filter((a) => a.gravite === 'haute').length;
  if (synthese) {
    synthese.textContent =
      anomalies.length === 0
        ? '0 anomalie · tronçon non traité'
        : `${anomalies.length} anomalie${anomalies.length > 1 ? 's' : ''} · ` +
          `${hautes} prioritaire${hautes > 1 ? 's' : ''}`;
  }
  if (bouton) bouton.disabled = anomalies.length === 0;
}

export function reinitialiserPanneau(): void {
  const flux = $('flux-inspection');
  if (flux) flux.innerHTML = '<p class="vide">En attente de la mise en route de la mission…</p>';
  rendreRapport([]);
}

/* ------------------------------------------------------------------ Export */

/** Rapport texte — sert de « livrable » présentable aux équipes CEET. */
export function genererRapportTexte(anomalies: Anomalie[], telemetrie: Telemetrie): string {
  const lignes: string[] = [
    'RAPPORT D’INSPECTION PRÉVENTIVE — RÉSEAU HTA',
    'Équipe Outsiderz · CECFD 2026 · DÉMONSTRATION (données simulées)',
    '',
    `Tronçon simulé : couloir HTA fictif autour de Lomé`,
    `Durée de vol : ${mmss(telemetrie.tempsVolS)} · Distance parcourue : ${(telemetrie.parcouruM / 1000).toFixed(2)} km`,
    `Batterie à l'atterrissage : ${telemetrie.batteriePct.toFixed(0)} %`,
    '',
    `ANOMALIES DÉTECTÉES : ${anomalies.length}`,
    '',
  ];
  for (const a of [...anomalies].sort((x, y) => ORDRE_GRAVITE[x.gravite] - ORDRE_GRAVITE[y.gravite])) {
    lignes.push(
      `${a.id} · ${a.type} — gravité ${a.gravite.toUpperCase()}`,
      `  Ouvrage     : ${a.pylone}`,
      `  Position    : ${a.lat.toFixed(5)} N / ${a.lon.toFixed(5)} E`,
      `  Constat     : ${a.defaut}`,
      `  Action      : ${a.action}`,
      '',
    );
  }
  lignes.push(
    'Note : démonstration sur données simulées. Aucune intervention sur une ligne réelle',
    'sous tension n’est réalisée sans consignation coordonnée avec la CEET.',
  );
  return lignes.join('\n');
}

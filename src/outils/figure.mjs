/**
 * Fig 1 — Drone d'inspection Outsiderz (Holybro X500 V2).
 *
 * Figure isométrique interactive construite avec le kit « anatomy » (kit/iso-kit.mjs).
 *
 * Principe : la géométrie est décrite ici en DONNÉES (plans, anneaux, points du monde)
 * puis sérialisée dans la page. C'est le navigateur qui projette — d'où la rotation
 * libre à la souris, les couleurs par sous-ensemble et le mode annoté.
 *
 * Échelle : 1 unité = 1 cm. Empattement moteur à moteur = 50 unités (500 mm).
 * Hélices 1245 → rayon 15,8 unités.
 *
 * Toutes les valeurs affichées viennent du dossier CECFD de l'équipe Outsiderz :
 * structure 620 g · propulsion 480 g · avionique 120 g · énergie 1 150 g ·
 * charge utile 300 g · calcul embarqué 130 g = 2 800 g.
 */

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "./iso-kit.mjs";
import { kitScript } from "./inline-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

const WIDTH = 700;
const HEIGHT = 430;

/** Masse au décollage, dossier 3.4 : 2 800 g. */
const MASSE_G = 2800;
/** Poussée maximale d'un moteur 2814 KV700 : ≈ 1 250 g. */
const POUSSEE_MOTEUR_G = 1250;

/** Azimut et élévation par défaut. */
const VUE = { azimut: 42, elevation: 26 };
/** Élévations balayées pour calculer un cadre qui tient à toute rotation. */
const ELEVATIONS = [14, 26, 38, 52];
/**
 * Hauteur de la planche, en fraction, sur laquelle tombe le centre du dessin.
 * Un peu sous 0,5 : la masse du drone (châssis, batterie, charge) est dans le bas de sa boîte,
 * et le bandeau du bas ne doit pas la coller au bord.
 */
const BIAIS_VERTICAL = 0.45;
/** Élévations que l'utilisateur peut atteindre. */
const ELEV_MIN = 14;
const ELEV_MAX = 52;
const ZOOM_MIN = 0.7;
const ZOOM_MAX = 2.6;
/** Retrait de la scène en mode annoté, pour loger les colonnes de libellés. */
const RETRAIT_NOTES = 0.56;

/* ------------------------------------------------------------------ Le kit, en direct */

// Ces noms existent aussi comme globales dans la page (kit inliné) : les fonctions
// sérialisées plus bas s'écrivent donc de la même façon des deux côtés.
const {
  iso,
  depthOf,
  pathOf,
  extrude,
  slabOf,
  cylinder,
  onTop,
  haloOf,
  solidSvg,
  lineSvg,
  dotsSvg,
  wireSvg,
  knurl,
  sideArc,
  towardViewer,
} = k;

/* ------------------------------------------------------------------ Géométrie */

/** 4 moteurs sur les diagonales : 2 × 17,68 = 50 unités d'empattement (500 mm). */
const BRAS = 17.68;
const MOTORS = [
  [BRAS, BRAS],
  [-BRAS, BRAS],
  [-BRAS, -BRAS],
  [BRAS, -BRAS],
];

const Z = {
  GEAR: -6.6,
  PLATE: 1.2,
  ARM: 1.2,
  ESC: 2.1,
  STATOR: 2.1,
  BELL: 2.72,
  BELL_TOP: 3.77,
  HUB: 3.72,
  BLADE: 3.95,
  NUT: 4.35,
  STUD: 1.2,
  TOP_PLATE: 6.0,
  BATTERY: 7.2,
  MAST: 7.2,
};

/** Rayon hors tout du dessin : c'est lui qui borne le cadre et les colonnes de libellés. */
const RAYON_MAX = 41.6;

const BOTTOM_PLATE = { x: -9, y: -9, w: 18, d: 18, r: 3.4 };
const TOP_PLATE = { x: -7, y: -7, w: 14, d: 14, r: 3 };
const BATTERY = { x: -4.6, y: -4.6, w: 9.2, d: 9.2, r: 1.4 };
const STUDS = [
  [-5.0, -5.0],
  [5.0, -5.0],
  [5.0, 5.0],
  [-5.0, 5.0],
];
const MAST_AT = [5.2, -5.8];

/** Nacelle : elle pend à l'avant, dans le couloir libre entre les quatre bras. */
const MP = { x: -3.6, y: 1.6, w: 7.2, d: 6.0, r: 1.1 };
const CAM = { x: -2.4, y: 3.0, w: 4.8, d: 4.0, r: 0.85 };
const CAM_YF = CAM.y + CAM.d;

/** Décalage de chaque sous-ensemble en vue éclatée. */
const EXPLODE = {
  train: [0, 0, -7.0],
  charge: [0, 3.2, -3.0],
  calcul: [0, 0, 3.4],
  avionique: [0, 0, 6.0],
  plaques: [0, 0, 9.0],
  batterie: [0, 0, 12.6],
  antenne: [0, 0, 12.2],
};
const EXPLODE_MOTEUR = 5.6;
const EXPLODE_HELICE = 6.6;
const EXPLODE_ECART = 7.4;
const EXPLODE_ECART_HELICE = 10.6;
const EXPLODE_BRAS_Z = 1.0;
const EXPLODE_BRAS_XY = 4.4;

/* ------------------------------------------------------------------ Couleurs */

/**
 * Une teinte par sous-ensemble du dossier 3.4.
 *
 * Retune sur le système : la structure est la plus sourde (elle tient tout, elle n'a pas à
 * parler fort), le calcul et la charge utile sont les plus vives — la charge utile porte
 * l'orange du système, c'est elle qui justifie le vol.
 */
const TEINTES = {
  structure: "#6b7a99",
  propulsion: "#e0961a",
  avionique: "#3b7bf0",
  energie: "#12a08a",
  calcul: "#8b5cf6",
  charge: "#ff4105",
};

const versRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const versHex = (c) => "#" + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
const melange = (fond, teinte, part) => {
  const a = versRgb(fond);
  const b = versRgb(teinte);
  return versHex(a.map((v, i) => v + (b[i] - v) * part));
};

/** Neuf nuances par teinte : le kit n'en consomme que ces variables-là. */
function nuances(teinte) {
  // Feuille de papier : les pièces sont des aplats clairs, les ombres se creusent en gris coloré.
  return {
    "--anatomy-paper": melange("#fbfbfa", teinte, 0.44),
    "--anatomy-face": melange("#ffffff", teinte, 0.5),
    "--anatomy-top": melange("#ffffff", teinte, 0.56),
    "--anatomy-lit-top": melange("#ffffff", teinte, 0.66),
    "--anatomy-lit-shade": melange("#eeeeeb", teinte, 0.64),
    "--anatomy-shade-0": melange("#dcdcd9", teinte, 0.96),
    "--anatomy-shade-1": melange("#e5e5e2", teinte, 0.84),
    "--anatomy-shade-2": melange("#ededea", teinte, 0.72),
    "--anatomy-shade-3": melange("#f4f4f1", teinte, 0.6),
  };
}

const REGLES_TEINTES = Object.entries(TEINTES)
  .map(([nom, teinte]) => {
    const vars = Object.entries(nuances(teinte))
      .map(([cle, valeur]) => `${cle}:${valeur}`)
      .join(";");
    return `[data-tint="${nom}"]{${vars}}`;
  })
  .join("\n");

/* ------------------------------------------------------------------ Description de scène */

let OUT = null;
const emit = (piece) => OUT.push(piece);

const centre = (ring) => {
  let x = 0;
  let y = 0;
  for (const [px, py] of ring) {
    x += px;
    y += py;
  }
  return [x / ring.length, y / ring.length];
};
const moyenne = (points) => {
  let x = 0;
  let y = 0;
  let z = 0;
  for (const p of points) {
    x += p[0];
    y += p[1];
    z += p[2];
  }
  return [x / points.length, y / points.length, z / points.length];
};

/** Boîte à angles arrondis, extrudée. */
const boite = (plan, z, h, st, steps = 5, bevel = 0.25) =>
  emit({ k: "slab", plan, z, h, s: steps, b: bevel, st, a: [...centre(k.ringOf(plan, steps)), z + h / 2] });

/** Barreau : rectangle à extrémités arrondies, d'un point à un autre du plan. */
function stadium(a, b, width) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const angle = Math.atan2(dy, dx);
  const r = width / 2;
  const cap = 6;
  const out = [];
  for (let i = 0; i <= cap; i++) {
    const t = angle - Math.PI * (i / cap);
    out.push([b[0] + r * Math.cos(t), b[1] + r * Math.sin(t)]);
  }
  for (let i = 0; i <= cap; i++) {
    const t = angle + Math.PI - Math.PI * (i / cap);
    out.push([a[0] + r * Math.cos(t), a[1] + r * Math.sin(t)]);
  }
  return out;
}
const barre = (a, b, w, z0, h, st, bevel = 0.3) => {
  const ring = stadium(a, b, w);
  emit({ k: "solid", ring, z: z0, h, o: { convex: true, bevel }, st, a: [...centre(ring), z0 + h / 2] });
};

/** Cylindre vertical. */
const cyl = (cx, cy, r, z, h, st, steps = 20, bevel = 0.2) =>
  emit({ k: "cyli", cx, cy, r, z, h, s: steps, b: bevel, st, a: [cx, cy, z + h / 2] });

/** Contour tracé sur une face horizontale (z constant). */
const lig = (points, z, st, closed = false) =>
  emit({ k: "surf", p: points, z, c: closed, st, a: [moyenne(points.map(([x, y]) => [x, y, z]))[0], moyenne(points.map(([x, y]) => [x, y, z]))[1], z] });

/** Cercle tracé sur une face verticale : plan y = constante, ou plan x = constante. */
const cercleY = (cx, y, cz, r, st, steps = 24) => emit({ k: "arcY", cx, y, cz, r, s: steps, st, a: [cx, y, cz] });
const cercleX = (x, cy, cz, r, st, steps = 24) => emit({ k: "arcX", x, cy, cz, r, s: steps, st, a: [x, cy, cz] });

/** Câble entre deux points du monde. */
const cable = (from, to, st) =>
  emit({ k: "fil", from, to, st, a: [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2] });

/** Pastilles. */
const pastilles = (points, st) => emit({ k: "dot", p: points, st, a: moyenne(points) });

/** Hachures fines sur un fût cylindrique. */
const molette = (cx, cy, r, z0, z1, n, st, zAncre) =>
  emit({ k: "knurl", cx, cy, r, z0, z1, n, st, a: [cx, cy, zAncre ?? (z0 + z1) / 2] });
/** Arc de face sur un fût cylindrique. */
const arcFace = (cx, cy, r, z, n, st, zAncre) => emit({ k: "sideArc", cx, cy, r, z, n, st, a: [cx, cy, zAncre ?? z] });

/** Ombre douce sous une pièce. */
const ombre = (plan, z, h) => emit({ k: "halo", plan, z, h, a: [...centre(k.ringOf(plan, 5)), z + h / 2] });

/* ------------------------------------------------------------------ Sous-ensembles
 * `niveau` fixe l'ordre de dessin (du bas vers le haut) ; la nacelle est la seule
 * à changer de niveau selon la rotation, puisque c'est la pièce la plus proche
 * du spectateur quand on regarde l'appareil de face.
 */

const SCENE = [];
const peintures = [];

function groupe(id, niveau, e, teinte, dessine) {
  OUT = [];
  dessine();
  const pieces = OUT;
  const vars = Object.entries(nuances(TEINTES[teinte]))
    .map(([cle, valeur]) => `${cle}:${valeur}`)
    .join(";");
  SCENE.push({ id, niveau, e, tint: teinte, vars, pieces, a: moyenne(pieces.map((p) => p.a)) });
}

/* --- Train d'atterrissage ------------------------------------------------ */

groupe("train", 0, EXPLODE.train, "structure", () => {
  for (const x of [-6.9, 6.9]) {
    barre([x, -7.4], [x, 7.4], 1.6, Z.GEAR, 1.0, { tone: "mid" });
    for (const y of [-4.6, 4.6]) {
      cyl(x, y, 0.55, -5.9, 7.0, { tone: "mid", crease: "none" }, 14);
      pastilles([[x, y, -6.05]], { size: 0.4, tone: "lo" });
    }
    for (const y of [-7.0, 7.0]) {
      cyl(x, y, 0.95, Z.GEAR - 0.1, 0.95, { tone: "mid" }, 18);
      pastilles([[x, y, Z.GEAR + 0.85]], { size: 0.36, tone: "lo" });
    }
  }
});

/* --- Charge utile (300 g) : la raison d'être de l'appareil ---------------- */

groupe("charge", 5, EXPLODE.charge, "charge", () => {
  ombre(MP, -1.7, 0.8);
  // Quatre silentblocs découplent la nacelle de la cellule.
  for (const [x, y] of k.corners(MP, 1.3)) {
    cyl(x, y, 0.5, -0.9, 0.9, { tone: "mid" }, 14, 0.1);
    pastilles([[x, y, 0]], { size: 0.36, tone: "lo" });
  }
  boite(MP, -1.7, 0.8, { tone: "mid" }, 4, 0.22);
  lig(k.ringOf(k.insetPlan(MP, 0.8), 4), -0.9, { tone: "faint" }, true);
  // Flasques : moteur de roulis à gauche, moteur de tangage à droite.
  for (const x of [-3.15, 3.15]) {
    boite({ x: x - 0.32, y: 3.4, w: 0.64, d: 2.6, r: 0.26 }, -5.0, 3.3, { tone: "mid" }, 2, 0.18);
  }
  cyl(-2.9, 5.2, 1.0, -5.0, 1.5, { tone: "mid" }, 20, 0.15);
  molette(-2.9, 5.2, 1.0, -4.8, -3.6, 20, { tone: "lo" }, -4.2);
  cyl(2.9, 5.2, 0.9, -4.8, 1.3, { tone: "mid" }, 20, 0.15);
  molette(2.9, 5.2, 0.9, -4.6, -3.6, 20, { tone: "lo" }, -4.1);
  // Corps bi-capteur : la pièce mise en avant.
  boite(CAM, -5.6, 2.0, { tone: "hi", crease: "lo", lit: true }, 4, 0.3);
  // Face avant : FLIR Lepton 3.5 (160 × 120, radiométrique) et caméra RGB HD.
  cercleY(-1.1, CAM_YF + 0.03, -4.6, 0.92, { tone: "lit", si: "y" });
  cercleY(-1.1, CAM_YF + 0.03, -4.6, 0.44, { tone: "lit", si: "y" });
  pastilles([[-1.1, CAM_YF + 0.03, -4.6]], { size: 0.3, tone: "hi" });
  cercleY(1.2, CAM_YF + 0.03, -4.72, 0.54, { tone: "lit", si: "y" });
  cercleY(1.2, CAM_YF + 0.03, -4.72, 0.24, { tone: "lit", si: "y" });
  pastilles([[1.2, CAM_YF + 0.03, -4.72]], { size: 0.24, tone: "hi" });
  // Face côté : prise de la charge utile.
  cercleX(CAM.x + CAM.w + 0.03, 5.0, -4.6, 0.46, { tone: "faint", si: "x" });
  cable([1.7, 5.6, -3.6], [3.4, 2.6, -1.2], { tone: "faint", size: 0.5, ends: "to" });
});

/* --- Châssis : plaque inférieure ----------------------------------------- */

groupe("plaque-basse", 10, [0, 0, 0], "structure", () => {
  ombre(BOTTOM_PLATE, 0, 1.2);
  boite(BOTTOM_PLATE, 0, 1.2, { tone: "mid" }, 5, 0.3);
  lig(k.ringOf(k.insetPlan(BOTTOM_PLATE, 1.4), 5), Z.PLATE, { tone: "faint" }, true);
  for (const [x, y] of k.corners({ x: -6.4, y: -6.4, w: 12.8, d: 12.8 })) {
    lig(k.circleRing(x, y, 1.15, 14), Z.PLATE, { tone: "faint" }, true);
    pastilles([[x, y, Z.PLATE]], { size: 0.36, tone: "mid" });
  }
  for (const [x, y] of k.corners(BOTTOM_PLATE, 1.4)) {
    pastilles([[x, y, Z.PLATE]], { size: 0.3, tone: "lo" });
  }
});

/* --- Calcul embarqué (130 g) ---------------------------------------------- */

groupe("calcul", 20, EXPLODE.calcul, "calcul", () => {
  const board = { x: -8.6, y: -4.2, w: 5.6, d: 8.4, r: 0.6 };
  cable([board.x + board.w - 0.2, -1.4, Z.PLATE + 0.32], [0.4, -0.6, Z.PLATE + 0.9], { tone: "lo", size: 0.7, dashed: true });
  boite(board, Z.PLATE, 0.32, { tone: "hi" }, 3, 0);
  lig(k.ringOf(k.insetPlan(board, 0.7), 5), Z.PLATE + 0.32, { tone: "faint" }, true);
  for (const y of [-3.0, -1.7]) {
    boite({ x: board.x - 0.9, y, w: 1.0, d: 1.0, r: 0.18 }, Z.PLATE, 0.6, { tone: "mid" }, 2, 0.08);
    pastilles([[board.x - 0.4, y + 0.5, Z.PLATE + 0.6]], { size: 0.24, tone: "lo" });
  }
  boite({ x: board.x - 1.1, y: 0.6, w: 1.2, d: 1.3, r: 0.18 }, Z.PLATE, 0.68, { tone: "mid" }, 2, 0.08);
  pastilles([[board.x - 0.5, 1.25, Z.PLATE + 0.68]], { size: 0.24, tone: "lo" });
  boite({ x: board.x - 0.5, y: -4.0, w: 0.7, d: 0.8, r: 0.15 }, Z.PLATE, 0.5, { tone: "mid" }, 2, 0.08);
  // Dissipateur.
  boite({ x: -6.5, y: 1.6, w: 2.4, d: 2.4, r: 0.3 }, Z.PLATE + 0.32, 0.35, { tone: "mid" }, 2, 0.08);
  for (let i = 0; i < 5; i++) {
    lig([[-6.2, 1.9 + i * 0.45], [-4.4, 1.9 + i * 0.45]], Z.PLATE + 0.67, { tone: "faint" });
  }
  for (const [x, y] of k.corners(board, 0.9)) {
    cyl(x, y, 0.26, Z.PLATE, 0.32, { tone: "mid" }, 10, 0);
  }
  pastilles([[board.x + 4.6, board.y + 1.5, Z.PLATE + 0.32]], { size: 0.38, tone: "hi", pulse: true });
});

/* --- Avionique (120 g) ---------------------------------------------------- */

groupe("avionique", 20, EXPLODE.avionique, "avionique", () => {
  // Pixhawk 6C : ArduPilot, RTL natif, fail-safe et geofence.
  const fcu = { x: -2.2, y: -2.2, w: 8.4, d: 4.4, r: 0.7 };
  boite(fcu, Z.PLATE, 1.7, { tone: "hi" }, 4, 0.25);
  lig(k.ringOf(k.insetPlan(fcu, 0.7), 4), Z.PLATE + 1.7, { tone: "faint" }, true);
  for (const dx of [0.9, 2.1, 3.3]) {
    lig([[fcu.x + 0.8 + dx, fcu.y + 1.1], [fcu.x + 0.8 + dx, fcu.y + 3.3]], Z.PLATE + 1.7, { tone: "lo" });
  }
  lig(k.circleRing(fcu.x + 1.9, fcu.y + 3.1, 0.85, 20), Z.PLATE + 1.7, { tone: "mid" }, true);
  lig(k.circleRing(fcu.x + 1.9, fcu.y + 3.1, 0.42, 16), Z.PLATE + 1.7, { tone: "faint" }, true);
  pastilles([[fcu.x + 1.9, fcu.y + 3.1, Z.PLATE + 1.7]], { size: 0.3, tone: "hi" });
  for (const dx of [6.6, 7.6]) {
    cyl(fcu.x + dx, fcu.y + 0.9, 0.42, Z.PLATE + 1.7, 0.35, { tone: "mid" }, 14, 0.08);
    pastilles([[fcu.x + dx, fcu.y + 0.9, Z.PLATE + 2.05]], { size: 0.3, tone: "mid" });
  }
  // Télémétrie SiK 915 MHz, protocole MAVLink, et son antenne.
  const sik = { x: 3.2, y: -8.0, w: 3.4, d: 2.4, r: 0.5 };
  boite(sik, Z.PLATE, 1.0, { tone: "mid" }, 3, 0.2);
  lig(k.ringOf(k.insetPlan(sik, 0.6), 3), Z.PLATE + 1.0, { tone: "faint" }, true);
  cable([sik.x + 1.1, sik.y + 1.2, Z.PLATE + 1.0], [2.6, -6.2, Z.PLATE + 5.6], { tone: "lo", size: 0.5, ends: "to" });
  pastilles([[2.6, -6.2, Z.PLATE + 5.6]], { size: 0.38, tone: "hi" });
  // Récepteur ELRS 2,4 GHz : pilotage manuel de secours.
  const elrs = { x: 5.2, y: 4.6, w: 2.0, d: 1.4, r: 0.4 };
  boite(elrs, Z.PLATE, 0.55, { tone: "mid" }, 3, 0.15);
  cable([elrs.x + 1.0, elrs.y + 0.7, Z.PLATE + 0.55], [6.8, 7.2, Z.PLATE + 3.2], { tone: "faint", size: 0.4, ends: "to" });
  // Module d'alimentation et connecteur XT60.
  boite({ x: 5.4, y: 1.0, w: 3.0, d: 2.2, r: 0.4 }, Z.PLATE, 0.65, { tone: "mid" }, 3, 0.15);
  boite({ x: 5.9, y: 3.4, w: 1.8, d: 0.9, r: 0.2 }, Z.PLATE, 0.8, { tone: "mid" }, 2, 0.1);
  pastilles([[6.8, 3.85, Z.PLATE + 0.8]], { size: 0.26, tone: "lo" });
  // Interrupteur de sécurité matériel et buzzer.
  boite({ x: -8.4, y: 5.8, w: 1.7, d: 1.7, r: 0.35 }, Z.PLATE, 0.5, { tone: "mid" }, 2, 0.12);
  cyl(-5.9, 7.1, 0.75, Z.PLATE, 0.7, { tone: "mid" }, 18, 0.15);
  lig(k.circleRing(-5.9, 7.1, 0.4, 14), Z.PLATE + 0.7, { tone: "faint" }, true);
});

/* --- Bras et ESC (dans les 480 g de propulsion) --------------------------- */

for (let index = 0; index < 4; index++) {
  const [mx, my] = MOTORS[index];
  const sx = Math.sign(mx);
  const sy = Math.sign(my);
  const ux = sx * Math.SQRT1_2;
  const uy = sy * Math.SQRT1_2;
  const root = [7.2 * sx, 7.2 * sy];
  const mid = [(root[0] + mx) / 2, (root[1] + my) / 2];
  const from = [mid[0] - ux * 2.0, mid[1] - uy * 2.0];
  const to = [mid[0] + ux * 2.0, mid[1] + uy * 2.0];
  groupe(`bras${index}`, 25, [sx * EXPLODE_BRAS_XY, sy * EXPLODE_BRAS_XY, EXPLODE_BRAS_Z], "propulsion", () => {
    barre(root, [mx, my], 3.2, Z.ARM, 0.9, { tone: "mid" }, 0.35);
    barre([root[0] - ux * 0.9, root[1] - uy * 0.9], [root[0] + ux * 1.5, root[1] + uy * 1.5], 4.1, Z.ARM, 1.15, { tone: "mid" }, 0.3);
    pastilles([[root[0] + ux * 1.1, root[1] + uy * 1.1, Z.ARM + 1.15]], { size: 0.36, tone: "mid" });
    // ESC 30 A posé sur le bras.
    barre(from, to, 2.2, Z.ESC, 0.55, { tone: "mid" }, 0.18);
    lig([from, to], Z.ESC + 0.55, { tone: "faint" });
    for (const side of [-0.42, 0, 0.42]) {
      const px = -uy * side;
      const py = ux * side;
      cable([from[0] + px, from[1] + py, Z.ESC + 0.2], [mx + px * 0.7, my + py * 0.7, Z.STATOR + 0.25], {
        tone: "lo",
        size: 0.32,
      });
    }
  });
}

/* --- Moteurs 2814 KV700, hélices 1245, écrous ----------------------------- */

for (let index = 0; index < 4; index++) {
  const [mx, my] = MOTORS[index];
  const sx = Math.sign(mx);
  const sy = Math.sign(my);
  groupe(`moteur${index}`, 30, [sx * EXPLODE_ECART, sy * EXPLODE_ECART, EXPLODE_MOTEUR], "propulsion", () => {
    cyl(mx, my, 2.7, Z.ARM + 0.9, 0.3, { tone: "mid" }, 24);
    cyl(mx, my, 2.55, Z.STATOR, 0.62, { tone: "mid" }, 28, 0.18);
    cyl(mx, my, 2.45, Z.BELL, 1.05, { tone: "mid", crease: "lo" }, 30, 0.2);
    molette(mx, my, 2.45, Z.BELL + 0.12, Z.BELL_TOP - 0.12, 44, { tone: "faint" }, (Z.BELL + Z.BELL_TOP) / 2);
    arcFace(mx, my, 2.45, Z.BELL + 0.5, 22, { tone: "faint" }, (Z.BELL + Z.BELL_TOP) / 2);
    cyl(mx, my, 0.55, Z.BELL_TOP, 0.22, { tone: "mid" }, 14);
  });
  groupe(`prop${index}`, 35, [sx * EXPLODE_ECART_HELICE, sy * EXPLODE_ECART_HELICE, EXPLODE_HELICE], "propulsion", () => {
    emit({ k: "prop", mx, my, base: Math.atan2(my, mx), a: [mx, my, Z.HUB + 0.2] });
  });
  groupe(`ecrou${index}`, 36, [sx * EXPLODE_ECART_HELICE, sy * EXPLODE_ECART_HELICE, EXPLODE_HELICE], "propulsion", () => {
    cyl(mx, my, 0.82, Z.NUT, 0.5, { tone: "mid" }, 18, 0.12);
    molette(mx, my, 0.82, Z.NUT + 0.05, Z.NUT + 0.45, 14, { tone: "faint" });
    pastilles([[mx, my, Z.NUT + 0.5]], { size: 0.32, tone: "hi" });
  });
}

/* --- Plaque supérieure, entretoises, GPS ---------------------------------- */

groupe("plaques", 40, EXPLODE.plaques, "structure", () => {
  for (const [x, y] of STUDS) {
    cyl(x, y, 0.62, Z.STUD, Z.TOP_PLATE - Z.STUD, { tone: "mid", crease: "none" }, 16, 0.18);
    arcFace(x, y, 0.62, Z.TOP_PLATE - 3.0, 12, { tone: "faint" }, (Z.STUD + Z.TOP_PLATE) / 2);
    pastilles([[x, y, Z.TOP_PLATE]], { size: 0.32, tone: "lo" });
  }
  boite(TOP_PLATE, Z.TOP_PLATE, 1.2, { tone: "mid" }, 5, 0.3);
  lig(k.ringOf(k.insetPlan(TOP_PLATE, 1.3), 5), Z.TOP_PLATE + 1.2, { tone: "faint" }, true);
  for (const [x, y] of k.corners(TOP_PLATE, 1.9)) {
    lig(k.circleRing(x, y, 1.0, 12), Z.TOP_PLATE + 1.2, { tone: "faint" }, true);
    pastilles([[x, y, Z.TOP_PLATE + 1.2]], { size: 0.32, tone: "mid" });
  }
  // Plaque de marque gravée : trois filets, aucun mot dans le dessin.
  const marque = { x: -5.6, y: 3.2, w: 11.2, d: 2.8, r: 0.6 };
  boite(marque, Z.TOP_PLATE + 1.2, 0.28, { tone: "mid", crease: "none" }, 3, 0);
  for (let i = 0; i < 3; i++) {
    const inset = i * 0.85;
    lig(
      [
        [marque.x + 1.0 + inset, marque.y + 0.7 + i * 0.7],
        [marque.x + marque.w - 1.0 - inset, marque.y + 0.7 + i * 0.7],
      ],
      Z.TOP_PLATE + 1.48,
      { tone: i === 0 ? "mid" : "faint" },
    );
  }
});

groupe("antenne", 45, EXPLODE.antenne, "avionique", () => {
  const [x, y] = MAST_AT;
  cyl(x, y, 1.6, Z.MAST, 0.5, { tone: "mid" }, 18, 0.15);
  cyl(x, y, 0.5, Z.MAST, 6.9, { tone: "mid", crease: "none" }, 16, 0.15);
  arcFace(x, y, 0.5, Z.MAST + 3.4, 12, { tone: "faint" }, Z.MAST + 3.4);
  cyl(x, y, 2.5, Z.MAST + 6.9, 0.85, { tone: "hi" }, 32, 0.25);
  molette(x, y, 2.5, Z.MAST + 7.0, Z.MAST + 7.6, 40, { tone: "faint" }, Z.MAST + 7.3);
  lig(k.circleRing(x, y, 1.5, 24), Z.MAST + 7.75, { tone: "lo" }, true);
  pastilles([[x, y, Z.MAST + 7.75]], { size: 0.34, tone: "mid" });
});

/* --- Énergie (1 150 g) ---------------------------------------------------- */

groupe("batterie", 50, EXPLODE.batterie, "energie", () => {
  ombre(BATTERY, Z.BATTERY, 2.2);
  boite(BATTERY, Z.BATTERY, 2.2, { tone: "hi" }, 5, 0.35);
  for (let ix = 0; ix < 4; ix++) {
    for (let iy = 0; iy < 4; iy++) {
      lig(
        k.circleRing(BATTERY.x + 1.35 + ix * 2.17, BATTERY.y + 1.35 + iy * 2.17, 0.86, 18),
        Z.BATTERY + 2.2,
        { tone: "faint" },
        true,
      );
    }
  }
  lig(k.ringOf(k.insetPlan(BATTERY, 0.9), 5), Z.BATTERY + 2.2, { tone: "lo" }, true);
  boite({ x: BATTERY.x + 2.0, y: BATTERY.y - 0.8, w: 4.0, d: 1.6, r: 0.3 }, Z.BATTERY + 2.2, 0.5, { tone: "mid" }, 2, 0.1);
  for (let i = 0; i < 5; i++) {
    pastilles([[BATTERY.x + 2.4 + i * 0.8, BATTERY.y, Z.BATTERY + 2.7]], { size: 0.26, tone: "mid" });
  }
  for (const y of [-2.6, 2.6]) {
    const sangle = { x: BATTERY.x - 0.5, y: y - 0.75, w: BATTERY.w + 1.0, d: 1.5, r: 0.3 };
    boite(sangle, Z.BATTERY, 2.9, { tone: "mid", crease: "none" }, 2, 0.2);
    lig(k.ringOf(sangle, 2), Z.BATTERY + 2.9, { tone: "faint" }, true);
    pastilles([[BATTERY.x + 0.6, y, Z.BATTERY + 1.5]], { size: 0.34, tone: "lo" });
  }
  cable([BATTERY.x + 1.2, BATTERY.y - 0.3, Z.BATTERY], [5.6, 1.6, Z.PLATE + 0.7], { tone: "lo", size: 0.7 });
});

/* ------------------------------------------------------------------ Cadrage
 * La caméra tourne : le cadre doit tenir la pièce à toutes les élévations.
 * On calcule donc l'enveloppe de révolution de chaque point extrême.
 */

const EXTREMES = [];
const extreme = (p, e) => EXTREMES.push([p, e]);

for (const corner of k.boxCorners({ x: -9.3, y: -9.2, w: 18.6, d: 18.4 }, Z.GEAR - 0.1, Z.GEAR + 1.0)) extreme(corner, EXPLODE.train);
for (const corner of k.boxCorners({ x: MP.x - 0.2, y: MP.y - 0.2, w: MP.w + 0.4, d: MP.d + 0.4 }, -5.9, 0)) extreme(corner, EXPLODE.charge);
for (const corner of k.boxCorners(BOTTOM_PLATE, 0, 1.2)) extreme(corner, [0, 0, 0]);
for (const corner of k.boxCorners(BATTERY, Z.BATTERY, Z.BATTERY + 2.9)) extreme(corner, EXPLODE.batterie);
for (const corner of k.boxCorners(TOP_PLATE, Z.TOP_PLATE, Z.TOP_PLATE + 1.2)) extreme(corner, EXPLODE.plaques);
for (const [mx, my] of MOTORS) {
  const sx = Math.sign(mx);
  const sy = Math.sign(my);
  for (const spin of [0.2, 0.8, 1.4, 2.0, 2.6, 3.2, 3.8, 4.4, 5.0, 5.6]) {
    for (const side of [0, Math.PI]) {
      const a = Math.atan2(my, mx) + spin + side;
      for (const [r, z] of [[15.8, Z.BLADE], [15.8, Z.BLADE + 0.42], [2.8, Z.HUB]]) {
        extreme([mx + r * Math.cos(a), my + r * Math.sin(a), z], [
          sx * EXPLODE_ECART_HELICE,
          sy * EXPLODE_ECART_HELICE,
          EXPLODE_HELICE,
        ]);
      }
    }
  }
}
extreme([MAST_AT[0], MAST_AT[1], Z.MAST + 6.9], EXPLODE.antenne);
extreme([MAST_AT[0], MAST_AT[1], Z.MAST + 7.75], EXPLODE.antenne);
for (const [x, y] of STUDS) extreme([x, y, Z.TOP_PLATE], EXPLODE.plaques);

const ecarte = ([p, e]) => [p[0] + e[0], p[1] + e[1], p[2] + e[2]];
const POINTS = EXTREMES.map(([p]) => p);
const POINTS_APART = EXTREMES.map(ecarte);

/**
 * Cadre qui reste juste quelle que soit la rotation autour de l'axe vertical.
 * Pour un point de rayon r et de hauteur z, la projection balaie un segment de
 * largeur 2r et, sur toute la plage d'élévation, de hauteur r·sinE + z·cosE.
 */
function cadreRobuste(points, width, height) {
  let left = Infinity;
  let right = -Infinity;
  let up = Infinity;
  let down = -Infinity;
  for (const [x, y, z] of points) {
    const r = Math.hypot(x, y);
    left = Math.min(left, -r);
    right = Math.max(right, r);
    for (const elevation of ELEVATIONS) {
      const e = (elevation * Math.PI) / 180;
      up = Math.min(up, -r * Math.sin(e) - z * Math.cos(e));
      down = Math.max(down, r * Math.sin(e) - z * Math.cos(e));
    }
  }
  const marge = 16;
  const scale = Math.min((width - marge * 2) / (right - left), (height - marge * 2) / (down - up));

  // Le cadre robuste prévoit le mât à toutes les élévations : la boîte réellement dessinée à la
  // pose de référence est plus petite, et son centre tombe ailleurs. On cale donc le vertical sur
  // cette boîte-là — l'échelle reste celle du cadre robuste, la figure ne change pas de taille en
  // tournant. L'horizontale, elle, garde le centre symétrique du cadre : elle doit rester fixe
  // pendant la rotation d'ouverture.
  const a = (VUE.azimut * Math.PI) / 180;
  const e = (VUE.elevation * Math.PI) / 180;
  const sinA = Math.sin(a);
  const cosA = Math.cos(a);
  const sinE = Math.sin(e);
  const cosE = Math.cos(e);
  let haut = Infinity;
  let bas = -Infinity;
  for (const [x, y, z] of points) {
    const v = (x * cosA + y * sinA) * sinE - z * cosE;
    haut = Math.min(haut, v);
    bas = Math.max(bas, v);
  }

  return {
    origin: [
      width / 2 - ((left + right) / 2) * scale,
      height * BIAIS_VERTICAL - ((haut + bas) / 2) * scale,
    ],
    scale,
    azimuth: VUE.azimut,
    elevation: VUE.elevation,
  };
}

const CADRE = cadreRobuste(POINTS, WIDTH, HEIGHT);
const CADRE_APART = cadreRobuste(POINTS_APART, WIDTH, HEIGHT);

/* ------------------------------------------------------------------ Annotations */

const NOTES = [
  { g: "plaque-basse", a: [-6.4, -6.4, 1.3], t: "Châssis Holybro X500 V2" },
  { g: "bras0", a: [12.0, 12.0, 2.6], t: "Bras + ESC 30 A" },
  { g: "moteur2", a: [-17.68, -17.68, 3.2], t: "Moteur 2814 KV700" },
  { g: "prop1", a: [-17.68, 17.68, 4.2], t: "Hélice 1245" },
  { g: "train", a: [-6.9, 0, -6.4], t: "Train d'atterrissage" },
  { g: "batterie", a: [-4.6, 0, 8.4], t: "Batterie Li-ion 4S4P" },
  { g: "batterie", a: [4.6, 0, 8.4], t: "16 Ah · 1 150 g · 41 %" },
  { g: "charge", a: [-3.6, 4.6, -2.4], t: "Nacelle d'orientation" },
  { g: "charge", a: [-1.1, CAM_YF, -4.6], t: "FLIR Lepton 3.5" },
  { g: "charge", a: [1.2, CAM_YF, -4.72], t: "160 × 120 radiométrique" },
  { g: "calcul", a: [-6.0, -2.0, 1.6], t: "Raspberry Pi 4 · 130 g" },
  { g: "avionique", a: [-1.0, 0.0, 2.9], t: "Pixhawk 6C · ArduPilot" },
  { g: "avionique", a: [4.6, -7.4, 2.2], t: "SiK 915 MHz · MAVLink" },
  { g: "avionique", a: [6.2, 5.3, 1.8], t: "ELRS 2,4 GHz" },
  { g: "antenne", a: [5.2, -5.8, 14.6], t: "GPS M10" },
  { g: "plaques", a: [0, 4.6, 7.4], t: "Plaque supérieure" },
];

/* ------------------------------------------------------------------ Ordre de peinture
 * Niveau fixe (du bas vers le haut) : c'est la seule hiérarchie qui reste juste à
 * toute rotation pour un objet en couches. La nacelle, elle, est la pièce la plus
 * basse et la plus avancée : elle passe devant dès qu'elle est plus proche que la
 * cellule, et derrière sinon.
 */

const ANCRE = {};
const NIVEAU = {};
const DECALAGE = {};
for (const item of SCENE) {
  ANCRE[item.id] = item.a;
  NIVEAU[item.id] = item.niveau;
  DECALAGE[item.id] = item.e;
}

function ordreScene(P, apart) {
  const vers = (id) => [
    ANCRE[id][0] + DECALAGE[id][0] * apart,
    ANCRE[id][1] + DECALAGE[id][1] * apart,
    ANCRE[id][2] + DECALAGE[id][2] * apart,
  ];
  const devant = depthOf(vers("charge"), P) > depthOf(vers("plaque-basse"), P);
  return SCENE.map((item, index) => ({
    item,
    index,
    niveau: item.id === "charge" ? (devant ? 90 : -1) : NIVEAU[item.id],
  })).sort((a, b) => a.niveau - b.niveau || a.index - b.index);
}

/* ------------------------------------------------------------------ Rendu
 * Ces fonctions partent telles quelles dans la page : elles n'utilisent que le kit.
 */

function propSvg(mx, my, base, spin, P) {
  const R = 15.8;
  const stations = [
    [1.35, 0.5],
    [4.5, 1.14],
    [8.8, 1.32],
    [12.6, 1.02],
    [R, 0.52],
  ];
  const out = [solidSvg(cylinder(mx, my, 1.35, 3.72, 0.78, P, 24, 0.12), { tone: "hi" })];
  for (const side of [0, Math.PI]) {
    const a = base + spin + side;
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    const nx = -uy;
    const ny = ux;
    const ring = [];
    for (const [r, h] of stations) ring.push([mx + ux * r + nx * h, my + uy * r + ny * h]);
    for (let i = stations.length - 1; i >= 0; i--) {
      const [r, h] = stations[i];
      ring.push([mx + ux * r - nx * h, my + uy * r - ny * h]);
    }
    out.push(solidSvg(extrude(ring, 3.95, 0.42, P, { convex: true, bevel: 0.12 }), { tone: "hi", crease: "lo" }));
    const tx = mx + ux * (R - 2.1);
    const ty = my + uy * (R - 2.1);
    out.push(lineSvg(onTop([[tx - ny * 0.85, ty + nx * 0.85], [tx + ny * 0.85, ty - nx * 0.85]], 4.37, P), { tone: "lit" }));
  }
  return out.join("");
}

function pieceSvg(piece, P, spin) {
  switch (piece.k) {
    case "slab":
      return solidSvg(slabOf(piece.plan, piece.z, piece.h, P, piece.s, piece.b), piece.st);
    case "solid":
      return solidSvg(extrude(piece.ring, piece.z, piece.h, P, piece.o), piece.st);
    case "cyli":
      return solidSvg(cylinder(piece.cx, piece.cy, piece.r, piece.z, piece.h, P, piece.s, piece.b), piece.st);
    case "surf":
      return lineSvg(onTop(piece.p, piece.z, P, piece.c), piece.st);
    case "fil":
      return wireSvg(iso(piece.from, P), iso(piece.to, P), piece.st);
    case "dot":
      return dotsSvg(piece.p.map((q) => iso(q, P)), piece.st);
    case "halo":
      return '<path class="iso-halo" d="' + haloOf(piece.plan, piece.z, piece.h, P) + '"/>';
    case "arcY": {
      const pts = [];
      for (let i = 0; i < piece.s; i++) {
        const a = (i / piece.s) * Math.PI * 2;
        pts.push([piece.cx + piece.r * Math.cos(a), piece.y, piece.cz + piece.r * Math.sin(a)]);
      }
      return lineSvg(pathOf(pts.map((q) => iso(q, P)), true), piece.st);
    }
    case "arcX": {
      const pts = [];
      for (let i = 0; i < piece.s; i++) {
        const a = (i / piece.s) * Math.PI * 2;
        pts.push([piece.x, piece.cy + piece.r * Math.cos(a), piece.cz + piece.r * Math.sin(a)]);
      }
      return lineSvg(pathOf(pts.map((q) => iso(q, P)), true), piece.st);
    }
    case "knurl":
      return lineSvg(knurl(piece.cx, piece.cy, piece.r, piece.z0, piece.z1, piece.n, P), piece.st);
    case "sideArc":
      return lineSvg(sideArc(piece.cx, piece.cy, piece.r, piece.z, P, piece.n), piece.st);
    case "prop":
      return propSvg(piece.mx, piece.my, piece.base, spin, P);
    default:
      return "";
  }
}

/** Décalage d'un sous-ensemble à l'écran, pour la vue éclatée. */
function decalageSvg(e, P) {
  const loin = iso(e, P);
  const ici = iso([0, 0, 0], P);
  return [loin[0] - ici[0], loin[1] - ici[1]];
}

/** Un sous-ensemble : ses pièces dans l'ordre où elles ont été écrites (bas → haut). */
function groupeSvg(item, P, spin, apart) {
  const vu = towardViewer(P);
  const out = [];
  for (const piece of item.pieces) {
    const face = piece.st && piece.st.si;
    if (face === "y" && vu[1] <= 0.12) continue;
    if (face === "x" && vu[0] <= 0.12) continue;
    out.push(pieceSvg(piece, P, spin));
  }
  let transforme = "";
  if (apart) {
    const [dx, dy] = decalageSvg(item.e, P);
    const r = (v) => Math.round(v * 100) / 100;
    transforme = ` transform="translate(${r(dx * apart)} ${r(dy * apart)})"`;
  }
  return `<g data-part="${item.id}" style="${item.vars}"${transforme}>${out.join("")}</g>`;
}

/** Positions canoniques : décalage du groupe appliqué à l'ancre de chaque élément. */
function notesSvg(P, apart, notes, bord) {
  const par = {};
  for (const item of SCENE) par[item.id] = item.e;
  const items = [];
  for (const n of notes) {
    const e = par[n.g] || [0, 0, 0];
    const p = iso([n.a[0] + e[0] * apart, n.a[1] + e[1] * apart, n.a[2] + e[2] * apart], P);
    items.push({ n, p, side: p[0] < WIDTH / 2 ? -1 : 1, ly: p[1] });
  }
  const colonnes = { "-1": [], 1: [] };
  for (const it of items) colonnes[it.side].push(it);
  const out = [];
  const pas = 15.5;
  for (const side of [-1, 1]) {
    const colonne = colonnes[side].sort((a, b) => a.p[1] - b.p[1]);
    if (!colonne.length) continue;
    let y = 24;
    for (const it of colonne) {
      it.ly = Math.max(it.p[1], y);
      y = it.ly + pas;
    }
    // La colonne est centrée verticalement : les libellés se lisent d'un bloc.
    const haut = colonne[0].ly;
    const bas = colonne[colonne.length - 1].ly;
    const glissement = (HEIGHT - (bas - haut)) / 2 - haut;
    for (const it of colonne) it.ly += glissement;
    const trop = colonne[0].ly - 18;
    if (trop < 0) for (const it of colonne) it.ly -= trop;
    const manque = colonne[colonne.length - 1].ly + 18 - HEIGHT;
    if (manque > 0) for (const it of colonne) it.ly -= manque;
    for (const it of colonne) {
      const lx = side < 0 ? bord : WIDTH - bord;
      const rail = lx + (side < 0 ? 18 : -18);
      const ancre = side < 0 ? "end" : "start";
      const f = (v) => Math.round(v * 10) / 10;
      out.push(
        `<path class="iso-note-lead" d="M${f(it.p[0])} ${f(it.p[1])}L${f(rail)} ${f(it.p[1])}L${f(rail)} ${f(
          it.ly,
        )}L${f(lx)} ${f(it.ly)}"/>`,
      );
      out.push(`<circle class="iso-note-dot" cx="${f(it.p[0])}" cy="${f(it.p[1])}" r="1.8"/>`);
      out.push(
        `<text class="iso-note-text" x="${f(lx)}" y="${f(it.ly)}" text-anchor="${ancre}" dominant-baseline="middle">${it.n.t
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")}</text>`,
      );
    }
  }
  return out.join("");
}

/* ------------------------------------------------------------------ Page */

const sceneJson = JSON.stringify(
  SCENE.map((s) => ({ id: s.id, niveau: s.niveau, e: s.e, tint: s.tint, vars: s.vars, pieces: s.pieces, a: s.a })),
);

/**
 * Habillage de la figure.
 *
 * Même système que la station sol : papier froid, planche blanche, filets fins, cobalt pour ce
 * qui réagit, orange pour ce qui alerte. On redéfinit les variables que consomme le kit
 * (`--anatomy-*`) plutôt que ses règles, sauf pour la planche, la barre de commande et la
 * légende, qui sont propres à cette page.
 *
 * Contrainte de mise en page : la planche entière — figure, barre de commande, légende — tient
 * dans la fenêtre, sans défilement. La figure prend la place restante et se met à l'échelle
 * toute seule : le SVG garde ses proportions, il n'est jamais rogné ni déformé.
 */
const NOTE_CSS = `
/* ---------------------------------------------------------------- jetons */
.iso{
  --fond:#f4f6f9;--carte:#ffffff;--carte-2:#f8fafc;--rail:#e5eaf1;
  --encre:#0b1220;--encre-2:#3d4757;--encre-3:#5b6a80;--encre-4:#8b98a9;
  --filet:rgba(11,18,32,.16);--filet-clair:rgba(11,18,32,.08);--filet-fort:rgba(11,18,32,.36);
  --cobalt:#1f58f2;--cobalt-clair:#1c46c4;--signal:#ff4105;--signal-texte:#c2410c;
  --font-display:"Segoe UI Variable Display","Segoe UI",ui-sans-serif,system-ui,-apple-system,"Helvetica Neue",Arial,sans-serif;
  --font-mono:ui-monospace,"Cascadia Mono","SF Mono",Menlo,Consolas,monospace;
  --r-tag:8px;--r-carte:16px;--r-panneau:20px;
  --ease:cubic-bezier(.32,.72,0,1);--vif:140ms;--pose:320ms;
  --anatomy-page:var(--fond);--anatomy-card:var(--carte);
  --anatomy-text:var(--encre-2);--anatomy-strong:var(--encre);--anatomy-muted:var(--encre-3);
  --anatomy-paper:#f2f4f7;--anatomy-face:#ffffff;--anatomy-top:#ffffff;
  --anatomy-shade-0:#dfe3e9;--anatomy-shade-1:#e7eaef;--anatomy-shade-2:#eef1f5;--anatomy-shade-3:#f5f7f9;
  --anatomy-lit-top:#ffffff;--anatomy-lit-shade:#f0f2f5;
  --anatomy-hi:#0b1220;--anatomy-mid:#8a9199;--anatomy-lo:#c3c8cf;--anatomy-faint:#dfe3e8;--anatomy-lit:#000000;
  --anatomy-halo:#9aa3ad;--anatomy-halo-opacity:.28;--anatomy-dot:#2b3038;
  --anatomy-red:var(--signal-texte);--anatomy-green:var(--cobalt);--anatomy-blue:var(--cobalt);
  --anatomy-weight:.6px;--anatomy-ease:var(--ease);--anatomy-mono:var(--font-mono);
  --anatomy-lift:none;
}

/* ---------------------------------------------------------------- la page tient à l'écran */
html,body{height:100%}
body.iso{height:100dvh;overflow:hidden;background:var(--fond);color:var(--encre-2);
  font-family:var(--font-display);font-size:14px;line-height:1.5;-webkit-font-smoothing:antialiased}
.iso-page{width:min(1560px,100% - 40px);height:100%;margin:0 auto;
  padding:clamp(10px,1.5vh,22px) 0 clamp(10px,1.7vh,24px);
  display:grid;grid-template-rows:auto minmax(0,1fr);gap:clamp(8px,1.2vh,16px)}

/* ---------------------------------------------------------------- cartouche */
.drone-entete{display:flex;align-items:center;gap:18px;margin:0;padding-bottom:clamp(6px,.9vh,12px);
  border-bottom:1px solid var(--filet)}
.drone-entete .marque{display:flex;align-items:center;align-self:stretch;padding-right:18px;border-right:1px solid var(--filet);text-decoration:none}
.drone-entete .mot-symbole{display:flex;align-items:center;
  font-family:var(--font-mono);font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--encre);white-space:nowrap;
  transition:color var(--vif) var(--ease)}
.drone-entete .marque:hover .mot-symbole{color:var(--cobalt)}
.drone-entete .mot-symbole::before{content:"";flex:none;width:8px;height:8px;margin-right:10px;background:var(--cobalt)}
.drone-entete h1{margin:0;font-size:clamp(16px,2.1vh,24px);font-weight:400;line-height:1.15;letter-spacing:-.02em;color:var(--encre)}
.drone-entete .sur-titre{margin:3px 0 0;font-family:var(--font-mono);font-size:clamp(9px,.95vh,10px);letter-spacing:.12em;text-transform:uppercase;color:var(--encre-3)}

/* ---------------------------------------------------------------- planche */
.iso-figure{display:grid;grid-template-rows:minmax(0,1fr);margin:0;min-height:0}
.iso-plate{position:relative;display:grid;grid-template-rows:minmax(0,1fr) auto auto;
  gap:clamp(4px,.9vh,10px);min-height:0;
  padding:clamp(26px,3.6vh,46px) clamp(20px,2vw,34px) clamp(14px,2vh,28px);
  border:1px solid var(--filet);border-radius:var(--r-panneau);
  background:var(--carte);box-shadow:none;--anatomy-paper:var(--carte)}
/* Les coins sont rangés sur deux lignes, en haut : le bas de la planche appartient à la légende. */
.iso-plate-corners{position:absolute;top:clamp(10px,1.5vh,17px);right:clamp(12px,1.3vw,22px);
  left:clamp(12px,1.3vw,22px);bottom:auto;height:0;pointer-events:none}
.iso-plate-corner{position:absolute;font-family:var(--font-mono);font-size:9.5px;line-height:1;
  letter-spacing:.15em;text-transform:uppercase;color:var(--encre-3);white-space:nowrap}
/* Les coins ISO se chevauchent (top/bottom hérités) : on repose chaque côté explicitement. */
.iso-plate-corner[data-corner="fig"]{top:0;left:0;right:auto;bottom:auto;color:var(--encre)}
.iso-plate-corner[data-corner="title"]{top:0;left:0;right:auto;bottom:auto;transform:translateY(13px)}
.iso-plate-corner[data-corner="readout"]{top:0;right:0;left:auto;bottom:auto;color:var(--encre);
  font-size:11px;letter-spacing:.06em;font-variant-numeric:tabular-nums}
.iso-plate-corner[data-corner="hint"]{top:0;right:0;left:auto;bottom:auto;transform:translateY(13px)}
/* La deuxième ligne est partagée : à droite l'aide, à gauche le modèle. Chacun sa moitié. */
.iso-plate-corner[data-corner="title"],
.iso-plate-corner[data-corner="hint"]{max-width:47%;overflow:hidden;text-overflow:ellipsis}
.iso-legend{margin:0;color:var(--encre-3);font-size:12px;line-height:1.5}

/* ---------------------------------------------------------------- traits d'annotation */
.iso-stage{position:relative;display:grid;place-items:center;min-height:0;touch-action:none;cursor:grab}
/* Le SVG se pose sur la scène : sa largeur et sa hauteur viennent de la boîte de la scène, jamais
   du contenu. Le centrage du dessin ne dépend donc pas de la taille de la fenêtre. */
.iso-svg{position:absolute;inset:0;display:block;width:100%;height:100%}
.iso-notes{pointer-events:none}
.iso-note-lead{fill:none;stroke:var(--encre-3);stroke-width:.6;stroke-linecap:round;stroke-linejoin:round;opacity:.8}
.iso-note-dot{fill:var(--anatomy-card);stroke:var(--anatomy-hi);stroke-width:.7}
.iso-note-text{fill:var(--anatomy-strong);font-family:var(--font-mono);font-size:10.5px;letter-spacing:.02em;paint-order:stroke;stroke:var(--anatomy-card);stroke-width:2.5px;stroke-linejoin:round}

/* ---------------------------------------------------------------- barre de commande */
.drone-bar{display:flex;flex-wrap:wrap;align-items:center;gap:clamp(6px,1vh,12px) 18px;margin:0;
  padding-top:clamp(6px,.9vh,12px);border-top:1px solid var(--filet-clair);font-size:12.5px;color:var(--encre-2)}
.drone-manette{display:inline-flex;align-items:center;gap:9px;font-family:var(--font-mono);font-size:9.5px;
  letter-spacing:.16em;text-transform:uppercase;color:var(--encre-3);white-space:nowrap}
.drone-manette input{appearance:none;width:clamp(90px,9vw,150px);height:14px;margin:0;background:transparent;cursor:pointer}
.drone-manette input::-webkit-slider-runnable-track{height:2px;border-radius:999px;
  background:linear-gradient(90deg,var(--cobalt) var(--remplissage,75%),var(--rail) var(--remplissage,75%))}
.drone-manette input::-webkit-slider-thumb{appearance:none;width:12px;height:12px;margin-top:-5px;border-radius:50%;
  background:var(--encre);border:0;transition:transform var(--vif) var(--ease)}
.drone-manette input:hover::-webkit-slider-thumb{transform:scale(1.15)}
.drone-manette input::-moz-range-track{height:2px;border-radius:999px;background:var(--rail)}
.drone-manette input::-moz-range-progress{height:2px;border-radius:999px;background:var(--cobalt)}
.drone-manette input::-moz-range-thumb{width:12px;height:12px;border:0;border-radius:50%;background:var(--encre)}
.drone-poussee{font-family:var(--font-mono);font-size:11px;letter-spacing:.03em;color:var(--encre);font-variant-numeric:tabular-nums}
.drone-actions{display:flex;flex-wrap:wrap;gap:6px;margin-left:auto}
.drone-actions button{appearance:none;background:transparent;border:1px solid var(--filet-fort);border-radius:var(--r-tag);
  color:var(--encre);font-family:var(--font-mono);font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;
  padding:7px 12px;cursor:pointer;
  transition:border-color var(--vif) var(--ease),color var(--vif) var(--ease),background-color var(--vif) var(--ease),transform var(--vif) var(--ease)}
.drone-actions button:hover{color:var(--cobalt);border-color:var(--cobalt)}
.drone-actions button:active{transform:translateY(1px)}
.drone-actions button[aria-pressed="true"]{color:var(--cobalt);border-color:var(--cobalt);background:rgba(31,88,242,.08)}

/* ---------------------------------------------------------------- légende des teintes */
.drone-legende{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:3px 22px;margin:0;padding:0;
  list-style:none;color:var(--encre-2);font-size:clamp(10.5px,1.15vh,12px);line-height:1.35}
.drone-legende li{display:grid;grid-template-columns:9px 1fr;gap:9px;align-items:baseline}
.drone-legende i{width:9px;height:9px;border-radius:2px;background:var(--pastille)}
.drone-legende span{min-width:0}
`;

const body = [
  `<style>${REGLES_TEINTES}${NOTE_CSS}</style>`,
  `<header class="drone-entete">` +
    `<a class="marque" href="./index.html" title="Retour à l'accueil de la démonstration">` +
    `<span class="mot-symbole">Outsiderz</span>` +
    `</a>` +
    `<div>` +
    `<h1>Anatomie du drone d'inspection</h1>` +
    `<p class="sur-titre">${SCENE.length} sous-ensembles · ${SCENE.reduce(
      (n, s) => n + s.pieces.length,
      0,
    )} pièces · 2 800 g · 1 unité = 1 cm · empattement 500 mm</p>` +
    `</div>` +
    `</header>` +
    k.plateHtml({
    fig: "Fig. 1",
    title: "Holybro X500 V2",
    hint: "Glisser pour tourner · clic pour éclater",
    readout: "2 800 g",
    caption: "",
    body:
      `<div class="iso-stage" data-stage><svg class="iso-svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="Drone d'inspection Outsiderz, vue isométrique">` +
      `<g class="iso-scene" data-scene></g><g class="iso-notes" data-notes></g></svg></div>` +
      `<div class="drone-bar">` +
      `<label class="drone-manette">Manette <input type="range" min="0" max="100" value="75" data-manette></label>` +
      `<span class="drone-poussee" data-poussee>4 × 1 250 g = 5 000 g&nbsp;·&nbsp;rapport 1,79</span>` +
      `<span class="drone-actions">` +
      `<button type="button" data-action="eclate" aria-pressed="false">Vue éclatée</button>` +
      `<button type="button" data-action="annote" aria-pressed="false">Annoter</button>` +
      `<button type="button" data-action="reset">Réinitialiser la vue</button>` +
      `</span></div>` +
      `<ul class="drone-legende">` +
      `<li style="--pastille:${TEINTES.structure}"><i></i><span>Structure — châssis, bras, train · 620 g</span></li>` +
      `<li style="--pastille:${TEINTES.propulsion}"><i></i><span>Propulsion — 4 × 2814 KV700, ESC 30 A, hélices 1245 · 480 g</span></li>` +
      `<li style="--pastille:${TEINTES.avionique}"><i></i><span>Avionique — Pixhawk 6C, GPS M10, SiK 915, ELRS · 120 g</span></li>` +
      `<li style="--pastille:${TEINTES.energie}"><i></i><span>Énergie — Li-ion 21700 4S4P, ≈ 16 Ah · 1 150 g</span></li>` +
      `<li style="--pastille:${TEINTES.calcul}"><i></i><span>Calcul embarqué — Raspberry Pi 4 (4 Go) · 130 g</span></li>` +
      `<li style="--pastille:${TEINTES.charge}"><i></i><span>Charge utile — nacelle, FLIR Lepton 3.5 + RGB · 300 g</span></li>` +
      `</ul>`,
  }),
].join("");

const script = `${kitScript()}
/* ------------------------------------------------------------------ la figure */

const SCENE = ${sceneJson};
const NOTES = ${JSON.stringify(NOTES)};
const MASSE_G = ${MASSE_G};
const POUSSEE_MOTEUR_G = ${POUSSEE_MOTEUR_G};
const VUE = ${JSON.stringify(VUE)};
const ELEVATIONS = ${JSON.stringify(ELEVATIONS)};
const ELEV_MIN = ${ELEV_MIN};
const ELEV_MAX = ${ELEV_MAX};
const ZOOM_MIN = ${ZOOM_MIN};
const ZOOM_MAX = ${ZOOM_MAX};
const WIDTH = ${WIDTH};
const HEIGHT = ${HEIGHT};
/** Retrait de la scène en mode annoté. */
const RETRAIT_NOTES = ${RETRAIT_NOTES};
const CADRE = ${JSON.stringify(CADRE)};
const CADRE_APART = ${JSON.stringify(CADRE_APART)};
/** Bord intérieur des colonnes de libellés, calculé sur la vue éclatée. */
const BORD_NOTES = WIDTH / 2 - ${RAYON_MAX} * CADRE_APART.scale * RETRAIT_NOTES - 24;
${propSvg.toString()}
${pieceSvg.toString()}
${decalageSvg.toString()}
${groupeSvg.toString()}
${notesSvg.toString()}
${ordreScene.toString()}

const ANCRE = {};
const NIVEAU = {};
const DECALAGE = {};
for (const item of SCENE) {
  ANCRE[item.id] = item.a;
  NIVEAU[item.id] = item.niveau;
  DECALAGE[item.id] = item.e;
}

const stage = document.querySelector("[data-stage]");
const sceneEl = document.querySelector("[data-scene]");
const notesEl = document.querySelector("[data-notes]");
const pousseeEl = document.querySelector("[data-poussee]");
const manetteEl = document.querySelector("[data-manette]");
const bouton = (quoi) => document.querySelector('[data-action="' + quoi + '"]');
const doux = matchMedia("(prefers-reduced-motion: reduce)");

const noeuds = {};
for (const item of SCENE) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", "g");
  el.setAttribute("data-part", item.id);
  el.__html = "";
  noeuds[item.id] = el;
}
/** Seuls les sous-ensembles qui bougent sans que la caméra tourne. */
const ANIMES = new Set(SCENE.filter((item) => item.id.startsWith("prop")).map((item) => item.id));

let vue = { azimut: VUE.azimut, elevation: VUE.elevation };
let zoom = 1, cibleZoom = 1;
let manette = 0.75, cibleManette = 0.75;
let ecarte = 0, cibleEcarte = 0;
let annoter = false, spin = 0;
let visible = true, derniere = 0;
let ordrePrecedent = "";
let cadrePrecedent = { azimuth: NaN, elevation: NaN, scale: NaN, ox: NaN, oy: NaN };
let pousseePrecedente = "";


/** Cadre de la vue courante : interpolation socle ⇄ éclaté, zoom, et retrait du mode annoté. */
function cadre() {
  const t = ecarte;
  const retrait = annoter ? RETRAIT_NOTES : 1;
  const s0 = CADRE.scale + (CADRE_APART.scale - CADRE.scale) * t;
  const s = s0 * zoom * retrait;
  const ox = CADRE.origin[0] + (CADRE_APART.origin[0] - CADRE.origin[0]) * t;
  const oy = CADRE.origin[1] + (CADRE_APART.origin[1] - CADRE.origin[1]) * t;
  return {
    scale: s,
    origin: [WIDTH / 2 + (ox - WIDTH / 2) * retrait, HEIGHT / 2 + (oy - HEIGHT / 2) * retrait],
    azimuth: vue.azimut,
    elevation: vue.elevation,
  };
}

/** Peinture : tous les sous-ensembles, ou seulement ceux qui tournent sur place. */
function dessiner(P, tout) {
  const liste = ordreScene(P, ecarte);
  for (const { item } of liste) {
    if (!tout && !ANIMES.has(item.id)) continue;
    const noeud = noeuds[item.id];
    const html = groupeSvg(item, P, spin, ecarte);
    if (noeud.__html !== html) {
      noeud.innerHTML = html;
      noeud.__html = html;
    }
  }
  const cle = liste.map((entry) => entry.item.id).join("|");
  if (cle !== ordrePrecedent) {
    ordrePrecedent = cle;
    for (const { item } of liste) sceneEl.appendChild(noeuds[item.id]);
  }
}

function dessinerNotes(P) {
  notesEl.innerHTML = annoter ? notesSvg(P, ecarte, NOTES, BORD_NOTES) : "";
}

function memeCadre(a, b) {
  return (
    a.azimuth === b.azimuth &&
    a.elevation === b.elevation &&
    a.scale === b.scale &&
    a.origin[0] === b.origin[0] &&
    a.origin[1] === b.origin[1]
  );
}

function dessinerTout() {
  const P = cadre();
  dessiner(P, true);
  dessinerNotes(P);
  cadrePrecedent = P;
}


/* --- boucle ---------------------------------------------------------------- */

function avancer(dt) {
  if (!annoter && !doux.matches) spin += dt * 1.15;
  manette += (cibleManette - manette) * 0.14;
  zoom += (cibleZoom - zoom) * 0.16;
  if (Math.abs(cibleZoom - zoom) < 0.0015) zoom = cibleZoom;
  const pas = 1 - Math.pow(0.84, dt * 60);
  ecarte += (cibleEcarte - ecarte) * pas;
  const enMouvement = Math.abs(cibleEcarte - ecarte) > 0.0015;
  if (!enMouvement) ecarte = cibleEcarte;

  const P = cadre();
  if (!memeCadre(P, cadrePrecedent) || enMouvement) {
    dessiner(P, true);
    dessinerNotes(P);
    cadrePrecedent = P;
  } else if (!annoter) {
    dessiner(P, false);
  }

  const poussee = POUSSEE_MOTEUR_G * 4 * manette * manette;
  const texte =
    Math.round(manette * 100) + " % · poussée " +
    Math.round(poussee).toLocaleString("fr-FR") + " g / " + MASSE_G.toLocaleString("fr-FR") + " g · " +
    (poussee >= MASSE_G ? "décollage" : "au sol");
  if (texte !== pousseePrecedente) {
    pousseePrecedente = texte;
    pousseeEl.textContent = texte;
  }
}

function image(temps) {
  const dt = derniere ? Math.min(0.06, (temps - derniere) / 1000) : 0.016;
  derniere = temps;
  if (visible) avancer(dt);
  requestAnimationFrame(image);
}

/* Repère de mise au point : figure.regler({ azimut: 120 }) depuis la console. */
window.figure = {
  vue,
  regler: (options) => Object.assign(vue, options),
  zoom: (valeur) => { cibleZoom = valeur; },
  annoter: (valeur = true) => { if (!!valeur !== annoter) basculerAnnoter(); },
  ecarter: (valeur) => { cibleEcarte = valeur; },
  figer: () => { for (let i = 0; i < 120; i++) avancer(1 / 30); },
  etat: () => ({ azimut: vue.azimut, elevation: vue.elevation, ecarte, zoom, annoter, spin }),
};

/* --- interactions ---------------------------------------------------------- */

let glisse = null;
stage.addEventListener("pointerdown", (evenement) => {
  glisse = { x: evenement.clientX, y: evenement.clientY, azimut: vue.azimut, elevation: vue.elevation, parti: false };
  stage.setAttribute("data-grab", "");
  try { stage.setPointerCapture(evenement.pointerId); } catch (erreur) { /* pointeur déjà relâché */ }
});
stage.addEventListener("pointermove", (evenement) => {
  if (!glisse) return;
  const dx = evenement.clientX - glisse.x;
  const dy = evenement.clientY - glisse.y;
  if (!glisse.parti && Math.abs(dx) + Math.abs(dy) > 4) glisse.parti = true;
  if (!glisse.parti) return;
  vue.azimut = glisse.azimut + dx * 0.45;
  vue.elevation = Math.max(ELEV_MIN, Math.min(ELEV_MAX, glisse.elevation + dy * 0.26));
});
const lacher = (evenement) => {
  if (!glisse) return;
  if (!glisse.parti && evenement.type === "pointerup") basculerEcarte();
  glisse = null;
  stage.removeAttribute("data-grab");
};
stage.addEventListener("pointerup", lacher);
stage.addEventListener("pointercancel", lacher);
stage.addEventListener("wheel", (evenement) => {
  evenement.preventDefault();
  cibleZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, cibleZoom * (evenement.deltaY > 0 ? 0.92 : 1.08)));
}, { passive: false });

function basculerEcarte() {
  cibleEcarte = cibleEcarte > 0.5 ? 0 : 1;
  bouton("eclate").setAttribute("aria-pressed", cibleEcarte > 0.5 ? "true" : "false");
}
function basculerAnnoter() {
  annoter = !annoter;
  bouton("annote").setAttribute("aria-pressed", annoter ? "true" : "false");
  if (annoter) {
    cibleEcarte = 1;
    bouton("eclate").setAttribute("aria-pressed", "true");
    vue.azimut = VUE.azimut;
    vue.elevation = VUE.elevation;
  }
}
bouton("eclate").addEventListener("click", basculerEcarte);
bouton("annote").addEventListener("click", basculerAnnoter);
bouton("reset").addEventListener("click", () => {
  vue.azimut = VUE.azimut;
  vue.elevation = VUE.elevation;
  cibleZoom = 1;
});
manetteEl.addEventListener("input", () => {
  cibleManette = Number(manetteEl.value) / 100;
  // La piste de la manette se remplit en cobalt jusqu'au curseur (voir .drone-manette).
  manetteEl.style.setProperty("--remplissage", manetteEl.value + "%");
});
addEventListener("keydown", (evenement) => {
  const touche = evenement.key.toLowerCase();
  if (touche === "e") basculerEcarte();
  if (touche === "a") basculerAnnoter();
  if (touche === "r") bouton("reset").click();
});

if ("IntersectionObserver" in window) {
  new IntersectionObserver((entrees) => {
    for (const entree of entrees) visible = entree.isIntersecting;
  }, { threshold: 0.04 }).observe(stage);
}

dessinerTout();
requestAnimationFrame(image);
`;

const page = k.pageHtml({
  title: "Outsiderz — Anatomie du drone d'inspection",
  theme: "light",
  body,
  script,
  width: 1560,
});

/* ------------------------------------------------------------------ Sortie */

/* Une seule page, à la racine du projet : figure.html. Les diapositives s'en servent directement. */
writeFileSync(join(HERE, "..", "..", "figure.html"), page, "utf8");

console.log(
  `figure.html · ${SCENE.length} sous-ensembles · ${SCENE.reduce((n, s) => n + s.pieces.length, 0)} pièces · ` +
    `cadre ${CADRE.scale.toFixed(2)} px/u (éclaté ${CADRE_APART.scale.toFixed(2)})`,
);

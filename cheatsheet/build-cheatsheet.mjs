// Génère antiseche-formules-excel.pdf : antisèche des formules Excel les plus
// courantes, 2 pages A4, à partir de formulas.json.
//
// Génération PDF en JS pur (aucune dépendance, aucun navigateur, hors-ligne).
// On s'appuie sur les polices standard PDF (Helvetica / Courier) — pas
// d'embarquement de fontes nécessaire. Encodage WinAnsi.
//
//   node cheatsheet/build-cheatsheet.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const formules = JSON.parse(
  readFileSync(join(__dirname, "..", "formulas.json"), "utf8"),
);
const parNom = new Map(formules.map((f) => [f.nom, f]));

// ─── Contenu curaté : formules les plus courantes ──────────────────────────
// Couleurs reprises du design system du site (variables --cat-* de CLAUDE.md).
const SECTIONS = [
  { titre: "Bases & calcul", couleur: [0.15, 0.39, 0.92],
    noms: ["SOMME", "MOYENNE", "MIN", "MAX", "NB", "NBVAL", "ARRONDI", "SOUS.TOTAL", "MOD"] },
  { titre: "Conditions & logique", couleur: [0.49, 0.23, 0.93],
    noms: ["SI", "ET", "OU", "SIERREUR", "SOMME.SI", "SOMME.SI.ENS", "NB.SI", "NB.SI.ENS", "MOYENNE.SI"] },
  { titre: "Recherche & references", couleur: [0.92, 0.35, 0.05],
    noms: ["RECHERCHEV", "RECHERCHEH", "INDEX", "EQUIV", "DECALER", "INDIRECT"] },
  { titre: "Texte", couleur: [0.86, 0.15, 0.47],
    noms: ["CONCATENER", "GAUCHE", "DROITE", "STXT", "NBCAR", "SUPPRESPACE", "MAJUSCULE", "MINUSCULE", "NOMPROPRE", "TEXTE", "SUBSTITUE", "CHERCHE", "CNUM"] },
  { titre: "Date & heure", couleur: [0.03, 0.57, 0.7],
    noms: ["AUJOURDHUI", "MAINTENANT", "DATE", "ANNEE", "MOIS", "JOUR", "JOURSEM", "FIN.MOIS"] },
  { titre: "Information", couleur: [0.39, 0.45, 0.55],
    noms: ["ESTVIDE", "ESTERREUR"] },
];

const VERT = [0.063, 0.486, 0.255];   // #107C41 vert de marque
const TEXTE = [0.122, 0.161, 0.2];    // #1F2933
const DOUX = [0.357, 0.404, 0.439];   // #5B6770
const BORD = [0.78, 0.8, 0.82];

// ─── Sélection + descriptifs courts ────────────────────────────────────────
function descriptifCourt(desc) {
  let t = String(desc).trim();
  const pt = t.search(/\.(\s|$)/);
  if (pt !== -1 && pt <= 130) t = t.slice(0, pt);
  return t.trim().replace(/\.$/, "");
}

const blocks = [];
let total = 0;
for (const sec of SECTIONS) {
  blocks.push({ type: "section", titre: sec.titre, couleur: sec.couleur });
  const manquants = sec.noms.filter((n) => !parNom.has(n));
  if (manquants.length) console.warn("⚠️  introuvables:", manquants.join(", "));
  for (const nom of sec.noms) {
    const f = parNom.get(nom);
    if (!f) continue;
    total++;
    blocks.push({ type: "entry", nom: f.nom, syntaxe: f.syntaxe, desc: descriptifCourt(f.description) });
  }
}

// ─── Métriques texte (largeurs Helvetica approx. + Courier monospace) ───────
function widthHelv(str, size) {
  // largeurs relatives approximatives (em) — suffisant pour le retour à la ligne
  let w = 0;
  for (const ch of str) {
    if ("iljI.,:;'|! ".includes(ch)) w += 0.28;
    else if ("mwMW@".includes(ch)) w += 0.86;
    else if ("frtIJ()[]-".includes(ch)) w += 0.36;
    else if (ch >= "A" && ch <= "Z") w += 0.68;
    else if (ch >= "0" && ch <= "9") w += 0.556;
    else w += 0.5;
  }
  return w * size;
}

function wrap(text, size, maxW) {
  const mots = text.split(/\s+/);
  const lignes = [];
  let cur = "";
  for (const m of mots) {
    const essai = cur ? cur + " " + m : m;
    if (widthHelv(essai, size) > maxW && cur) {
      lignes.push(cur);
      cur = m;
    } else cur = essai;
  }
  if (cur) lignes.push(cur);
  return lignes.slice(0, 2); // 2 lignes max
}

// ─── Géométrie page ─────────────────────────────────────────────────────────
const PW = 595.28, PH = 841.89;
const MARGE = 34, GAP = 26;
const COLW = (PW - 2 * MARGE - GAP) / 2;
const COL_X = [MARGE, MARGE + COLW + GAP];
const TITRE_H = 70;     // hauteur réservée au bandeau de titre (page 1)
const TOP_P1 = TITRE_H + 14;
const TOP_P2 = MARGE + 6;
const BOTTOM = PH - MARGE; // limite basse en coord. "top"

// 4 colonnes : [page0-gauche, page0-droite, page1-gauche, page1-droite]
const colonnes = [
  { page: 0, x: COL_X[0], y0: TOP_P1 },
  { page: 0, x: COL_X[1], y0: TOP_P1 },
  { page: 1, x: COL_X[0], y0: TOP_P2 },
  { page: 1, x: COL_X[1], y0: TOP_P2 },
];

// instructions de dessin par page (coord. top), converties plus tard
const pages = [[], []];
const draw = (page, op) => pages[page].push(op);

// 1) Mesure : pré-calcule pour chaque bloc sa hauteur (et le wrap / la taille
//    de syntaxe auto-réduite pour tenir dans la largeur de colonne).
const COURIER_EM = 0.6;
for (const b of blocks) {
  if (b.type === "section") { b.h = 4 + 15 + 7; continue; }
  b.lignesDesc = wrap(b.desc, 7.6, COLW - 2);
  let sSize = 7;
  const w = b.syntaxe.length * COURIER_EM * sSize;
  if (w > COLW) sSize = Math.max(5.0, COLW / (b.syntaxe.length * COURIER_EM));
  b.sSize = sSize;
  b.h = 11 + 9.4 + b.lignesDesc.length * 9 + 6;
}

// 2) Répartition équilibrée sur 4 colonnes (cible ≈ hauteur totale / 4).
const totalH = blocks.reduce((s, b) => s + b.h, 0);
const cible = totalH / colonnes.length;
let ci = 0, acc = 0;
for (const b of blocks) {
  if (ci < colonnes.length - 1 && acc > 0 && acc + b.h > cible) { ci++; acc = 0; }
  b.ci = ci;
  acc += b.h;
}
// Pas de titre de section orphelin en fin de colonne : on le pousse à la suivante.
for (let i = 0; i < blocks.length; i++) {
  const b = blocks[i];
  const suiv = blocks[i + 1];
  if (b.type === "section" && b.ci < colonnes.length - 1 && (!suiv || suiv.ci !== b.ci)) b.ci++;
}

// 3) Dessin colonne par colonne.
for (let c = 0; c < colonnes.length; c++) {
  const col = colonnes[c];
  let y = col.y0;
  for (const b of blocks) {
    if (b.ci !== c) continue;
    if (b.type === "section") {
      y += 4;
      draw(col.page, { t: "rect", x: col.x, y, w: COLW, h: 15, c: b.couleur });
      draw(col.page, { t: "text", x: col.x + 6, y: y + 10.7, s: b.titre, font: "B", size: 9.2, c: [1, 1, 1] });
      y += 15 + 7;
    } else {
      draw(col.page, { t: "text", x: col.x, y: y + 8.6, s: b.nom, font: "B", size: 8.8, c: VERT });
      y += 11;
      draw(col.page, { t: "text", x: col.x, y: y + 7, s: b.syntaxe, font: "C", size: b.sSize, c: TEXTE });
      y += 9.4;
      for (const l of b.lignesDesc) {
        draw(col.page, { t: "text", x: col.x, y: y + 7, s: l, font: "R", size: 7.6, c: DOUX });
        y += 9;
      }
      y += 3;
      draw(col.page, { t: "line", x1: col.x, y1: y, x2: col.x + COLW, y2: y, c: BORD });
      y += 3;
    }
  }
}

// ─── En-tête page 1 ──────────────────────────────────────────────────────────
draw(0, { t: "text", x: MARGE, y: 32, s: "Antisèche des formules Excel", font: "B", size: 19, c: TEXTE });
draw(0, { t: "text", x: MARGE, y: 50, s: "Les " + total + " fonctions les plus courantes", font: "B", size: 11.5, c: VERT });
draw(0, { t: "rect", x: MARGE, y: 58, w: PW - 2 * MARGE, h: 2.2, c: VERT });

// pied de page (chaque page)
const piedY = PH - MARGE + 6;
const piedTxt = "Excel (version française)  ·  séparateur d'arguments : point-virgule";
for (const p of [0, 1]) {
  draw(p, { t: "line", x1: MARGE, y1: piedY - 4, x2: PW - MARGE, y2: piedY - 4, c: BORD });
  draw(p, { t: "text", x: MARGE, y: piedY + 3, s: piedTxt, font: "R", size: 7, c: DOUX });
}

// ─── Sérialisation PDF ────────────────────────────────────────────────────────
function sanitize(s) {
  return String(s)
    .replace(/…/g, "...")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/œ/g, "oe").replace(/Œ/g, "OE")
    .replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

const FONT = { R: "F1", B: "F2", C: "F3" };

function streamFor(page) {
  const out = [];
  for (const op of pages[page]) {
    if (op.t === "rect") {
      out.push(`${op.c[0]} ${op.c[1]} ${op.c[2]} rg`);
      out.push(`${op.x.toFixed(2)} ${(PH - op.y - op.h).toFixed(2)} ${op.w.toFixed(2)} ${op.h.toFixed(2)} re f`);
    } else if (op.t === "line") {
      out.push(`${op.c[0]} ${op.c[1]} ${op.c[2]} RG 0.5 w`);
      out.push(`${op.x1.toFixed(2)} ${(PH - op.y1).toFixed(2)} m ${op.x2.toFixed(2)} ${(PH - op.y2).toFixed(2)} l S`);
    } else if (op.t === "text") {
      out.push("BT");
      out.push(`/${FONT[op.font]} ${op.size} Tf`);
      out.push(`${op.c[0]} ${op.c[1]} ${op.c[2]} rg`);
      out.push(`1 0 0 1 ${op.x.toFixed(2)} ${(PH - op.y).toFixed(2)} Tm`);
      out.push(`(${sanitize(op.s)}) Tj`);
      out.push("ET");
    }
  }
  return out.join("\n");
}

// objets PDF
const objs = [];
objs[1] = "<< /Type /Catalog /Pages 2 0 R >>";
objs[2] = "<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>";
const resources = "<< /Font << /F1 7 0 R /F2 8 0 R /F3 9 0 R >> >>";
objs[3] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources ${resources} /Contents 5 0 R >>`;
objs[4] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources ${resources} /Contents 6 0 R >>`;
const s0 = streamFor(0), s1 = streamFor(1);
objs[5] = `<< /Length ${Buffer.byteLength(s0, "latin1")} >>\nstream\n${s0}\nendstream`;
objs[6] = `<< /Length ${Buffer.byteLength(s1, "latin1")} >>\nstream\n${s1}\nendstream`;
objs[7] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
objs[8] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
objs[9] = "<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>";

let pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
const offsets = [];
for (let i = 1; i < objs.length; i++) {
  offsets[i] = Buffer.byteLength(pdf, "latin1");
  pdf += `${i} 0 obj\n${objs[i]}\nendobj\n`;
}
const xrefStart = Buffer.byteLength(pdf, "latin1");
const n = objs.length;
pdf += `xref\n0 ${n}\n0000000000 65535 f \n`;
for (let i = 1; i < n; i++) {
  pdf += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
}
pdf += `trailer\n<< /Size ${n} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

const outPath = join(__dirname, "antiseche-formules-excel.pdf");
writeFileSync(outPath, Buffer.from(pdf, "latin1"));
console.log(`✅ ${outPath}`);
console.log(`   ${total} formules, ${SECTIONS.length} sections, 2 pages A4.`);

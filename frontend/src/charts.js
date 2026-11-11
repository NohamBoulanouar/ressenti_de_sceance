// Petits graphiques SVG faits main (pas de bibliothèque) pour le suivi du coach.
import { esc } from "./util.js";

// Une couleur par poste (lisibles sur fond clair, distinctes entre elles).
export const POSTE_COLORS = ["#1f7a4d", "#2f6fb3", "#c7782a", "#8a4fb5", "#c2413b", "#3f8f95"];
export const MAIN = "#1f7a4d";

const W = 300, H = 128, L = 24, R = 10, T = 10, B = 20;
const xAt = (i, n) => (n <= 1 ? (L + W - R) / 2 : L + (i * (W - L - R)) / (n - 1));
const yAt = (v) => T + ((100 - v) * (H - T - B)) / 100;
const short = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "");

/**
 * Courbe(s) des moyennes par séance sur une échelle 1–100.
 * labels : [{ date, title }] une entrée par séance (axe x)
 * series : [{ name, color, values: [nombre|null par séance] }]
 * opts : { mean, highlight } — moyenne en pointillés, index de séance mis en avant
 */
export function lineChart(labels, series, { mean = null, highlight = -1 } = {}) {
  const n = labels.length;
  if (!n) return `<div class="chart-empty mu">Pas encore de données.</div>`;
  let svg = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">`;
  [0, 50, 100].forEach((g) => {
    svg += `<line x1="${L}" x2="${W - R}" y1="${yAt(g)}" y2="${yAt(g)}" class="grid"/>`
      + `<text x="${L - 6}" y="${yAt(g) + 3}" class="ax" text-anchor="end">${g}</text>`;
  });
  if (highlight >= 0) {
    svg += `<rect x="${xAt(highlight, n) - 9}" y="${T - 4}" width="18" height="${H - T - B + 8}" rx="6" class="hl"/>`;
  }
  if (mean != null) {
    svg += `<line x1="${L}" x2="${W - R}" y1="${yAt(mean)}" y2="${yAt(mean)}" class="mean"/>`;
  }
  series.forEach((s) => {
    // On relie les points consécutifs ; une séance sans valeur coupe la courbe.
    let d = "", pen = false;
    s.values.forEach((v, i) => {
      if (v == null) { pen = false; return; }
      d += `${pen ? "L" : "M"}${xAt(i, n).toFixed(1)} ${yAt(v).toFixed(1)}`;
      pen = true;
    });
    if (d) svg += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    s.values.forEach((v, i) => {
      if (v == null) return;
      const big = i === highlight || i === n - 1;
      svg += `<circle cx="${xAt(i, n).toFixed(1)}" cy="${yAt(v).toFixed(1)}" r="${big ? 3.6 : 2.4}" fill="${big ? s.color : "#fff"}" stroke="${s.color}" stroke-width="1.6">`
        + `<title>${esc(`${s.name ? s.name + " · " : ""}${labels[i].title} ${short(labels[i].date)} : ${Math.round(v)}`)}</title></circle>`;
    });
  });
  svg += `<text x="${xAt(0, n)}" y="${H - 5}" class="ax" text-anchor="${n > 1 ? "start" : "middle"}">${short(labels[0].date)}</text>`;
  if (n > 1) svg += `<text x="${xAt(n - 1, n)}" y="${H - 5}" class="ax" text-anchor="end">${short(labels[n - 1].date)}</text>`;
  return svg + `</svg>`;
}

/** Histogramme d'effectifs par séance (ex. blessures). */
export function barChart(labels, values, color = "#d6453d") {
  const n = labels.length;
  if (!n) return `<div class="chart-empty mu">Pas encore de données.</div>`;
  const max = Math.max(1, ...values);
  const bw = Math.min(22, ((W - L - R) / n) * 0.62);
  const y = (v) => T + ((max - v) * (H - T - B)) / max;
  let svg = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">`;
  svg += `<line x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}" class="grid"/>`
    + `<text x="${L - 6}" y="${y(max) + 3}" class="ax" text-anchor="end">${max}</text>`
    + `<text x="${L - 6}" y="${y(0) + 3}" class="ax" text-anchor="end">0</text>`;
  values.forEach((v, i) => {
    const cx = n <= 1 ? (L + W - R) / 2 : L + bw / 2 + (i * (W - L - R - bw)) / (n - 1);
    const h = y(0) - y(v);
    svg += `<rect x="${(cx - bw / 2).toFixed(1)}" y="${y(v).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(v ? 2 : 0, h).toFixed(1)}" rx="3" fill="${v ? color : "transparent"}">`
      + `<title>${esc(`${labels[i].title} ${short(labels[i].date)} : ${v}`)}</title></rect>`;
  });
  svg += `<text x="${L}" y="${H - 5}" class="ax">${short(labels[0].date)}</text>`;
  if (n > 1) svg += `<text x="${W - R}" y="${H - 5}" class="ax" text-anchor="end">${short(labels[n - 1].date)}</text>`;
  return svg + `</svg>`;
}

/** Pente (moindres carrés) d'une suite de valeurs, en unités par pas ; null si moins de 3 points. */
export function slope(values) {
  const pts = values.map((v, i) => [i, v]).filter(([, v]) => v != null);
  if (pts.length < 3) return null;
  const mx = pts.reduce((s, [x]) => s + x, 0) / pts.length;
  const my = pts.reduce((s, [, y]) => s + y, 0) / pts.length;
  const num = pts.reduce((s, [x, y]) => s + (x - mx) * (y - my), 0);
  const den = pts.reduce((s, [x]) => s + (x - mx) ** 2, 0);
  return den ? num / den : null;
}

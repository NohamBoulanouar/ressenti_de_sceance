export const $ = (s, root = document) => root.querySelector(s);
export const $$ = (s, root = document) => [...root.querySelectorAll(s)];

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** Date du jour en heure locale (toISOString seul donnerait la date UTC). */
export function localDate(d = new Date()) {
  const x = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return x.toISOString().slice(0, 10);
}

export function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localDate(d);
}

export const frDate = (iso) => (iso ? iso.split("-").reverse().join("/") : "");

const nums = (a) => a.filter((x) => typeof x === "number");
export const avg = (a) => {
  a = nums(a);
  return a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
};
export const f0 = (v) => (v == null ? "–" : v.toFixed(0));

/**
 * Évite qu'un chargement lent n'écrive dans une vue que l'utilisateur a quittée entre-temps.
 * const still = claimView(el); await …; if (!still()) return;
 */
export function claimView(el) {
  const token = {};
  el._viewToken = token;
  return () => el._viewToken === token && el.isConnected;
}

export function setMsg(el, text, ok) {
  el.textContent = text;
  el.className = ok ? "ok" : "warn";
}

/** "mar. 6 nov." à partir de "2026-11-06" (date locale, sans décalage de fuseau). */
export function frDay(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}

/** "Entraînement · mar. 6 nov. · 18:30" */
export const sessionLabel = (s) => [s.title, frDay(s.date), s.time].filter(Boolean).join(" · ");

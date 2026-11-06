import { api, errorMessage } from "../api.js";
import { KEYS, POSTES, QS, SHORT } from "../questions.js";
import { $, avg, claimView, daysAgo, esc, f0, frDate, sessionLabel } from "../util.js";

const PERIODS = [["7", "7 derniers jours"], ["30", "30 derniers jours"], ["90", "3 derniers mois"], ["all", "Tout"]];
const filters = { period: "30", poste: "", uid: "" };
let allRows = [];

export async function renderTeam(el) {
  const still = claimView(el);
  el.innerHTML = `<div class="card"><div class="mu">Chargement des réponses…</div></div>`;
  try {
    const [rows, users, sessions] = await Promise.all([
      api.teamResponses(filters.period === "all" ? null : daysAgo(+filters.period - 1)),
      api.users(),
      api.sessions(),
    ]);
    const sessionsById = new Map(sessions.map((s) => [s.id, s]));
    // Nom et poste actuels du joueur (s'il a modifié son profil depuis ses anciennes réponses).
    // Seuls les athlètes actuels comptent (un coach n'est que coach ; un membre retiré n'a plus de données).
    const athletes = new Map(users.filter((u) => u.role === "ATHLETE").map((u) => [u.uid, u]));
    if (!still()) return;
    allRows = rows.filter((r) => athletes.has(r.uid))
      .map((r) => {
        const s = sessionsById.get(r.sessionId);
        return { ...r, name: athletes.get(r.uid).name, poste: athletes.get(r.uid).poste,
          seance: s ? sessionLabel(s) : frDate(r.date), seanceKey: s ? `${s.date} ${s.time || ""} ${s.id}` : r.date };
      });
  } catch (e) {
    if (still()) el.innerHTML = `<div class="card warn">${esc(errorMessage(e))}</div>`;
    return;
  }
  draw(el);
}

function draw(el) {
  const players = [...new Map(allRows.map((r) => [r.uid, r.name])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const rows = allRows.filter((r) => (!filters.poste || r.poste === filters.poste) && (!filters.uid || r.uid === filters.uid));

  let h = `
    <div class="card filters">
      <select id="fPeriod">${PERIODS.map(([v, l]) => `<option value="${v}" ${filters.period === v ? "selected" : ""}>${l}</option>`).join("")}</select>
      <select id="fPoste"><option value="">Tous les postes</option>${POSTES.map((p) => `<option ${filters.poste === p ? "selected" : ""}>${esc(p)}</option>`).join("")}</select>
      <select id="fUid"><option value="">Tous les joueurs</option>${players.map(([u, n]) => `<option value="${esc(u)}" ${filters.uid === u ? "selected" : ""}>${esc(n)}</option>`).join("")}</select>
    </div>`;

  // Moyennes équipe
  h += `<div class="card"><h2>Moyennes (${rows.length} réponse${rows.length > 1 ? "s" : ""})</h2>`;
  if (!rows.length) h += `<div class="mu">Aucune réponse sur cette période.</div>`;
  QS.forEach(([t, qs]) => {
    h += `<div class="mu" style="margin-top:8px"><b>${t}</b></div>` + qs.map((q) => bar(q[1], avg(rows.map((r) => r[q[0]])), q[0] === "opp")).join("");
  });
  h += `<div class="mu" style="margin-top:8px">Opposition : idéal autour de 50 (repère), rouge si l'écart dépasse 20.</div></div>`;

  // Blessures / gênes
  const inj = rows.filter((r) => r.blessure || r.gene);
  h += `<div class="card"><h2>Blessures et gênes</h2>` + (inj.length
    ? inj.slice(0, 20).map((r) => `<div class="row"><span class="n">${frDate(r.date)} · ${esc(r.name)}</span><span class="${r.blessure ? "warn" : ""}">${r.blessure ? "Blessure " : ""}${esc(r.gene || "")}</span></div>`).join("")
    : `<div class="mu">Rien à signaler.</div>`) + `</div>`;

  // Par joueur
  const byUid = new Map();
  rows.forEach((r) => {
    if (!byUid.has(r.uid)) byUid.set(r.uid, []);
    byUid.get(r.uid).push(r);
  });
  h += `<div class="card"><h2>Par joueur (moyennes)</h2><div class="sc2"><table>
    <tr><th>Joueur</th><th>Poste</th><th>Nb</th>${KEYS.map((k) => `<th>${SHORT[k]}</th>`).join("")}<th>Blessures</th><th>Dernière</th></tr>`;
  [...byUid.values()].sort((a, b) => a[0].name.localeCompare(b[0].name)).forEach((e) => {
    const nb = e.filter((x) => x.blessure).length;
    h += `<tr><td>${esc(e[0].name)}</td><td>${esc(e[0].poste)}</td><td>${e.length}</td>${KEYS.map((k) => `<td>${f0(avg(e.map((x) => x[k])))}</td>`).join("")}<td class="${nb ? "warn" : ""}">${nb}</td><td>${frDate(e[0].date)}</td></tr>`;
  });
  h += `</table></div></div>`;

  // Intensité par séance (12 dernières)
  const keys = [...new Set(rows.map((r) => r.seanceKey))].sort().slice(-12);
  if (keys.length) {
    h += `<div class="card"><h2>Intensité (musculaire + cardio) par séance</h2>` +
      keys.map((k) => {
        const group = rows.filter((r) => r.seanceKey === k);
        return bar(`${group[0].seance} (${group.length})`, avg(group.flatMap((r) => [r.mus, r.car])));
      }).join("") + `</div>`;
  }

  h += `<button class="go" id="csv" ${rows.length ? "" : "disabled"}>Télécharger en CSV (Excel / Numbers)</button>`;
  el.innerHTML = h;

  $("#fPeriod").onchange = (e) => { filters.period = e.target.value; renderTeam(el); };
  $("#fPoste").onchange = (e) => { filters.poste = e.target.value; draw(el); };
  $("#fUid").onchange = (e) => { filters.uid = e.target.value; draw(el); };
  $("#csv").onclick = () => downloadCsv(rows);
}

function bar(label, v, opp) {
  const w = v == null ? 0 : v;
  const red = opp && v != null && Math.abs(v - 50) > 20;
  return `<div class="row"><span class="n">${esc(label)}</span><span class="b"><i style="width:${w}%${red ? ";background:var(--rd)" : ""}"></i>${opp ? '<span class="mid"></span>' : ""}</span><span class="v">${f0(v)}</span></div>`;
}

export function downloadCsv(rows, prefix = "ressenti-seance") {
  const head = ["nom", "poste", "date", "seance", ...KEYS, "blessure", "gene"];
  const cell = (x) => `"${String(x ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map((r) => [r.name, r.poste, r.date, r.seance || "", ...KEYS.map((k) => r[k]), r.blessure ? "oui" : "non", r.gene].map(cell).join(";"));
  // BOM + point-virgule : ouverture directe et accents corrects dans Excel FR.
  const blob = new Blob(["﻿" + [head.join(";"), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${prefix}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

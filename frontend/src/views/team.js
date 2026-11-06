import { api } from "../api.js";
import { KEYS, POSTES, QS, SHORT } from "../questions.js";
import { $, avg, daysAgo, esc, f0, frDate } from "../util.js";

const PERIODS = [["7", "7 derniers jours"], ["30", "30 derniers jours"], ["90", "3 derniers mois"], ["all", "Tout"]];
const filters = { period: "30", poste: "", uid: "" };
let allRows = [];

export async function renderTeam(el) {
  el.innerHTML = `<div class="card"><div class="mu">Chargement des réponses…</div></div>`;
  try {
    allRows = await api.teamResponses(filters.period === "all" ? null : daysAgo(+filters.period - 1));
  } catch (e) {
    el.innerHTML = `<div class="card warn">${esc(e.message)}</div>`;
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

  // Intensité par séance
  const dates = [...new Set(rows.map((r) => r.date))].sort().slice(-12);
  if (dates.length) {
    h += `<div class="card"><h2>Intensité (musculaire + cardio) par séance</h2>` +
      dates.map((d) => {
        const day = rows.filter((r) => r.date === d);
        return bar(`${frDate(d)} (${day.length})`, avg(day.flatMap((r) => [r.mus, r.car])));
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

function downloadCsv(rows) {
  const head = ["nom", "poste", "date", ...KEYS, "blessure", "gene"];
  const cell = (x) => `"${String(x ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map((r) => [r.name, r.poste, r.date, ...KEYS.map((k) => r[k]), r.blessure ? "oui" : "non", r.gene].map(cell).join(";"));
  // BOM + point-virgule : ouverture directe et accents corrects dans Excel FR.
  const blob = new Blob(["﻿" + [head.join(";"), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `ressenti-seance-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

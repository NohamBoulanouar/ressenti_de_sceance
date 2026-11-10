import { api, errorMessage } from "../api.js";
import { KEYS, POSTES, QS, SHORT } from "../questions.js";
import { $, avg, claimView, daysAgo, esc, f0, frDate, localDate, sessionLabel } from "../util.js";

const PERIODS = [["7", "7 derniers jours"], ["30", "30 derniers jours"], ["90", "3 derniers mois"], ["all", "Tout"]];
// mode "period" : vue d'ensemble sur une période ; mode "session" : le détail d'une séance.
const filters = { mode: "period", period: "30", sessionId: "", poste: "", uid: "" };
let data = { rows: [], athletes: [], sessions: [] };

/** Ouvre le suivi directement sur une séance (lien depuis l'onglet Séances). */
export function focusSession(id) {
  filters.mode = "session";
  filters.sessionId = id;
}

const created = (u) => (u.createdAt?.toDate ? localDate(u.createdAt.toDate()) : "0000-00-00");

export async function renderTeam(el) {
  const still = claimView(el);
  el.innerHTML = `<div class="card"><div class="mu">Chargement des réponses…</div></div>`;
  try {
    const [users, sessions] = await Promise.all([api.users(), api.sessions()]);
    const past = sessions.filter((s) => s.date <= localDate()).reverse(); // séances passées, récentes d'abord
    if (filters.mode === "session" && !past.some((s) => s.id === filters.sessionId)) filters.sessionId = past[0]?.id || "";

    const rows = filters.mode === "session"
      ? (filters.sessionId ? await api.sessionResponses(filters.sessionId) : [])
      : await api.teamResponses(filters.period === "all" ? null : daysAgo(+filters.period - 1));
    if (!still()) return;

    const sessionsById = new Map(sessions.map((s) => [s.id, s]));
    // Seuls les athlètes actuels comptent (un coach n'est que coach ; un membre retiré n'a plus de données).
    // Nom et poste actuels du joueur (s'il a modifié son profil depuis ses anciennes réponses).
    const athletes = users.filter((u) => u.role === "ATHLETE");
    const byUid = new Map(athletes.map((u) => [u.uid, u]));
    data = {
      athletes,
      sessions: past,
      rows: rows.filter((r) => byUid.has(r.uid)).map((r) => {
        const s = sessionsById.get(r.sessionId);
        return { ...r, name: byUid.get(r.uid).name, poste: byUid.get(r.uid).poste,
          seance: s ? sessionLabel(s) : frDate(r.date), seanceKey: s ? `${s.date} ${s.time || ""} ${s.id}` : r.date };
      }),
    };
  } catch (e) {
    if (still()) el.innerHTML = `<div class="card warn">${esc(errorMessage(e))}</div>`;
    return;
  }
  draw(el);
}

function draw(el) {
  const session = filters.mode === "session" ? data.sessions.find((s) => s.id === filters.sessionId) : null;
  const players = [...new Map(data.rows.map((r) => [r.uid, r.name])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const rows = data.rows.filter((r) => (!filters.poste || r.poste === filters.poste) && (!filters.uid || r.uid === filters.uid));

  let h = `
    <div class="card">
      <div class="seg">
        <button data-mode="period" class="${filters.mode === "period" ? "on" : ""}">Par période</button>
        <button data-mode="session" class="${filters.mode === "session" ? "on" : ""}">Par séance</button>
      </div>
      <div class="filters" style="margin-top:10px">
        ${filters.mode === "period"
          ? `<select id="fPeriod">${PERIODS.map(([v, l]) => `<option value="${v}" ${filters.period === v ? "selected" : ""}>${l}</option>`).join("")}</select>`
          : `<select id="fSession" class="wide-select">${data.sessions.length
              ? data.sessions.map((s) => `<option value="${esc(s.id)}" ${s.id === filters.sessionId ? "selected" : ""}>${esc(sessionLabel(s))}</option>`).join("")
              : `<option value="">Aucune séance passée</option>`}</select>`}
        <select id="fPoste"><option value="">Tous les postes</option>${POSTES.map((p) => `<option ${filters.poste === p ? "selected" : ""}>${esc(p)}</option>`).join("")}</select>
        ${filters.mode === "period"
          ? `<select id="fUid"><option value="">Tous les joueurs</option>${players.map(([u, n]) => `<option value="${esc(u)}" ${filters.uid === u ? "selected" : ""}>${esc(n)}</option>`).join("")}</select>`
          : ""}
      </div>
    </div>`;

  if (filters.mode === "session") h += sessionView(session, rows);
  else h += periodView(rows);

  h += `<button class="go" id="csv" ${rows.length ? "" : "disabled"}>Télécharger en CSV (Excel / Numbers)</button>`;
  el.innerHTML = h;

  el.querySelectorAll("[data-mode]").forEach((b) => {
    b.onclick = () => { filters.mode = b.dataset.mode; filters.uid = ""; renderTeam(el); };
  });
  $("#fPeriod") && ($("#fPeriod").onchange = (e) => { filters.period = e.target.value; renderTeam(el); });
  $("#fSession") && ($("#fSession").onchange = (e) => { filters.sessionId = e.target.value; renderTeam(el); });
  $("#fPoste").onchange = (e) => { filters.poste = e.target.value; draw(el); };
  $("#fUid") && ($("#fUid").onchange = (e) => { filters.uid = e.target.value; draw(el); });
  $("#csv").onclick = () => downloadCsv(rows, session ? `seance-${session.date}` : "ressenti-seance");
  el.querySelectorAll("[data-open]").forEach((d) => {
    d.onclick = () => { focusSession(d.dataset.open); renderTeam(el); window.scrollTo({ top: 0 }); };
  });
}

/** Moyennes par thème (barres). */
function averages(rows, title) {
  let h = `<div class="card"><h2>${title}</h2>`;
  if (!rows.length) h += `<div class="mu">Aucune réponse.</div>`;
  QS.forEach(([t, qs]) => {
    h += `<div class="mu" style="margin-top:8px"><b>${t}</b></div>` + qs.map((q) => bar(q[1], avg(rows.map((r) => r[q[0]])))).join("");
  });
  return h + `</div>`;
}

// ── Vue « par séance » ─────────────────────────────────────────────────────────
function sessionView(session, rows) {
  if (!session) return `<div class="card"><div class="mu">Aucune séance passée. Planifie des séances dans l'onglet « Séances ».</div></div>`;

  const answered = new Set(data.rows.map((r) => r.uid));
  const missing = data.athletes
    .filter((u) => !answered.has(u.uid) && created(u) <= session.date)
    .filter((u) => !filters.poste || u.poste === filters.poste);
  const expected = rows.length + missing.length;

  let h = `<div class="card">
    <div class="sess-head">
      <h2 style="margin:0">${esc(sessionLabel(session))}</h2>
      <div class="sess-count ${missing.length ? "" : "ok"}">${expected ? `${rows.length}/${expected} réponses` : "—"}</div>
    </div>
    ${missing.length
      ? `<div class="q" style="margin-top:10px"><b class="warn">Pas encore répondu (${missing.length})</b></div>
         <div class="missing">${missing.map((u) => `<span class="chip">${esc(u.name)} <span class="mu">${esc(u.poste)}</span></span>`).join("")}</div>`
      : expected ? `<div class="mu ok" style="margin-top:8px">Tout le monde a répondu</div>` : ""}
  </div>`;

  h += averages(rows, "Moyennes de la séance");

  const inj = rows.filter((r) => r.blessure || r.gene);
  if (inj.length) {
    h += `<div class="card alert"><h2>Blessures et gênes</h2>` +
      inj.map((r) => `<div class="row"><span class="n">${esc(r.name)}</span><span class="${r.blessure ? "warn" : ""}">${r.blessure ? "Blessure " : ""}${esc(r.gene || "")}</span></div>`).join("") + `</div>`;
  }

  // Détail : une ligne par athlète, valeurs hors norme mises en évidence.
  const flag = (k, v) => ["conc", "pla", "conf", "rep", "tec", "tac"].includes(k) && v < 30;
  h += `<div class="card"><h2>Réponses des athlètes</h2>${rows.length ? `<div class="sc2"><table>
    <tr><th>Joueur</th><th>Poste</th>${KEYS.map((k) => `<th>${SHORT[k]}</th>`).join("")}<th>Blessure</th><th>Gêne</th></tr>
    ${[...rows].sort((a, b) => a.name.localeCompare(b.name, "fr")).map((r) => `<tr>
      <td>${esc(r.name)}</td><td>${esc(r.poste)}</td>
      ${KEYS.map((k) => `<td class="${flag(k, r[k]) ? "warn" : ""}">${r[k]}</td>`).join("")}
      <td class="${r.blessure ? "warn" : ""}">${r.blessure ? "Oui" : "Non"}</td>
      <td class="l">${esc(r.gene || "")}</td>
    </tr>`).join("")}
  </table></div>
  <div class="mu" style="margin-top:8px">En rouge : concentration, plaisir, confiance, répétition, technique ou tactique sous 30.</div>`
    : `<div class="mu">Aucune réponse à cette séance.</div>`}</div>`;
  return h;
}

// ── Vue « par période » ────────────────────────────────────────────────────────
function periodView(rows) {
  let h = averages(rows, `Moyennes (${rows.length} réponse${rows.length > 1 ? "s" : ""})`);

  const inj = rows.filter((r) => r.blessure || r.gene);
  h += `<div class="card"><h2>Blessures et gênes</h2>` + (inj.length
    ? inj.slice(0, 20).map((r) => `<div class="row"><span class="n">${esc(r.seance)} · ${esc(r.name)}</span><span class="${r.blessure ? "warn" : ""}">${r.blessure ? "Blessure " : ""}${esc(r.gene || "")}</span></div>`).join("")
    : `<div class="mu">Rien à signaler.</div>`) + `</div>`;

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

  // Par séance : intensité moyenne, cliquable pour ouvrir le détail.
  const keys = [...new Set(rows.map((r) => r.seanceKey))].sort().reverse().slice(0, 12);
  if (keys.length) {
    h += `<div class="card"><h2>Par séance</h2><div class="mu" style="margin-bottom:6px">Intensité moyenne (musculaire + cardio). Clique sur une séance pour voir le détail.</div>` +
      keys.map((k) => {
        const group = rows.filter((r) => r.seanceKey === k);
        const id = group[0].sessionId;
        return `<div class="${id ? "clickable" : ""}" ${id ? `data-open="${esc(id)}"` : ""}>${bar(`${group[0].seance} (${group.length})`, avg(group.flatMap((r) => [r.mus, r.car])))}</div>`;
      }).join("") + `</div>`;
  }
  return h;
}

function bar(label, v) {
  const w = v == null ? 0 : v;
  return `<div class="row"><span class="n">${esc(label)}</span><span class="b"><i style="width:${w}%"></i></span><span class="v">${f0(v)}</span></div>`;
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

import { api, errorMessage } from "../api.js";
import { KEYS, LABELS, POSTES, QS, SHORT } from "../questions.js";
import { $, avg, claimView, daysAgo, esc, f0, frDate, localDate, sessionLabel } from "../util.js";
import { barChart, lineChart, MAIN, POSTE_COLORS, slope } from "../charts.js";

const PERIODS = [["7", "7 derniers jours"], ["30", "30 derniers jours"], ["90", "3 derniers mois"], ["all", "Tout"]];
// mode "period" : vue d'ensemble sur une période ; mode "session" : le détail d'une séance.
// postes : postes retenus (vide = tous) ; injured : inclure les réponses avec blessure dans les calculs ;
// split : une courbe par poste au lieu de la moyenne du groupe.
const filters = { mode: "period", period: "30", sessionId: "", postes: new Set(), uid: "", injured: true, split: false };
let data = { rows: [], athletes: [], sessions: [], teamId: null };
const SESSION_HISTORY = 10; // vue séance : nombre de séances affichées sur les courbes

/** Ouvre le suivi directement sur une séance (lien depuis l'onglet Séances). */
export function focusSession(id) {
  filters.mode = "session";
  filters.sessionId = id;
}

export async function renderTeam(el, team) {
  const still = claimView(el);
  if (data.teamId !== team.id) {
    // Changement d'équipe : on repart des filtres par défaut (le joueur choisi n'existe pas forcément ici).
    filters.uid = "";
    if (data.teamId) filters.sessionId = "";
  }
  el.innerHTML = `<div class="card"><div class="mu">Chargement des réponses…</div></div>`;
  try {
    const [users, members, sessions, responses] = await Promise.all([
      api.users(), api.members(team.id), api.sessions(team.id), api.teamResponses(team.id),
    ]);
    if (!still()) return;
    const past = sessions.filter((s) => s.date <= localDate()); // séances passées, de la plus ancienne à la plus récente
    if (filters.mode === "session" && !past.some((s) => s.id === filters.sessionId)) filters.sessionId = past.at(-1)?.id || "";

    const sessionsById = new Map(sessions.map((s) => [s.id, s]));
    // Seuls les athlètes actuels de l'équipe comptent (un coach n'est que coach ; un membre retiré n'a plus de données).
    // Nom et poste actuels du joueur (s'il a modifié son profil depuis ses anciennes réponses).
    const since = new Map(members.map((m) => [m.uid, m.since]));
    const athletes = users.filter((u) => u.role === "ATHLETE" && since.has(u.uid)).map((u) => ({ ...u, since: since.get(u.uid) }));
    const byUid = new Map(athletes.map((u) => [u.uid, u]));
    data = {
      teamId: team.id,
      athletes,
      sessions: past,
      rows: responses.filter((r) => byUid.has(r.uid)).map((r) => {
        const s = sessionsById.get(r.sessionId);
        return { ...r, name: byUid.get(r.uid).name, poste: byUid.get(r.uid).poste, seance: s ? sessionLabel(s) : frDate(r.date) };
      }),
    };
  } catch (e) {
    if (still()) el.innerHTML = `<div class="card warn">${esc(errorMessage(e))}</div>`;
    return;
  }
  draw(el, team);
}

const posteOk = (p) => !filters.postes.size || filters.postes.has(p);
const pl = (n, w) => `${n} ${w}${n > 1 ? "s" : ""}`;

function draw(el, team) {
  const session = filters.mode === "session" ? data.sessions.find((s) => s.id === filters.sessionId) : null;
  // Réponses retenues par les filtres « personnes » (postes, joueur). Les blessés sont filtrés à part, pour les calculs.
  let scope = data.rows.filter((r) => posteOk(r.poste) && (!filters.uid || r.uid === filters.uid));
  if (filters.mode === "period" && filters.period !== "all") {
    const from = daysAgo(+filters.period - 1);
    scope = scope.filter((r) => r.date >= from);
  }
  const calc = filters.injured ? scope : scope.filter((r) => !r.blessure);
  const excluded = scope.length - calc.length;
  const players = [...new Map(data.rows.filter((r) => posteOk(r.poste)).map((r) => [r.uid, r.name])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1], "fr"));
  if (filters.uid && !players.some(([u]) => u === filters.uid)) filters.uid = "";

  let h = `
    <div class="card">
      <div class="seg">
        <button data-mode="period" class="${filters.mode === "period" ? "on" : ""}">Par période</button>
        <button data-mode="session" class="${filters.mode === "session" ? "on" : ""}">Par séance</button>
      </div>
      <div class="filters" style="margin-top:10px">
        ${filters.mode === "period"
          ? `<select id="fPeriod">${PERIODS.map(([v, l]) => `<option value="${v}" ${filters.period === v ? "selected" : ""}>${l}</option>`).join("")}</select>
             <select id="fUid"><option value="">Tous les joueurs</option>${players.map(([u, n]) => `<option value="${esc(u)}" ${filters.uid === u ? "selected" : ""}>${esc(n)}</option>`).join("")}</select>`
          : `<select id="fSession" class="wide-select">${data.sessions.length
              ? [...data.sessions].reverse().map((s) => `<option value="${esc(s.id)}" ${s.id === filters.sessionId ? "selected" : ""}>${esc(sessionLabel(s))}</option>`).join("")
              : `<option value="">Aucune séance passée</option>`}</select>`}
      </div>
      <div class="flabel">Postes</div>
      <div class="pchips">
        <button class="pchip ${filters.postes.size ? "" : "on"}" data-poste="">Tous</button>
        ${POSTES.map((p, i) => `<button class="pchip ${filters.postes.has(p) ? "on" : ""}" data-poste="${esc(p)}" style="--c:${POSTE_COLORS[i]}"><i></i>${esc(p)}</button>`).join("")}
      </div>
      <div class="toggles">
        <label class="tgl"><input type="checkbox" id="fInj" ${filters.injured ? "" : "checked"}><span>Exclure les joueurs blessés des calculs</span></label>
        ${filters.uid ? "" : `<label class="tgl"><input type="checkbox" id="fSplit" ${filters.split ? "checked" : ""}><span>Une courbe par poste</span></label>`}
      </div>
      ${!filters.injured ? `<div class="mu" style="margin-top:6px">${excluded
        ? `${pl(excluded, "réponse")} avec blessure ${excluded > 1 ? "sont retirées" : "est retirée"} des moyennes et des courbes (elles restent listées dans « Blessures et gênes »).`
        : "Aucune réponse avec blessure dans la sélection."}</div>` : ""}
    </div>`;

  h += filters.mode === "session" ? sessionView(session, scope, calc) : periodView(scope, calc);
  h += `<button class="go" id="csv" ${scope.length ? "" : "disabled"}>Télécharger en CSV (Excel / Numbers)</button>`;
  el.innerHTML = h;

  const redraw = () => draw(el, team);
  el.querySelectorAll("[data-mode]").forEach((b) => {
    b.onclick = () => { filters.mode = b.dataset.mode; filters.uid = ""; renderTeam(el, team); };
  });
  $("#fPeriod") && ($("#fPeriod").onchange = (e) => { filters.period = e.target.value; redraw(); });
  $("#fSession") && ($("#fSession").onchange = (e) => { filters.sessionId = e.target.value; redraw(); });
  $("#fUid") && ($("#fUid").onchange = (e) => { filters.uid = e.target.value; redraw(); });
  $("#fInj").onchange = (e) => { filters.injured = !e.target.checked; redraw(); };
  $("#fSplit") && ($("#fSplit").onchange = (e) => { filters.split = e.target.checked; redraw(); });
  el.querySelectorAll("[data-poste]").forEach((b) => {
    b.onclick = () => {
      const p = b.dataset.poste;
      if (!p) filters.postes.clear();
      else if (filters.postes.has(p)) filters.postes.delete(p);
      else filters.postes.add(p);
      if (filters.postes.size === POSTES.length) filters.postes.clear(); // tous cochés = « Tous »
      redraw();
    };
  });
  const file = `${session ? `seance-${session.date}` : "ressenti-seance"}`;
  $("#csv").onclick = () => downloadCsv(scope, file);
  el.querySelectorAll("[data-open]").forEach((d) => {
    d.onclick = () => { focusSession(d.dataset.open); redraw(); window.scrollTo({ top: 0 }); };
  });
}

// ── Calculs ────────────────────────────────────────────────────────────────────
/** Séances (dans l'ordre) qui ont au moins une réponse parmi rows. */
function sessionsWith(rows, list = data.sessions) {
  const ids = new Set(rows.map((r) => r.sessionId));
  return list.filter((s) => ids.has(s.id));
}

/** Moyenne d'un indicateur pour chaque séance (null si personne n'a répondu). */
function perSession(sessions, rows, key) {
  return sessions.map((s) => avg(rows.filter((r) => r.sessionId === s.id).map((r) => r[key])));
}

/** Séries à tracer : moyenne du groupe, ou une courbe par poste retenu. */
function seriesFor(sessions, rows, key) {
  const split = filters.split && !filters.uid;
  if (!split) return [{ name: "", color: MAIN, values: perSession(sessions, rows, key) }];
  return POSTES.map((p, i) => ({ p, i }))
    .filter(({ p }) => posteOk(p) && rows.some((r) => r.poste === p))
    .map(({ p, i }) => ({ name: p, color: POSTE_COLORS[i], values: perSession(sessions, rows.filter((r) => r.poste === p), key) }));
}

const signed = (v, d = 0) => (v > 0 ? "+" : v < 0 ? "−" : "±") + Math.abs(v).toFixed(d);
function deltaHtml(cur, prev, label) {
  if (cur == null || prev == null) return `<span class="mu">${label} : —</span>`;
  const d = cur - prev;
  const pct = prev ? (d / prev) * 100 : null;
  const cls = Math.abs(d) < 0.5 ? "flat" : d > 0 ? "up" : "down";
  return `<span class="delta ${cls}">${cls === "up" ? "↗" : cls === "down" ? "↘" : "→"} ${signed(d)} pts${pct != null && Math.abs(d) >= 0.5 ? ` (${signed(pct)} %)` : ""}</span> <span class="mu">${label}</span>`;
}

function legend(series) {
  if (series.length < 2) return "";
  return `<div class="legend">${series.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join("")}</div>`;
}

/**
 * Une carte par indicateur : valeur, évolution, courbe.
 * period : valeur = moyenne de la période ; évolution = dernière séance vs précédente, et tendance sur la période.
 * session : valeur = la séance ; évolution vs la séance précédente ; courbe des dernières séances.
 */
function metricCards(rows, { focus = null } = {}) {
  let sessions = sessionsWith(rows);
  let highlight = -1;
  if (focus) {
    const upto = sessionsWith(rows, data.sessions.slice(0, data.sessions.findIndex((s) => s.id === focus.id) + 1));
    sessions = upto.slice(-SESSION_HISTORY);
    highlight = sessions.findIndex((s) => s.id === focus.id);
  }
  const labels = sessions.map((s) => ({ date: s.date, title: s.title }));
  let h = "";
  QS.forEach(([theme, qs]) => {
    h += `<div class="theme">${theme}</div><div class="mgrid">`;
    qs.forEach(([key]) => {
      const combined = perSession(sessions, rows, key);
      const series = seriesFor(sessions, rows, key);
      let value, stats;
      if (focus) {
        const i = highlight;
        value = i >= 0 ? combined[i] : null;
        const prev = i > 0 ? combined.slice(0, i).filter((v) => v != null).at(-1) : null;
        stats = deltaHtml(value, prev ?? null, "vs séance précédente");
      } else {
        value = avg(rows.map((r) => r[key]));
        const pts = combined.filter((v) => v != null);
        const k = slope(combined);
        stats = deltaHtml(pts.at(-1) ?? null, pts.at(-2) ?? null, "dernière vs précédente")
          + `<br><span class="mu">Dernière séance : <b>${f0(pts.at(-1) ?? null)}</b>${k == null ? "" : ` · Tendance : <b>${signed(k * (pts.length - 1))} pts</b> sur la période`}</span>`;
      }
      h += `<div class="mcard">
        <div class="mhead"><span class="mname">${esc(LABELS[key])}</span><span class="mval">${f0(value)}</span></div>
        <div class="mstats">${stats}</div>
        ${combined.every((v) => v == null)
          ? `<div class="chart-empty mu">Pas encore de réponse pour cet indicateur.</div>`
          : lineChart(labels, series, { mean: focus || series.length > 1 ? null : avg(rows.map((r) => r[key])), highlight }) + legend(series)}
      </div>`;
    });
    h += `</div>`;
  });
  return h;
}

// ── Vue « par séance » ─────────────────────────────────────────────────────────
function sessionView(session, scope, calc) {
  if (!session) return `<div class="card"><div class="mu">Aucune séance passée. Planifie des séances dans l'onglet « Séances ».</div></div>`;
  const here = scope.filter((r) => r.sessionId === session.id);
  const hereCalc = calc.filter((r) => r.sessionId === session.id);

  const answered = new Set(data.rows.filter((r) => r.sessionId === session.id).map((r) => r.uid));
  const missing = data.athletes
    .filter((u) => !answered.has(u.uid) && u.since <= session.date)
    .filter((u) => posteOk(u.poste) && (!filters.uid || u.uid === filters.uid));
  const expected = here.length + missing.length;

  let h = `<div class="card">
    <div class="sess-head">
      <h2 style="margin:0">${esc(sessionLabel(session))}</h2>
      <div class="sess-count ${missing.length ? "" : "ok"}">${expected ? `${here.length}/${expected} réponses` : "—"}</div>
    </div>
    ${missing.length
      ? `<div class="q" style="margin-top:10px"><b class="warn">Pas encore répondu (${missing.length})</b></div>
         <div class="missing">${missing.map((u) => `<span class="chip">${esc(u.name)} <span class="mu">${esc(u.poste)}</span></span>`).join("")}</div>`
      : expected ? `<div class="mu ok" style="margin-top:8px">Tout le monde a répondu</div>` : ""}
  </div>`;

  h += `<div class="card"><h2>Indicateurs de la séance</h2>
    <div class="mu" style="margin:-6px 0 4px">Moyenne de la séance, évolution par rapport à la séance précédente et courbe des ${SESSION_HISTORY} dernières séances (séance choisie en surbrillance).</div>
    ${hereCalc.length ? metricCards(calc, { focus: session }) : `<div class="mu" style="margin-top:8px">Aucune réponse prise en compte pour cette séance.</div>`}</div>`;

  const inj = here.filter((r) => r.blessure || r.gene);
  if (inj.length) {
    h += `<div class="card alert"><h2>Blessures et gênes</h2>` +
      inj.map((r) => `<div class="row"><span class="n">${esc(r.name)}</span><span class="${r.blessure ? "warn" : ""}">${r.blessure ? "Blessure " : ""}${esc(r.gene || "")}</span></div>`).join("") + `</div>`;
  }

  // Détail : une ligne par athlète, valeurs basses mises en évidence.
  const flag = (k, v) => ["conc", "pla", "conf", "rep", "tec", "tac"].includes(k) && v < 30;
  h += `<div class="card"><h2>Réponses des athlètes</h2>${here.length ? `<div class="sc2"><table>
    <tr><th>Joueur</th><th>Poste</th>${KEYS.map((k) => `<th>${SHORT[k]}</th>`).join("")}<th>Blessure</th><th>Gêne</th></tr>
    ${[...here].sort((a, b) => a.name.localeCompare(b.name, "fr")).map((r) => `<tr class="${!filters.injured && r.blessure ? "out" : ""}">
      <td>${esc(r.name)}</td><td>${esc(r.poste)}</td>
      ${KEYS.map((k) => `<td class="${flag(k, r[k]) ? "warn" : ""}">${r[k] ?? "–"}</td>`).join("")}
      <td class="${r.blessure ? "warn" : ""}">${r.blessure ? "Oui" : "Non"}</td>
      <td class="l">${esc(r.gene || "")}</td>
    </tr>`).join("")}
  </table></div>
  <div class="mu" style="margin-top:8px">En rouge : concentration, plaisir, confiance, répétition, technique ou tactique sous 30.${!filters.injured ? " Lignes grisées : exclues des calculs (blessure)." : ""}</div>`
    : `<div class="mu">Aucune réponse à cette séance.</div>`}</div>`;
  return h;
}

// ── Vue « par période » ────────────────────────────────────────────────────────
function periodView(scope, calc) {
  const nbSessions = sessionsWith(calc).length;
  let h = `<div class="card"><h2>Indicateurs</h2>
    <div class="mu" style="margin:-6px 0 4px">${scope.length
      ? `${pl(calc.length, "réponse")} sur ${pl(nbSessions, "séance")}. Grand chiffre : moyenne de la période ; pointillés : cette moyenne sur la courbe ; tendance : évolution estimée entre la première et la dernière séance.`
      : "Aucune réponse sur cette période."}</div>
    ${calc.length ? metricCards(calc) : ""}</div>`;

  // Blessures : courbe du nombre de blessures par séance, puis la liste.
  const sessions = sessionsWith(scope);
  const inj = scope.filter((r) => r.blessure || r.gene);
  h += `<div class="card"><h2>Blessures et gênes</h2>`;
  if (sessions.length) {
    const counts = sessions.map((s) => scope.filter((r) => r.sessionId === s.id && r.blessure).length);
    const total = counts.reduce((a, b) => a + b, 0);
    h += `<div class="mcard flat"><div class="mhead"><span class="mname">Blessures signalées par séance</span><span class="mval">${total}</span></div>
      ${barChart(sessions.map((s) => ({ date: s.date, title: s.title })), counts)}</div>`;
  }
  h += inj.length
    ? inj.slice(0, 20).map((r) => `<div class="row"><span class="n">${esc(r.seance)} · ${esc(r.name)}</span><span class="${r.blessure ? "warn" : ""}">${r.blessure ? "Blessure " : ""}${esc(r.gene || "")}</span></div>`).join("")
    : `<div class="mu">Rien à signaler.</div>`;
  h += `</div>`;

  // Par joueur : moyennes (sur les réponses prises en compte) et nombre de blessures (toutes).
  const byUid = new Map();
  scope.forEach((r) => {
    if (!byUid.has(r.uid)) byUid.set(r.uid, []);
    byUid.get(r.uid).push(r);
  });
  if (byUid.size) {
    h += `<div class="card"><h2>Par joueur (moyennes)</h2><div class="sc2"><table>
      <tr><th>Joueur</th><th>Poste</th><th>Nb</th>${KEYS.map((k) => `<th>${SHORT[k]}</th>`).join("")}<th>Blessures</th><th>Dernière</th></tr>`;
    [...byUid.values()].sort((a, b) => a[0].name.localeCompare(b[0].name, "fr")).forEach((e) => {
      const nb = e.filter((x) => x.blessure).length;
      const used = filters.injured ? e : e.filter((x) => !x.blessure);
      h += `<tr><td>${esc(e[0].name)}</td><td>${esc(e[0].poste)}</td><td>${used.length}</td>${KEYS.map((k) => `<td>${f0(avg(used.map((x) => x[k])))}</td>`).join("")}<td class="${nb ? "warn" : ""}">${nb}</td><td>${frDate(e[0].date)}</td></tr>`;
    });
    h += `</table></div></div>`;
  }

  // Par séance : intensité moyenne, cliquable pour ouvrir le détail.
  const recent = sessionsWith(calc).reverse().slice(0, 12);
  if (recent.length) {
    h += `<div class="card"><h2>Par séance</h2><div class="mu" style="margin-bottom:6px">Intensité moyenne (musculaire + cardio). Clique sur une séance pour voir le détail.</div>` +
      recent.map((s) => {
        const group = calc.filter((r) => r.sessionId === s.id);
        return `<div class="clickable" data-open="${esc(s.id)}">${bar(`${sessionLabel(s)} (${group.length})`, avg(group.flatMap((r) => [r.mus, r.car])))}</div>`;
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

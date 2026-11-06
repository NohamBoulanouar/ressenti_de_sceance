import { api, errorMessage } from "../api.js";
import { $, claimView, esc, frDay, localDate, sessionLabel, setMsg } from "../util.js";

const TITLES = ["Entraînement", "Match", "Musculation", "Récupération"];

/** Ajoute n semaines à une date "AAAA-MM-JJ" (calcul en date locale). */
function addWeeks(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  return localDate(new Date(y, m - 1, d + 7 * n));
}

const created = (u) => (u.createdAt?.toDate ? localDate(u.createdAt.toDate()) : "0000-00-00");

/** Onglet coach : planifier les séances et voir qui n'a pas répondu. */
export async function renderSessions(el, me, flash) {
  const still = claimView(el);
  el.innerHTML = `<div class="card"><div class="mu">Chargement des séances…</div></div>`;
  let sessions, responses, users;
  try {
    [sessions, responses, users] = await Promise.all([api.sessions(), api.teamResponses(null), api.users()]);
  } catch (e) {
    if (still()) el.innerHTML = `<div class="card warn">${esc(errorMessage(e))}</div>`;
    return;
  }
  if (!still()) return;

  const today = localDate();
  const athletes = users.filter((u) => u.role === "ATHLETE");
  const bySession = new Map();
  responses.forEach((r) => {
    if (!r.sessionId) return;
    if (!bySession.has(r.sessionId)) bySession.set(r.sessionId, new Set());
    bySession.get(r.sessionId).add(r.uid);
  });
  const past = sessions.filter((s) => s.date <= today).reverse();
  const upcoming = sessions.filter((s) => s.date > today);

  // Pour une séance : athlètes qui ont répondu, et ceux qui manquent parmi les inscrits au plus tard le jour de la séance.
  const status = (s) => {
    const done = bySession.get(s.id) || new Set();
    const answered = athletes.filter((u) => done.has(u.uid)).length;
    const missing = athletes.filter((u) => !done.has(u.uid) && created(u) <= s.date);
    return { expected: answered + missing.length, answered, missing };
  };

  const pastRow = (s) => {
    const st = status(s);
    const pct = st.expected ? Math.round((100 * st.answered) / st.expected) : 0;
    return `<div class="sess">
      <div class="sess-head">
        <div><b>${esc(s.title)}</b> <span class="mu">${esc(frDay(s.date))}${s.time ? " · " + esc(s.time) : ""}</span></div>
        <div class="sess-count ${st.missing.length ? "" : "ok"}">${st.expected ? `${st.answered}/${st.expected}` : "—"}</div>
      </div>
      <div class="row" style="margin:6px 0"><span class="b"><i style="width:${pct}%"></i></span></div>
      ${!st.expected
        ? `<div class="mu">Aucun athlète n'était inscrit à cette date.</div>`
        : st.missing.length
        ? `<details><summary>${st.missing.length} n'${st.missing.length > 1 ? "ont" : "a"} pas répondu</summary>
            <div class="missing">${st.missing.map((u) => `<span class="chip">${esc(u.name)} <span class="mu">${esc(u.poste)}</span></span>`).join("")}</div>
          </details>`
        : `<div class="mu ok">Tout le monde a répondu</div>`}
      <div class="sess-actions">
        ${st.answered ? `<button class="link" data-see="${esc(s.id)}">Voir les réponses →</button>` : ""}
        <button class="link danger-link" data-del="${esc(s.id)}">Supprimer la séance</button>
      </div>
    </div>`;
  };

  el.innerHTML = `
    ${flash ? `<div class="card ok">${esc(flash)}</div>` : ""}
    <form class="card" id="plan" novalidate>
      <h2>Planifier une séance</h2>
      <div class="filters">
        <div><div class="q" style="margin-top:0"><b>Date</b></div><input type="date" id="pDate" value="${today}"></div>
        <div><div class="q" style="margin-top:0"><b>Heure (facultatif)</b></div><input type="time" id="pTime"></div>
      </div>
      <div class="q"><b>Type</b></div>
      <select id="pTitle">${TITLES.map((t) => `<option>${t}</option>`).join("")}<option value="__autre">Autre…</option></select>
      <input type="text" id="pOther" maxlength="60" placeholder="Nom de la séance" hidden style="margin-top:8px">
      <label class="consent"><input type="checkbox" id="pRepeat"><span>Répéter chaque semaine pendant
        <input type="number" id="pWeeks" min="2" max="40" value="10" class="weeks"> semaines</span></label>
      <button class="go" type="submit" id="pSave">Planifier</button>
      <div id="pmsg" style="margin-top:8px;font-size:14px"></div>
    </form>

    <div class="card">
      <h2>À venir (${upcoming.length})</h2>
      ${upcoming.length
        ? upcoming.slice(0, 15).map((s) => `<div class="row"><span style="flex:1">${esc(sessionLabel(s))}</span><button class="link danger-link" data-del="${esc(s.id)}">Supprimer</button></div>`).join("")
          + (upcoming.length > 15 ? `<div class="mu">… et ${upcoming.length - 15} autres</div>` : "")
        : `<div class="mu">Aucune séance planifiée.</div>`}
    </div>

    <div class="card">
      <h2>Séances passées · réponses</h2>
      ${past.length ? past.slice(0, 20).map(pastRow).join("") : `<div class="mu">Aucune séance passée.</div>`}
      ${past.length > 20 ? `<div class="mu">Seules les 20 dernières séances sont affichées.</div>` : ""}
    </div>`;

  $("#pTitle").onchange = () => { $("#pOther").hidden = $("#pTitle").value !== "__autre"; };

  $("#plan").onsubmit = async (ev) => {
    ev.preventDefault();
    const msg = $("#pmsg");
    const date = $("#pDate").value;
    const time = $("#pTime").value || "";
    const title = $("#pTitle").value === "__autre" ? $("#pOther").value.trim() : $("#pTitle").value;
    if (!date) return setMsg(msg, "Choisis une date.");
    if (!title) return setMsg(msg, "Donne un nom à la séance.");
    const weeks = $("#pRepeat").checked ? Math.min(40, Math.max(2, +$("#pWeeks").value || 0)) : 1;
    const list = Array.from({ length: weeks }, (_, i) => ({ date: addWeeks(date, i), time, title }));
    const btn = $("#pSave");
    btn.disabled = true;
    try {
      await api.createSessions(list);
      renderSessions(el, me, weeks > 1 ? `${weeks} séances « ${title} » planifiées (chaque ${frDay(date).split(" ")[0]})` : `Séance planifiée : ${sessionLabel(list[0])}`);
    } catch (e) {
      setMsg(msg, errorMessage(e));
      btn.disabled = false;
    }
  };

  // « Voir les réponses » : main.js bascule sur l'onglet Suivi, vue par séance.
  el.querySelectorAll("[data-see]").forEach((b) => {
    b.onclick = () => window.dispatchEvent(new CustomEvent("open-session", { detail: b.dataset.see }));
  });

  const byId = new Map(sessions.map((s) => [s.id, s]));
  el.querySelectorAll("[data-del]").forEach((b) => {
    b.onclick = async () => {
      const s = byId.get(b.dataset.del);
      const n = bySession.get(s.id)?.size || 0;
      if (!confirm(`Supprimer la séance « ${sessionLabel(s)} » ?${n ? `\n\nLes ${n} réponse${n > 1 ? "s" : ""} à cette séance seront aussi supprimées.` : ""}`)) return;
      b.disabled = true;
      try {
        await api.deleteSession(s.id);
        renderSessions(el, me, `Séance supprimée : ${sessionLabel(s)}`);
      } catch (e) {
        alert(errorMessage(e));
        b.disabled = false;
      }
    };
  });
}

import { api, errorMessage } from "../api.js";
import { KEYS, QS } from "../questions.js";
import { $, $$, claimView, daysAgo, esc, localDate, sessionLabel, setMsg } from "../util.js";
import { ballLineHtml, initBallLines } from "../ballLine.js";

const WINDOW_DAYS = 21; // séances proposées : les 3 dernières semaines

/**
 * Questionnaire de l'athlète : il répond à une séance planifiée par le coach.
 * flash = message à afficher après un envoi.
 */
export async function renderQuestionnaire(el, me, team, flash) {
  const still = claimView(el);
  el.innerHTML = `<div class="card"><div class="mu">Chargement des séances…</div></div>`;

  let sessions, mine;
  try {
    [sessions, mine] = await Promise.all([api.sessions(team.id), api.myResponses(team.id, 200)]);
  } catch (e) {
    if (still()) el.innerHTML = `<div class="card warn">${esc(errorMessage(e))}</div>`;
    return;
  }
  if (!still()) return;

  const today = localDate();
  const answered = new Set(mine.map((r) => r.sessionId).filter(Boolean));
  // Séances passées ou du jour, les plus récentes d'abord.
  const open = sessions.filter((s) => s.date <= today && s.date >= daysAgo(WINDOW_DAYS)).reverse();
  const next = sessions.find((s) => s.date > today);
  const byId = new Map(sessions.map((s) => [s.id, s]));

  const history = `<div class="card" id="last"><h2>Mes dernières réponses</h2>${mine.length
    ? mine.slice(0, 5).map((x) => {
        const s = byId.get(x.sessionId);
        return `<div class="row"><span style="flex:1">${esc(s ? sessionLabel(s) : x.date)}</span><span class="${x.blessure ? "warn" : "ok"}">${x.blessure ? "Envoyé · blessure signalée" : "Envoyé ✔"}</span></div>`;
      }).join("")
    : `<div class="mu">Aucune réponse pour l'instant.</div>`}</div>`;

  if (!open.length) {
    el.innerHTML = `
      <div class="card">
        <h2>Aucune séance à remplir</h2>
        <div class="mu">Ton coach n'a pas encore planifié de séance ces derniers jours.${next ? ` Prochaine séance : <b>${esc(sessionLabel(next))}</b>.` : ""}</div>
      </div>
      ${flash ? `<div class="card ok">${esc(flash)}</div>` : ""}
      ${history}`;
    return;
  }

  // Séance proposée par défaut : la plus récente sans réponse, sinon la plus récente.
  const preselected = open.find((s) => !answered.has(s.id)) || open[0];
  const todo = open.filter((s) => !answered.has(s.id)).length;

  const form = {}; // valeurs des curseurs touchés
  let blessure = null;

  el.innerHTML = `
    ${flash ? `<div class="card ok">${esc(flash)}</div>` : ""}
    <div class="card">
      <div class="q" style="margin-top:0"><b>Séance</b>${todo ? `${todo} séance${todo > 1 ? "s" : ""} en attente de ta réponse.` : "Tu as répondu à toutes les séances 👍"}</div>
      <select id="sess">${open.map((s) => `<option value="${esc(s.id)}" ${s.id === preselected.id ? "selected" : ""}>${answered.has(s.id) ? "✔ " : "• "}${esc(sessionLabel(s))}${answered.has(s.id) ? " (déjà répondu)" : ""}</option>`).join("")}</select>
      <div class="mu" id="sessHint" style="margin-top:6px"></div>
    </div>
    ${QS.map(([title, qs]) => `
      <div class="card"><h2>${title}</h2>
        ${qs.map(([k, l, d, lo, hi]) => `
          <div class="q"><b>${l}</b>${d}</div>
          ${ballLineHtml(k, esc(l))}
          <div class="mu ends"><span>${lo}</span><span>${hi}</span></div>`).join("")}
      </div>`).join("")}
    <div class="card"><h2>Santé</h2>
      <div class="q"><b>Blessure</b>As-tu eu une blessure (pendant ou avant la séance) ?</div>
      <div class="yn" id="yn"><button type="button" data-b="0">Non</button><button type="button" data-b="1" class="bad">Oui</button></div>
      <div class="q"><b>Gêne ou douleur à signaler ? (facultatif)</b></div>
      <input type="text" id="ge" maxlength="200" placeholder="Ex. épaule droite, genou…">
    </div>
    <button class="go" id="send">Envoyer</button>
    <div id="msg" style="margin-top:8px;font-size:14px"></div>
    ${history}`;

  const hint = () => {
    $("#sessHint").textContent = answered.has($("#sess").value)
      ? "Tu as déjà répondu à cette séance : un nouvel envoi remplacera ta réponse."
      : "";
  };
  $("#sess").onchange = hint;
  hint();

  initBallLines(el, (k, v) => { form[k] = v; });
  $$("#yn button", el).forEach((b) => {
    b.onclick = () => {
      blessure = b.dataset.b === "1";
      $$("#yn button", el).forEach((x) => x.classList.toggle("on", x === b));
    };
  });

  $("#send").onclick = async () => {
    const msg = $("#msg");
    const missing = KEYS.filter((k) => !form[k]);
    if (missing.length || blessure === null) {
      $$(".bl:not(.set)", el).forEach((r) => r.classList.add("todo"));
      return setMsg(msg, "Place le ballon sur chaque ligne (appuie à l'endroit qui correspond à ton ressenti) et réponds à la question blessure.");
    }
    const s = byId.get($("#sess").value);
    const btn = $("#send");
    btn.disabled = true;
    try {
      const res = await api.submit(me, { teamId: team.id, sessionId: s.id, date: s.date, ...form, blessure, gene: $("#ge").value.trim() });
      renderQuestionnaire(el, me, team, res.updated ? `Réponse à « ${sessionLabel(s)} » mise à jour ✔` : "Merci, réponse enregistrée ✔");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setMsg(msg, errorMessage(e));
      btn.disabled = false;
    }
  };
}

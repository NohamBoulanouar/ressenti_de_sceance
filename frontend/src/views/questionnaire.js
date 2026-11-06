import { api } from "../api.js";
import { KEYS, QS } from "../questions.js";
import { $, $$, esc, frDate, localDate, setMsg } from "../util.js";

export function renderQuestionnaire(el) {
  const form = {}; // valeurs des curseurs touchés
  let blessure = null;

  el.innerHTML = `
    <div class="card">
      <div class="q" style="margin-top:0"><b>Date de la séance</b></div>
      <input type="date" id="dt" value="${localDate()}" max="${localDate()}">
    </div>
    ${QS.map(([title, qs]) => `
      <div class="card"><h2>${title}</h2>
        ${qs.map(([k, l, d, lo, hi]) => `
          <div class="q"><b>${l}</b>${d}</div>
          <div class="rg"><input type="range" min="1" max="100" value="50" data-k="${k}" aria-label="${esc(l)}"><span class="val" id="v_${k}">—</span></div>
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
    <div class="card" id="last"><h2>Mes dernières réponses</h2><div class="mu">Chargement…</div></div>`;

  $$('input[type=range]', el).forEach((r) => {
    r.oninput = () => {
      form[r.dataset.k] = +r.value;
      const v = $("#v_" + r.dataset.k);
      v.textContent = r.value;
      v.classList.add("on");
    };
  });
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
      return setMsg(msg, "Bouge chaque curseur (même pour le laisser à 50) et réponds à la question blessure.");
    }
    const btn = $("#send");
    btn.disabled = true;
    try {
      const date = $("#dt").value;
      const res = await api.submit({ date, ...form, blessure, gene: $("#ge").value.trim() });
      renderQuestionnaire(el);
      setMsg($("#msg"), res.updated
        ? `Réponse du ${frDate(date)} mise à jour ✔`
        : "Merci, réponse enregistrée ✔", true);
    } catch (e) {
      setMsg(msg, e.message);
      btn.disabled = false;
    }
  };

  loadLast();
}

async function loadLast() {
  const box = $("#last");
  try {
    const rows = await api.myResponses(5);
    box.innerHTML = `<h2>Mes dernières réponses</h2>` + (rows.length
      ? rows.map((x) => `<div class="row"><span class="n">${frDate(x.date)}</span><span>muscu ${x.mus} · cardio ${x.car} · plaisir ${x.pla}${x.blessure ? ' · <span class="warn">blessure</span>' : ""}</span></div>`).join("")
      : `<div class="mu">Aucune réponse pour l'instant.</div>`)
      + `<div class="mu" style="margin-top:8px">Renvoyer le questionnaire pour une même date remplace la réponse précédente.</div>`;
  } catch (e) {
    box.innerHTML = `<h2>Mes dernières réponses</h2><div class="warn">${esc(e.message)}</div>`;
  }
}

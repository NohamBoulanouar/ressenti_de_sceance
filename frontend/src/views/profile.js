import { signOut } from "firebase/auth";
import { auth } from "../firebase.js";
import { api } from "../api.js";
import { POSTES } from "../questions.js";
import { $, esc, setMsg } from "../util.js";

/**
 * Formulaire nom + poste.
 * current = null au premier passage (création du profil), sinon édition.
 */
export function renderProfile(el, current, onSaved, onCancel) {
  const first = !current;
  el.innerHTML = `
    ${first ? `<h1>Ressenti de séance</h1><div class="mu" style="font-size:14px">Dernière étape : présente-toi. Tu ne le feras qu'une fois.</div>` : ""}
    <form class="card" id="pf">
      <h2>${first ? "Ton profil" : "Modifier mon profil"}</h2>
      <div class="q"><b>Prénom / nom</b></div>
      <input type="text" id="nm" maxlength="60" value="${esc(current?.name)}" placeholder="Ton prénom et ton nom">
      <div class="q"><b>Poste</b></div>
      <select id="po"><option value="">Choisir…</option>${POSTES.map((p) => `<option ${current?.poste === p ? "selected" : ""}>${esc(p)}</option>`).join("")}</select>
      <div class="mu" style="margin-top:8px">Email : ${esc(current?.email || auth.currentUser?.email)}</div>
      <button class="go" id="save" type="submit">Enregistrer</button>
      <div id="pmsg" style="margin-top:8px;font-size:14px"></div>
    </form>
    <div class="center"><button class="link" id="pcancel">${first ? "Se déconnecter" : "Annuler"}</button></div>`;

  $("#pcancel").onclick = () => (first ? signOut(auth) : onCancel?.());
  $("#pf").onsubmit = async (ev) => {
    ev.preventDefault();
    const name = $("#nm").value.trim();
    const poste = $("#po").value;
    const msg = $("#pmsg");
    if (!name || !poste) return setMsg(msg, "Indique ton nom et ton poste.");
    const btn = $("#save");
    btn.disabled = true;
    try {
      onSaved(await api.saveProfile(name, poste));
    } catch (e) {
      setMsg(msg, e.message);
      btn.disabled = false;
    }
  };
}

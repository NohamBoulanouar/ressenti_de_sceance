import { signOut } from "firebase/auth";
import { auth } from "../firebase.js";
import { api, errorMessage } from "../api.js";
import { POSTES } from "../questions.js";
import { $, esc, setMsg } from "../util.js";
import { PRIVACY_HTML } from "./privacy.js";

/**
 * current = null : création du profil (premier passage), avec code d'équipe et consentement.
 * current = profil : modification + suppression du compte.
 */
export function renderProfile(el, current, onSaved, onCancel, { firstCoach = false, needPoste = false } = {}) {
  const first = !current;
  const coach = firstCoach || current?.role === "COACH"; // un coach n'a pas de poste
  el.innerHTML = `
    ${first ? `<h1>Ressenti de séance</h1><div class="mu" style="font-size:14px">Dernière étape : présente-toi. Tu ne le feras qu'une fois.</div>` : ""}
    ${first && firstCoach ? `<div class="card ok">Tu es le premier inscrit : ton compte sera <b>coach</b>. Tu pourras ensuite créer le code d'équipe à donner aux athlètes.</div>` : ""}
    <form class="card" id="pf" novalidate>
      <h2>${first ? "Ton profil" : "Modifier mon profil"}</h2>
      <div class="q"><b>Prénom / nom</b></div>
      <input type="text" id="nm" maxlength="60" value="${esc(current?.name)}" placeholder="Ton prénom et ton nom" autocomplete="name">
      ${needPoste ? `<div class="mu" style="margin-top:8px">Tu n'es plus coach : choisis ton poste pour répondre aux questionnaires.</div>` : ""}
      ${coach ? "" : `<div class="q"><b>Poste</b></div>
      <select id="po"><option value="">Choisir…</option>${POSTES.map((p) => `<option ${current?.poste === p ? "selected" : ""}>${esc(p)}</option>`).join("")}</select>`}
      ${first && !firstCoach ? `
        <div class="q"><b>Code d'équipe</b>Donné par ton coach.</div>
        <input type="text" id="code" maxlength="20" placeholder="Ex. RUGBY2026" autocapitalize="characters" autocomplete="off">` : ""}
      ${first ? `
        <label class="consent"><input type="checkbox" id="consent">
          <span>J'accepte que mes réponses, <b>y compris les informations sur mes blessures et douleurs (données de santé)</b>,
          soient enregistrées et consultées par les coachs de l'équipe.
          <button type="button" class="link inline" id="showPrivacy">Lire la politique de confidentialité</button></span>
        </label>
        <div class="card privacy" id="privacy" hidden>${PRIVACY_HTML}</div>` : ""}
      <div class="mu" style="margin-top:8px">Email : ${esc(current?.email || auth.currentUser?.email)}</div>
      <button class="go" id="save" type="submit">${first ? "Créer mon profil" : "Enregistrer"}</button>
      <div id="pmsg" style="margin-top:8px;font-size:14px"></div>
    </form>
    ${first ? "" : `
      <div class="card danger">
        <h2>Supprimer mon compte</h2>
        ${current.role === "COACH"
          ? `<div class="mu">Un compte coach ne peut pas être supprimé directement : demande d'abord à un autre coach de te repasser athlète.</div>`
          : `<div class="mu" style="margin-bottom:8px">Supprime définitivement ton compte et toutes tes réponses. Confirme avec ton mot de passe.</div>
             <input type="password" id="delPwd" placeholder="Mot de passe" autocomplete="current-password">
             <button class="btn bad" id="del" type="button" style="margin-top:8px">Supprimer définitivement</button>
             <div id="dmsg" style="margin-top:8px;font-size:14px"></div>`}
      </div>`}
    <div class="center"><button class="link" id="pcancel">${first || needPoste ? "Se déconnecter" : "Annuler"}</button></div>`;

  $("#pcancel").onclick = () => (first || needPoste ? signOut(auth) : onCancel?.());
  if (first) $("#showPrivacy").onclick = () => { $("#privacy").hidden = !$("#privacy").hidden; };

  $("#pf").onsubmit = async (ev) => {
    ev.preventDefault();
    const name = $("#nm").value.trim();
    const poste = coach ? null : $("#po").value;
    const msg = $("#pmsg");
    if (!name) return setMsg(msg, "Indique ton nom.");
    if (!coach && !poste) return setMsg(msg, "Choisis ton poste.");
    let joinCode;
    if (first && !firstCoach) {
      joinCode = $("#code").value.trim().toUpperCase();
      if (!joinCode) return setMsg(msg, "Entre le code d'équipe donné par ton coach.");
    }
    if (first && !$("#consent").checked) return setMsg(msg, "Coche la case de consentement pour continuer.");
    const btn = $("#save");
    btn.disabled = true;
    try {
      onSaved(first ? await api.createProfile({ name, poste, joinCode }) : await api.updateProfile(name, poste));
    } catch (e) {
      setMsg(msg, errorMessage(e));
      btn.disabled = false;
    }
  };

  const del = !first && $("#del");
  if (del) {
    del.onclick = async () => {
      const pwd = $("#delPwd").value;
      const msg = $("#dmsg");
      if (!pwd) return setMsg(msg, "Entre ton mot de passe pour confirmer.");
      if (!confirm("Supprimer définitivement ton compte et toutes tes réponses ?")) return;
      del.disabled = true;
      try {
        await api.deleteMyAccount(pwd);
        // onAuthStateChanged renvoie vers l'écran de connexion.
      } catch (e) {
        setMsg(msg, errorMessage(e));
        del.disabled = false;
      }
    };
  }
}

import "./style.css";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "./firebase.js";
import { api, errorMessage } from "./api.js";
import { $, esc } from "./util.js";
import { renderAuth } from "./views/auth.js";
import { renderProfile } from "./views/profile.js";
import { renderQuestionnaire } from "./views/questionnaire.js";
import { renderTeam } from "./views/team.js";
import { renderAccounts } from "./views/accounts.js";

const root = $("#app");
let me = null;
let currentTab = null;

// PWA : service worker uniquement sur le site publié (évite les soucis de cache en dev).
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    me = null;
    root.className = "";
    return renderAuth(root);
  }
  root.innerHTML = `<h1>Ressenti de séance</h1><div class="mu">Chargement du profil…</div>`;
  try {
    me = await api.me();
    if (me && me.role === "ATHLETE" && !me.poste) {
      // Ancien coach repassé athlète : il doit choisir son poste.
      return renderProfile(root, me, (profile) => { me = profile; renderShell(); }, null, { needPoste: true });
    }
    if (me) return renderShell();
    if (await api.isRemoved()) {
      root.innerHTML = `<h1>Ressenti de séance</h1>
        <div class="card warn">Ton compte a été retiré de l'équipe par le coach. Contacte-le si c'est une erreur.</div>
        <div class="center"><button class="link" id="out">Se déconnecter</button></div>`;
      $("#out").onclick = () => signOut(auth);
      return;
    }
    // Premier passage : nom, poste, code d'équipe et consentement, une seule fois.
    const firstCoach = !(await api.setupDone());
    renderProfile(root, null, (profile) => { me = profile; renderShell(); }, null, { firstCoach });
  } catch (e) {
    root.innerHTML = `<h1>Ressenti de séance</h1>
      <div class="card warn">${esc(errorMessage(e))}</div>
      <button class="go" id="retry">Réessayer</button>
      <div class="center"><button class="link" id="out">Se déconnecter</button></div>`;
    $("#retry").onclick = () => location.reload();
    $("#out").onclick = () => signOut(auth);
  }
});

function renderShell() {
  const coach = me.role === "COACH" || me.role === "DEV"; // DEV = développeur, mêmes accès qu'un coach
  // Un coach n'est que coach : pas de questionnaire.
  const tabs = coach ? [["team", "Suivi équipe"], ["accounts", "Équipe & code"]] : [["form", "Questionnaire"]];
  if (!tabs.some(([k]) => k === currentTab)) currentTab = tabs[0][0];

  root.innerHTML = `
    <div class="top">
      <h1>Ressenti de séance</h1>
      <div>
        <button class="link" id="editProfile">Mon profil</button>
        <button class="link" id="logout">Déconnexion</button>
      </div>
    </div>
    <div class="who">${esc(me.name)}${coach ? `<span class="badge">${me.role}</span>` : ` · ${esc(me.poste)}`}</div>
    ${tabs.length > 1 ? `<div class="tabs">${tabs.map(([k, l]) => `<button data-tab="${k}" class="${k === currentTab ? "on" : ""}">${l}</button>`).join("")}</div>` : ""}
    <div id="view"></div>`;

  root.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => { currentTab = b.dataset.tab; renderShell(); }));
  $("#logout").onclick = () => signOut(auth);
  $("#editProfile").onclick = () =>
    renderProfile($("#view"), me, (profile) => { me = profile; renderShell(); }, () => renderShell());

  const view = $("#view");
  root.className = currentTab === "form" ? "" : "wide";
  if (currentTab === "form") renderQuestionnaire(view, me);
  if (currentTab === "team") renderTeam(view);
  if (currentTab === "accounts") renderAccounts(view, me);
}

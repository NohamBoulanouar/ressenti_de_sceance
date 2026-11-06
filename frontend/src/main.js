import "./style.css";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "./firebase.js";
import { api, ApiError } from "./api.js";
import { $, esc } from "./util.js";
import { renderAuth } from "./views/auth.js";
import { renderProfile } from "./views/profile.js";
import { renderQuestionnaire } from "./views/questionnaire.js";
import { renderTeam } from "./views/team.js";
import { renderAccounts } from "./views/accounts.js";

const root = $("#app");
let me = null;
let currentTab = "form";

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    me = null;
    root.className = "";
    return renderAuth(root);
  }
  root.innerHTML = `<h1>Ressenti de séance</h1><div class="mu">Chargement du profil…</div>`;
  try {
    me = await api.me();
    renderShell();
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      // Premier passage : on demande nom + poste une seule fois.
      renderProfile(root, null, (profile) => { me = profile; renderShell(); });
    } else {
      root.innerHTML = `<h1>Ressenti de séance</h1>
        <div class="card warn">${esc(e.message)}</div>
        <button class="go" id="retry">Réessayer</button>
        <button class="link" id="out">Se déconnecter</button>`;
      $("#retry").onclick = () => location.reload();
      $("#out").onclick = () => signOut(auth);
    }
  }
});

function renderShell() {
  const coach = me.role === "COACH";
  const tabs = [["form", "Questionnaire"], ...(coach ? [["team", "Suivi équipe"], ["accounts", "Comptes"]] : [])];
  if (!tabs.some(([k]) => k === currentTab)) currentTab = "form";

  root.innerHTML = `
    <div class="top">
      <h1>Ressenti de séance</h1>
      <div>
        <button class="link" id="editProfile">Mon profil</button>
        <button class="link" id="logout">Déconnexion</button>
      </div>
    </div>
    <div class="who">${esc(me.name)} · ${esc(me.poste)}${coach ? '<span class="badge">COACH</span>' : ""}</div>
    ${tabs.length > 1 ? `<div class="tabs">${tabs.map(([k, l]) => `<button data-tab="${k}" class="${k === currentTab ? "on" : ""}">${l}</button>`).join("")}</div>` : ""}
    <div id="view"></div>`;

  root.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => { currentTab = b.dataset.tab; renderShell(); }));
  $("#logout").onclick = () => signOut(auth);
  $("#editProfile").onclick = () =>
    renderProfile($("#view"), me, (profile) => { me = profile; renderShell(); }, () => renderShell());

  const view = $("#view");
  root.className = currentTab === "team" || currentTab === "accounts" ? "wide" : "";
  if (currentTab === "form") renderQuestionnaire(view, me);
  if (currentTab === "team") renderTeam(view);
  if (currentTab === "accounts") renderAccounts(view, me);
}

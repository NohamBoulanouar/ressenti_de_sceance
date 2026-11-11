import "./style.css";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "./firebase.js";
import { api, errorMessage } from "./api.js";
import { $, esc } from "./util.js";
import { renderAuth } from "./views/auth.js";
import { renderProfile } from "./views/profile.js";
import { renderQuestionnaire } from "./views/questionnaire.js";
import { focusSession, renderTeam } from "./views/team.js";
import { renderAccounts } from "./views/accounts.js";
import { renderSessions } from "./views/sessions.js";
import { renderHome } from "./views/home.js";

const root = $("#app");
let me = null;
let team = null; // équipe choisie sur la page d'accueil { id, name }
let currentTab = null;
const TEAM_KEY = "rs-team"; // équipe choisie, gardée le temps de l'onglet (rechargement de page)
const isStaff = () => me && (me.role === "COACH" || me.role === "DEV"); // DEV = développeur, mêmes accès qu'un coach

function pickTeam(t) {
  team = t;
  try { sessionStorage.setItem(TEAM_KEY, t.id); } catch { /* stockage indisponible */ }
  renderShell();
}

/** Page d'accueil (choix de l'équipe), ou directement l'équipe déjà choisie dans cet onglet. */
async function start() {
  if (isStaff()) await api.migrateIfNeeded(); // une seule fois : rattache les anciennes données à une première équipe
  let saved = null;
  try { saved = sessionStorage.getItem(TEAM_KEY); } catch { /* stockage indisponible */ }
  if (saved) {
    const t = (await api.teams(isStaff())).find((x) => x.id === saved);
    if (t) return pickTeam(t);
  }
  goHome();
}

function goHome(flash) {
  team = null;
  try { sessionStorage.removeItem(TEAM_KEY); } catch { /* stockage indisponible */ }
  root.className = "";
  root.innerHTML = `${header()}<div id="view"></div>`;
  bindHeader();
  renderHome($("#view"), me, pickTeam, flash);
}

// PWA : service worker uniquement sur le site publié (évite les soucis de cache en dev).
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    me = null;
    team = null;
    root.className = "";
    return renderAuth(root);
  }
  root.innerHTML = `<h1>Ressenti de séance</h1><div class="mu">Chargement du profil…</div>`;
  try {
    me = await api.me();
    if (me && me.role === "ATHLETE" && !me.poste) {
      // Ancien coach repassé athlète : il doit choisir son poste.
      return renderProfile(root, me, (profile) => { me = profile; start(); }, null, { needPoste: true });
    }
    if (me) return await start();
    // Premier passage : nom, poste, code d'équipe et consentement, une seule fois.
    const firstCoach = !(await api.setupDone());
    renderProfile(root, null, (profile) => { me = profile; start(); }, null, { firstCoach });
  } catch (e) {
    root.innerHTML = `<h1>Ressenti de séance</h1>
      <div class="card warn">${esc(errorMessage(e))}</div>
      <button class="go" id="retry">Réessayer</button>
      <div class="center"><button class="link" id="out">Se déconnecter</button></div>`;
    $("#retry").onclick = () => location.reload();
    $("#out").onclick = () => signOut(auth);
  }
});

// Depuis l'onglet Séances : ouvrir le suivi d'une séance précise.
window.addEventListener("open-session", (e) => {
  focusSession(e.detail);
  currentTab = "team";
  renderShell();
  window.scrollTo({ top: 0 });
});

function header() {
  const coach = isStaff();
  return `
    <header class="top">
      <div class="brand">
        <img class="logo" src="/icons/apple-touch-icon.png" alt="">
        <div style="min-width:0">
          <div class="brand-name">Ressenti de séance</div>
          <div class="who">${esc(me.name)}${coach ? `<span class="badge">${me.role}</span>` : me.poste ? ` · ${esc(me.poste)}` : ""}</div>
        </div>
      </div>
      <div class="top-actions">
        <button class="link" id="editProfile">Profil</button>
        <button class="link" id="logout">Quitter</button>
      </div>
    </header>
    ${team ? `<button class="team-switch" id="switchTeam" title="Changer d'équipe"><span class="mu">Équipe</span> <b>${esc(team.name)}</b> <span class="mu">· changer</span></button>` : ""}`;
}

function bindHeader() {
  $("#logout").onclick = () => signOut(auth);
  $("#editProfile").onclick = () =>
    renderProfile($("#view"), me, (profile) => { me = profile; team ? renderShell() : goHome(); }, () => (team ? renderShell() : goHome()));
  $("#switchTeam") && ($("#switchTeam").onclick = () => goHome());
}

function renderShell() {
  if (!team) return goHome();
  const coach = isStaff();
  // Coach et dev ont aussi accès au questionnaire (leurs réponses ne comptent pas dans le suivi de l'équipe).
  const tabs = coach
    ? [["team", "Suivi"], ["sessions", "Séances"], ["form", "Questionnaire"], ["accounts", "Équipe"]]
    : [["form", "Questionnaire"]];
  if (!tabs.some(([k]) => k === currentTab)) currentTab = tabs[0][0];

  root.innerHTML = `${header()}
    ${tabs.length > 1 ? `<div class="tabs">${tabs.map(([k, l]) => `<button data-tab="${k}" class="${k === currentTab ? "on" : ""}">${l}</button>`).join("")}</div>` : ""}
    <div id="view"></div>`;

  root.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => { currentTab = b.dataset.tab; renderShell(); }));
  bindHeader();

  const view = $("#view");
  root.className = currentTab === "form" ? "" : "wide";
  if (currentTab === "form") renderQuestionnaire(view, me, team);
  if (currentTab === "team") renderTeam(view, team);
  if (currentTab === "sessions") renderSessions(view, me, team);
  if (currentTab === "accounts") renderAccounts(view, me, team, {
    renamed: (name) => { team = { ...team, name }; renderShell(); },
    deleted: (name) => goHome(`Équipe « ${name} » supprimée.`),
  });
}

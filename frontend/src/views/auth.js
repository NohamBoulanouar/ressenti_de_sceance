import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "../firebase.js";
import { $, setMsg } from "../util.js";

const ERRORS = {
  "auth/invalid-email": "Adresse email invalide.",
  "auth/missing-password": "Entre un mot de passe.",
  "auth/weak-password": "Mot de passe trop court (6 caractères minimum).",
  "auth/email-already-in-use": "Un compte existe déjà avec cet email : connecte-toi.",
  "auth/invalid-credential": "Email ou mot de passe incorrect.",
  "auth/user-not-found": "Aucun compte avec cet email.",
  "auth/wrong-password": "Email ou mot de passe incorrect.",
  "auth/too-many-requests": "Trop d'essais, réessaie dans quelques minutes.",
  "auth/network-request-failed": "Connexion impossible : les émulateurs Firebase sont-ils lancés ?",
};
const msgOf = (e) => ERRORS[e.code] || "Erreur : " + (e.code || e.message);

export function renderAuth(root, mode = "login") {
  const signup = mode === "signup";
  root.innerHTML = `
    <h1>Ressenti de séance</h1>
    <div class="mu" style="font-size:14px">${signup ? "Crée ton compte une fois, ensuite tu n'auras plus qu'à répondre." : "Connecte-toi pour répondre après chaque séance."}</div>
    <form class="card" id="f" novalidate>
      <h2>${signup ? "Créer un compte" : "Connexion"}</h2>
      <div class="q"><b>Email</b></div>
      <input type="email" id="email" autocomplete="email" required>
      <div class="q"><b>Mot de passe</b></div>
      <input type="password" id="pwd" autocomplete="${signup ? "new-password" : "current-password"}" minlength="6" required>
      ${signup ? `<div class="q"><b>Confirme le mot de passe</b></div><input type="password" id="pwd2" autocomplete="new-password">` : ""}
      <button class="go" id="go" type="submit">${signup ? "Créer mon compte" : "Se connecter"}</button>
      <div id="msg" style="margin-top:8px;font-size:14px"></div>
    </form>
    <div class="center">
      <button class="link" id="switch">${signup ? "J'ai déjà un compte" : "Pas encore de compte ? Créer un compte"}</button>
      ${signup ? "" : `<br><button class="link" id="reset">Mot de passe oublié</button>`}
    </div>`;

  const msg = $("#msg");
  $("#switch").onclick = () => renderAuth(root, signup ? "login" : "signup");

  $("#f").onsubmit = async (ev) => {
    ev.preventDefault();
    const email = $("#email").value.trim();
    const pwd = $("#pwd").value;
    if (signup && pwd !== $("#pwd2").value) return setMsg(msg, "Les deux mots de passe sont différents.");
    const btn = $("#go");
    btn.disabled = true;
    try {
      if (signup) await createUserWithEmailAndPassword(auth, email, pwd);
      else await signInWithEmailAndPassword(auth, email, pwd);
      // onAuthStateChanged (main.js) prend le relais.
    } catch (e) {
      setMsg(msg, msgOf(e));
      btn.disabled = false;
    }
  };

  if (!signup) {
    $("#reset").onclick = async () => {
      const email = $("#email").value.trim();
      if (!email) return setMsg(msg, "Entre ton email au-dessus, puis clique sur « Mot de passe oublié ».");
      try {
        await sendPasswordResetEmail(auth, email);
        setMsg(msg, "Email de réinitialisation envoyé (en local, le lien s'affiche dans la console des émulateurs).", true);
      } catch (e) {
        setMsg(msg, msgOf(e));
      }
    };
  }
}

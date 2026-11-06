import { $ } from "../util.js";

// Texte de base à adapter (nom du club, contact du responsable).
export const PRIVACY_HTML = `
  <h2>Confidentialité et données personnelles</h2>
  <p><b>Responsable :</b> le staff de l'équipe (contact : ton coach).</p>
  <p><b>Données collectées :</b> email, prénom/nom, poste, et après chaque séance ton ressenti (9 notes de 1 à 100),
  la présence d'une blessure et une éventuelle gêne ou douleur.</p>
  <p><b>Données de santé :</b> les informations sur les blessures et douleurs sont des données de santé (article 9 du RGPD).
  Elles ne sont collectées qu'avec ton <b>consentement explicite</b>, donné à la création du compte.</p>
  <p><b>Finalité :</b> aider le staff à adapter les entraînements et à prévenir les blessures. Aucune autre utilisation, aucune revente.</p>
  <p><b>Qui voit quoi :</b> tu vois uniquement tes réponses. Seuls les coachs de l'équipe voient les réponses de tous les joueurs.</p>
  <p><b>Hébergement :</b> Google Firebase (base de données hébergée dans l'Union européenne).</p>
  <p><b>Durée :</b> les données sont conservées pendant la saison en cours, puis supprimées ou anonymisées.</p>
  <p><b>Tes droits :</b> accès, rectification (« Mon profil »), suppression (« Supprimer mon compte » dans « Mon profil »),
  retrait du consentement à tout moment. Pour toute question, adresse-toi à ton coach.
  Tu peux aussi saisir la CNIL (cnil.fr).</p>
  <p><b>Mineurs :</b> si tu as moins de 15 ans, l'accord d'un parent est nécessaire avant de créer ton compte.</p>`;

export function renderPrivacy(el, onBack) {
  el.innerHTML = `<h1>Ressenti de séance</h1><div class="card privacy">${PRIVACY_HTML}</div>
    <button class="go" id="back">Retour</button>`;
  $("#back").onclick = onBack;
}

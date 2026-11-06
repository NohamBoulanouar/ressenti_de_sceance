import { INFOS } from "../config.js";
import { $, esc } from "../util.js";

const c = Object.fromEntries(Object.entries(INFOS).map(([k, v]) => [k, esc(v)]));
const mail = `<a href="mailto:${c.contactCoach}">${c.contactCoach}</a>`;

export const PRIVACY_HTML = `
  <h2>Confidentialité et données personnelles</h2>
  <p><b>Responsable du traitement :</b> ${c.coach}, ton coach (${mail}).</p>
  <p><b>Données collectées :</b> email, prénom/nom, poste, et après chaque séance ton ressenti (9 notes de 1 à 100),
  la présence d'une blessure et une éventuelle gêne ou douleur.</p>
  <p><b>Données de santé :</b> les informations sur les blessures et douleurs sont des données de santé (article 9 du RGPD).
  Elles ne sont collectées qu'avec ton <b>consentement explicite</b>, donné à la création du compte.</p>
  <p><b>Finalité :</b> aider ton coach à adapter les entraînements et à prévenir les blessures.
  Aucune autre utilisation, aucune revente, aucune publicité.</p>
  <p><b>Qui voit quoi :</b> tu vois uniquement tes réponses. Seules les personnes ayant le rôle coach
  dans l'application voient les réponses de tous les joueurs.</p>
  <p><b>Développement et maintenance :</b> le site est développé et maintenu par ${c.developpeur}, pour le compte de ${c.coach}.
  Il dispose d'un accès technique à la base de données, uniquement pour assurer le bon fonctionnement du site,
  et n'utilise pas ces données à d'autres fins.</p>
  <p><b>Hébergement :</b> Google Firebase (Google Cloud), base de données hébergée en France (région europe-west9, Paris).</p>
  <p><b>Durée de conservation :</b> ${c.dureeConservation}. Les données d'un joueur sont supprimées dès qu'il supprime son compte.</p>
  <p><b>Tes droits :</b> accès, rectification (« Mon profil »), suppression (« Supprimer mon compte » dans « Mon profil »),
  retrait du consentement à tout moment. Pour toute demande : ${mail}.
  Tu peux aussi adresser une réclamation à la CNIL (cnil.fr).</p>
  <p><b>Mineurs :</b> si tu as moins de 15 ans, l'accord d'un parent est nécessaire avant de créer ton compte.</p>`;

export function renderPrivacy(el, onBack) {
  el.innerHTML = `<h1>Ressenti de séance</h1><div class="card privacy">${PRIVACY_HTML}</div>
    <button class="go" id="back">Retour</button>`;
  $("#back").onclick = onBack;
}

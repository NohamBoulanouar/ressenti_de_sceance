import { api, errorMessage } from "../api.js";
import { $, claimView, esc, frDate, localDate, sessionLabel, setMsg } from "../util.js";
import { downloadCsv } from "./team.js";

const slug = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "equipe";

const dateOf = (ts) => (ts?.toDate ? frDate(localDate(ts.toDate())) : "");

/** Onglet « Équipe » : nom et code de l'équipe choisie, staff, athlètes, retraits, fin de saison. */
export async function renderAccounts(el, me, team, on = {}) {
  const still = claimView(el);
  const again = () => renderAccounts(el, me, team, on);
  el.innerHTML = `<div class="card"><div class="mu">Chargement…</div></div>`;
  let users, code, removed, members;
  try {
    [users, code, removed, members] = await Promise.all([api.users(), api.teamCode(team.id), api.removedMembers(team.id), api.members(team.id)]);
  } catch (e) {
    if (still()) el.innerHTML = `<div class="card warn">${esc(errorMessage(e))}</div>`;
    return;
  }
  if (!still()) return;
  // Affichage : le compte DEV n'apparaît que pour le développeur lui-même (les coachs ne le voient pas).
  const iAmDev = me.role === "DEV";
  const coaches = users.filter((u) => u.role === "COACH" || (u.role === "DEV" && iAmDev));
  const roleLabel = (u) => (u.role === "DEV" && iAmDev ? "DEV" : "COACH");
  const inTeam = new Set(members.map((m) => m.uid));
  const athletes = users.filter((u) => u.role === "ATHLETE" && inTeam.has(u.uid));

  el.innerHTML = `
    <form class="card" id="nameForm" novalidate>
      <h2>Nom de l'équipe</h2>
      <div class="filters">
        <input type="text" id="teamName" maxlength="60" value="${esc(team.name)}">
        <button class="btn pri" type="submit" style="flex:0">Renommer</button>
      </div>
      <div id="nmsg" style="margin-top:8px;font-size:14px"></div>
    </form>

    <div class="card ${code ? "" : "alert"}">
      <h2>Code d'équipe</h2>
      ${code
        ? `<div class="code">${esc(code)}</div>
           <div class="mu">Donne ce code aux athlètes de « ${esc(team.name)} » : il est demandé à l'inscription, ou sur la page d'accueil pour rejoindre l'équipe. En le changeant, l'ancien code ne fonctionne plus (les membres actuels ne sont pas touchés).</div>`
        : `<div class="warn">Aucun code : personne ne peut rejoindre cette équipe. Crée-en un.</div>`}
      <div class="filters" style="margin-top:10px">
        <input type="text" id="newCode" maxlength="20" placeholder="Nouveau code (6 à 20 lettres/chiffres)" autocapitalize="characters" autocomplete="off">
        <button class="btn" id="gen" type="button" style="flex:0">Générer</button>
        <button class="btn pri" id="saveCode" type="button" style="flex:0">${code ? "Changer" : "Créer"}</button>
      </div>
      <div id="cmsg" style="margin-top:8px;font-size:14px"></div>
    </div>

    <div class="card">
      <h2>Staff (${coaches.length})</h2>
      <div class="sc2"><table>
        <tr><th>Nom</th><th>Email</th><th>Rôle</th><th>Inscrit le</th><th></th></tr>
        ${coaches.map((u) => `<tr>
          <td>${esc(u.name)}${u.uid === me.uid ? ' <span class="mu">(toi)</span>' : ""}</td>
          <td class="l">${esc(u.email)}</td>
          <td><span class="badge">${roleLabel(u)}</span></td>
          <td>${dateOf(u.createdAt)}</td>
          <td>${u.uid === me.uid || u.role === "DEV" ? "" : `<button class="btn" data-act="role" data-uid="${esc(u.uid)}" data-role="ATHLETE">Repasser athlète</button>`}</td>
        </tr>`).join("")}
      </table></div>
      <div class="mu" style="margin-top:8px">Le staff gère toutes les équipes. Un coach n'a pas de poste ; il peut remplir le questionnaire (onglet « Questionnaire »), mais ses réponses ne comptent pas dans le suivi. Il ne peut pas se retirer lui-même le rôle : un autre coach doit le faire.${iAmDev ? " Le rôle DEV se gère uniquement depuis la console Firebase." : ""}</div>
    </div>

    <div class="card">
      <h2>Athlètes (${athletes.length})</h2>
      ${athletes.length ? `<div class="sc2"><table>
        <tr><th>Nom</th><th>Email</th><th>Poste</th><th>Inscrit le</th><th></th></tr>
        ${athletes.map((u) => `<tr>
          <td>${esc(u.name)}</td>
          <td class="l">${esc(u.email)}</td>
          <td>${esc(u.poste)}</td>
          <td>${dateOf(u.createdAt)}</td>
          <td class="actions">
            <button class="btn pri" data-act="role" data-uid="${esc(u.uid)}" data-role="COACH">Passer coach</button>
            <button class="btn bad" data-act="remove" data-uid="${esc(u.uid)}">Retirer</button>
          </td>
        </tr>`).join("")}
      </table></div>` : `<div class="mu">Aucun athlète dans cette équipe pour l'instant.</div>`}
      <div id="amsg" style="margin-top:8px;font-size:14px"></div>
    </div>

    ${removed.length ? `
    <div class="card">
      <h2>Membres retirés (${removed.length})</h2>
      <div class="mu" style="margin-bottom:8px">Ils ne peuvent plus rejoindre cette équipe, même avec le code. « Autoriser à revenir » le leur permet de nouveau.</div>
      <div class="sc2"><table>
        <tr><th>Nom</th><th>Email</th><th>Retiré le</th><th></th></tr>
        ${removed.map((u) => `<tr>
          <td>${esc(u.name)}</td><td class="l">${esc(u.email)}</td><td>${dateOf(u.at)}</td>
          <td><button class="btn" data-act="back" data-uid="${esc(u.uid)}">Autoriser à revenir</button></td>
        </tr>`).join("")}
      </table></div>
    </div>` : ""}

    <div class="card danger">
      <h2>Fin de saison</h2>
      <div class="mu" style="margin-bottom:8px">Supprime <b>toutes les réponses et toutes les séances de « ${esc(team.name)} »</b> (les membres et le code sont conservés).
      Un fichier CSV de toutes les réponses est téléchargé automatiquement juste avant, pour archive.</div>
      <button class="btn bad" id="purge" type="button">Supprimer les données de la saison</button>
      <div id="pmsg2" style="margin-top:8px;font-size:14px"></div>
    </div>

    <div class="card danger">
      <h2>Supprimer l'équipe</h2>
      <div class="mu" style="margin-bottom:8px">Supprime l'équipe, ses séances, ses réponses et son code. Les comptes des athlètes sont conservés (ils peuvent rester dans leurs autres équipes).
      Un fichier CSV des réponses est téléchargé juste avant, pour archive.</div>
      <button class="btn bad" id="delTeam" type="button">Supprimer « ${esc(team.name)} »</button>
      <div id="tmsg" style="margin-top:8px;font-size:14px"></div>
    </div>`;

  // Nom de l'équipe
  $("#nameForm").onsubmit = async (ev) => {
    ev.preventDefault();
    const name = $("#teamName").value.trim();
    const msg = $("#nmsg");
    if (!name) return setMsg(msg, "Le nom ne peut pas être vide.");
    if (name === team.name) return;
    try {
      await api.renameTeam(team.id, name);
      on.renamed ? on.renamed(name) : again();
    } catch (e) {
      setMsg(msg, errorMessage(e));
    }
  };

  // Code d'équipe
  $("#gen").onclick = () => { $("#newCode").value = api.randomCode(); };
  $("#saveCode").onclick = async () => {
    const value = $("#newCode").value.trim().toUpperCase();
    const msg = $("#cmsg");
    if (!/^[A-Z0-9]{6,20}$/.test(value)) return setMsg(msg, "Le code doit faire 6 à 20 caractères, lettres sans accent et chiffres uniquement.");
    if (code && !confirm(`Remplacer le code ${code} par ${value} ?`)) return;
    try {
      await api.setTeamCode(team.id, value);
      again();
    } catch (e) {
      setMsg(msg, errorMessage(e));
    }
  };

  // Actions sur les comptes
  const byUid = new Map([...users, ...removed].map((u) => [u.uid, u]));
  el.querySelectorAll("button[data-act]").forEach((b) => {
    b.onclick = async () => {
      const target = byUid.get(b.dataset.uid);
      const act = b.dataset.act;
      let question;
      if (act === "role" && b.dataset.role === "COACH") {
        question = `Passer ${target.name} coach ?\n\nIl gérera toutes les équipes et verra toutes les réponses. Ses anciennes réponses n'apparaîtront plus dans le suivi.`;
      } else if (act === "role") {
        question = `Repasser ${target.name} athlète ?\n\nIl perdra l'accès au suivi et à la gestion des équipes, et devra choisir son poste (puis rejoindre une équipe avec son code).`;
      } else if (act === "remove") {
        question = `Retirer ${target.name} de « ${team.name} » ?\n\nSes réponses dans cette équipe seront supprimées définitivement et il ne pourra plus la rejoindre (sauf si tu l'y autorises). S'il n'est dans aucune autre équipe, son profil est aussi supprimé.`;
      } else {
        question = `Autoriser ${target.name} à revenir dans « ${team.name} » ? Il pourra la rejoindre avec le code d'équipe.`;
      }
      if (!confirm(question)) return;
      b.disabled = true;
      try {
        if (act === "role") await api.changeRole(target.uid, b.dataset.role);
        if (act === "remove") await api.removeMember(team.id, target);
        if (act === "back") await api.allowBack(team.id, target.uid);
        again();
      } catch (e) {
        setMsg($("#amsg"), errorMessage(e));
        b.disabled = false;
      }
    };
  });

  /** Télécharge toutes les réponses de l'équipe en CSV (avant une suppression). */
  async function archive(prefix) {
    const [all, sessions] = await Promise.all([api.teamResponses(team.id), api.sessions(team.id)]);
    const names = new Map(users.map((u) => [u.uid, u]));
    const sess = new Map(sessions.map((x) => [x.id, x]));
    if (all.length) {
      downloadCsv(all.map((r) => ({
        ...r,
        name: names.get(r.uid)?.name ?? r.name,
        poste: names.get(r.uid)?.poste || r.poste,
        seance: sess.has(r.sessionId) ? sessionLabel(sess.get(r.sessionId)) : "",
      })), `${prefix}-${slug(team.name)}`);
    }
    return all.length;
  }

  $("#delTeam").onclick = async () => {
    const msg = $("#tmsg");
    const typed = prompt(`Supprimer l'équipe « ${team.name} », ses séances et ses réponses ?\n\nTape le nom de l'équipe pour confirmer :`);
    if (typed === null) return;
    if (typed.trim() !== team.name.trim()) return setMsg(msg, "Suppression annulée (le nom ne correspond pas).");
    const btn = $("#delTeam");
    btn.disabled = true;
    try {
      setMsg(msg, "Export CSV en cours…", true);
      await archive("archive-equipe");
      setMsg(msg, "Suppression en cours…", true);
      await api.deleteTeam(team.id);
      on.deleted ? on.deleted(team.name) : again();
    } catch (e) {
      setMsg(msg, errorMessage(e));
      btn.disabled = false;
    }
  };

  // Fin de saison
  $("#purge").onclick = async () => {
    const msg = $("#pmsg2");
    const typed = prompt(`Cette action supprime définitivement toutes les réponses et toutes les séances de « ${team.name} ».\n\nTape SUPPRIMER pour confirmer :`);
    if (typed === null) return;
    if (typed.trim().toUpperCase() !== "SUPPRIMER") return setMsg(msg, "Suppression annulée (mot de confirmation incorrect).");
    const btn = $("#purge");
    btn.disabled = true;
    try {
      setMsg(msg, "Export CSV en cours…", true);
      await archive("archive-saison");
      setMsg(msg, "Suppression en cours…", true);
      const n = await api.purgeSeason(team.id);
      const pl = (k, w) => `${k} ${w}${k > 1 ? "s" : ""}`;
      setMsg(msg, n.responses || n.sessions
        ? `${pl(n.responses, "réponse")} et ${pl(n.sessions, "séance")} supprimées.${n.responses ? " L'archive CSV a été téléchargée." : ""}`
        : "Rien à supprimer.", true);
    } catch (e) {
      setMsg(msg, errorMessage(e));
    } finally {
      btn.disabled = false;
    }
  };
}


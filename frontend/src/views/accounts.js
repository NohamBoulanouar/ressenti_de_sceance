import { api, errorMessage } from "../api.js";
import { $, claimView, esc, frDate, localDate, sessionLabel, setMsg } from "../util.js";
import { downloadCsv } from "./team.js";

function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans 0/O/1/I pour éviter les confusions
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return [...bytes].map((b) => chars[b % chars.length]).join("");
}

const dateOf = (ts) => (ts?.toDate ? frDate(localDate(ts.toDate())) : "");

export async function renderAccounts(el, me) {
  const still = claimView(el);
  el.innerHTML = `<div class="card"><div class="mu">Chargement…</div></div>`;
  let users, codes, removed;
  try {
    [users, codes, removed] = await Promise.all([api.users(), api.teamCodes(), api.removedMembers()]);
  } catch (e) {
    if (still()) el.innerHTML = `<div class="card warn">${esc(errorMessage(e))}</div>`;
    return;
  }
  if (!still()) return;
  const code = codes[0];
  // Affichage : le compte DEV n'apparaît que pour le développeur lui-même (les coachs ne le voient pas).
  const iAmDev = me.role === "DEV";
  const coaches = users.filter((u) => u.role === "COACH" || (u.role === "DEV" && iAmDev));
  const roleLabel = (u) => (u.role === "DEV" && iAmDev ? "DEV" : "COACH");
  const athletes = users.filter((u) => u.role === "ATHLETE");

  el.innerHTML = `
    <div class="card ${code ? "" : "alert"}">
      <h2>Code d'équipe</h2>
      ${code
        ? `<div class="code">${esc(code)}</div>
           <div class="mu">Donne ce code à tes athlètes : il est demandé à leur inscription. En le changeant, l'ancien code ne permet plus de s'inscrire (les comptes existants ne sont pas touchés).</div>`
        : `<div class="warn">Aucun code d'équipe : personne ne peut encore s'inscrire. Crée-en un.</div>`}
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
      <div class="mu" style="margin-top:8px">Un coach n'a pas de poste ; il peut remplir le questionnaire (onglet « Répondre »), mais ses réponses ne comptent pas dans le suivi. Il ne peut pas se retirer lui-même le rôle : un autre coach doit le faire.${iAmDev ? " Le rôle DEV se gère uniquement depuis la console Firebase." : ""}</div>
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
      </table></div>` : `<div class="mu">Aucun athlète inscrit pour l'instant.</div>`}
      <div id="amsg" style="margin-top:8px;font-size:14px"></div>
    </div>

    ${removed.length ? `
    <div class="card">
      <h2>Membres retirés (${removed.length})</h2>
      <div class="mu" style="margin-bottom:8px">Ils ne peuvent plus se réinscrire, même avec le code. « Autoriser à revenir » leur permet de recréer un profil.</div>
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
      <div class="mu" style="margin-bottom:8px">Supprime <b>toutes les réponses et toutes les séances</b> (les comptes et le code d'équipe sont conservés).
      Un fichier CSV de toutes les réponses est téléchargé automatiquement juste avant, pour archive.</div>
      <button class="btn bad" id="purge" type="button">Supprimer les données de la saison</button>
      <div id="pmsg2" style="margin-top:8px;font-size:14px"></div>
    </div>`;

  // Code d'équipe
  $("#gen").onclick = () => { $("#newCode").value = randomCode(); };
  $("#saveCode").onclick = async () => {
    const value = $("#newCode").value.trim().toUpperCase();
    const msg = $("#cmsg");
    if (!/^[A-Z0-9]{6,20}$/.test(value)) return setMsg(msg, "Le code doit faire 6 à 20 caractères, lettres sans accent et chiffres uniquement.");
    if (code && !confirm(`Remplacer le code ${code} par ${value} ?`)) return;
    try {
      await api.setTeamCode(value);
      renderAccounts(el, me);
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
        question = `Passer ${target.name} coach ?\n\nIl verra les réponses de toute l'équipe et ne remplira plus de questionnaire. Ses anciennes réponses n'apparaîtront plus dans le suivi.`;
      } else if (act === "role") {
        question = `Repasser ${target.name} athlète ?\n\nIl perdra l'accès au suivi de l'équipe et devra choisir son poste.`;
      } else if (act === "remove") {
        question = `Retirer ${target.name} de l'équipe ?\n\nSon profil et TOUTES ses réponses seront supprimés définitivement, et il ne pourra plus se réinscrire (sauf si tu l'y autorises).`;
      } else {
        question = `Autoriser ${target.name} à revenir ? Il pourra recréer un profil avec le code d'équipe.`;
      }
      if (!confirm(question)) return;
      b.disabled = true;
      try {
        if (act === "role") await api.changeRole(target.uid, b.dataset.role);
        if (act === "remove") await api.removeMember(target);
        if (act === "back") await api.allowBack(target.uid);
        renderAccounts(el, me);
      } catch (e) {
        setMsg($("#amsg"), errorMessage(e));
        b.disabled = false;
      }
    };
  });

  // Fin de saison
  $("#purge").onclick = async () => {
    const msg = $("#pmsg2");
    const typed = prompt("Cette action supprime définitivement toutes les réponses et toutes les séances de la saison.\n\nTape SUPPRIMER pour confirmer :");
    if (typed === null) return;
    if (typed.trim().toUpperCase() !== "SUPPRIMER") return setMsg(msg, "Suppression annulée (mot de confirmation incorrect).");
    const btn = $("#purge");
    btn.disabled = true;
    try {
      setMsg(msg, "Export CSV en cours…", true);
      const [all, sessions] = await Promise.all([api.teamResponses(null), api.sessions()]);
      const names = new Map(users.map((u) => [u.uid, u]));
      const sess = new Map(sessions.map((x) => [x.id, x]));
      if (all.length) {
        downloadCsv(all.map((r) => ({
          ...r,
          name: names.get(r.uid)?.name ?? r.name,
          poste: names.get(r.uid)?.poste || r.poste,
          seance: sess.has(r.sessionId) ? sessionLabel(sess.get(r.sessionId)) : "",
        })), "archive-saison");
      }
      setMsg(msg, "Suppression en cours…", true);
      const n = await api.purgeSeason();
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

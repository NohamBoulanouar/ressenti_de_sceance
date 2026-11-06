import { api, errorMessage } from "../api.js";
import { $, esc, frDate, localDate, setMsg } from "../util.js";

function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans 0/O/1/I pour éviter les confusions
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return [...bytes].map((b) => chars[b % chars.length]).join("");
}

export async function renderAccounts(el, me) {
  el.innerHTML = `<div class="card"><div class="mu">Chargement…</div></div>`;
  let users, codes;
  try {
    [users, codes] = await Promise.all([api.users(), api.teamCodes()]);
  } catch (e) {
    el.innerHTML = `<div class="card warn">${esc(errorMessage(e))}</div>`;
    return;
  }
  const code = codes[0];

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
      <h2>Comptes de l'équipe (${users.length})</h2>
      <div class="mu" style="margin-bottom:8px">Les athlètes créent eux-mêmes leur compte avec le code. Ici, tu donnes ou retires les droits coach (un coach ne peut pas se retirer lui-même).</div>
      <div class="sc2"><table>
        <tr><th>Nom</th><th>Email</th><th>Poste</th><th>Rôle</th><th>Inscrit le</th><th></th></tr>
        ${users.map((u) => {
          const coach = u.role === "COACH";
          const self = u.uid === me.uid;
          const created = u.createdAt?.toDate ? localDate(u.createdAt.toDate()) : "";
          return `<tr>
            <td>${esc(u.name)}${self ? ' <span class="mu">(toi)</span>' : ""}</td>
            <td class="l">${esc(u.email)}</td>
            <td>${esc(u.poste)}</td>
            <td>${coach ? '<span class="badge">COACH</span>' : "Athlète"}</td>
            <td>${frDate(created)}</td>
            <td>${self ? "" : `<button class="btn ${coach ? "" : "pri"}" data-uid="${esc(u.uid)}" data-role="${coach ? "ATHLETE" : "COACH"}">${coach ? "Retirer coach" : "Passer coach"}</button>`}</td>
          </tr>`;
        }).join("")}
      </table></div>
      <div id="amsg" style="margin-top:8px;font-size:14px"></div>
    </div>`;

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

  el.querySelectorAll("button[data-uid]").forEach((b) => {
    b.onclick = async () => {
      const target = users.find((u) => u.uid === b.dataset.uid);
      const toCoach = b.dataset.role === "COACH";
      const question = toCoach
        ? `Donner les droits coach à ${target.name} ? Il verra les réponses de toute l'équipe.`
        : `Retirer les droits coach à ${target.name} ?`;
      if (!confirm(question)) return;
      b.disabled = true;
      try {
        await api.changeRole(target.uid, b.dataset.role);
        renderAccounts(el, me);
      } catch (e) {
        setMsg($("#amsg"), errorMessage(e));
        b.disabled = false;
      }
    };
  });
}

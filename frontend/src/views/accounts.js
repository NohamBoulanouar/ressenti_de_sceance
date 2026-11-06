import { api } from "../api.js";
import { $, esc, frDate, setMsg } from "../util.js";

export async function renderAccounts(el, me) {
  el.innerHTML = `<div class="card"><div class="mu">Chargement des comptes…</div></div>`;
  let users;
  try {
    users = await api.users();
  } catch (e) {
    el.innerHTML = `<div class="card warn">${esc(e.message)}</div>`;
    return;
  }
  const coaches = users.filter((u) => u.role === "COACH").length;

  el.innerHTML = `
    <div class="card">
      <h2>Comptes de l'équipe (${users.length})</h2>
      <div class="mu" style="margin-bottom:8px">Les athlètes créent eux-mêmes leur compte. Ici, tu peux donner ou retirer les droits coach.</div>
      <div class="sc2"><table>
        <tr><th>Nom</th><th>Email</th><th>Poste</th><th>Rôle</th><th>Inscrit le</th><th></th></tr>
        ${users.map((u) => {
          const coach = u.role === "COACH";
          const lastCoach = coach && coaches <= 1;
          return `<tr>
            <td>${esc(u.name)}${u.uid === me.uid ? ' <span class="mu">(toi)</span>' : ""}</td>
            <td class="l">${esc(u.email)}</td>
            <td>${esc(u.poste)}</td>
            <td>${coach ? '<span class="badge">COACH</span>' : "Athlète"}</td>
            <td>${frDate(u.createdAt?.slice(0, 10))}</td>
            <td>${lastCoach ? "" : `<button class="btn ${coach ? "" : "pri"}" data-uid="${esc(u.uid)}" data-role="${coach ? "ATHLETE" : "COACH"}">${coach ? "Retirer coach" : "Passer coach"}</button>`}</td>
          </tr>`;
        }).join("")}
      </table></div>
      <div id="amsg" style="margin-top:8px;font-size:14px"></div>
    </div>`;

  el.querySelectorAll("button[data-uid]").forEach((b) => {
    b.onclick = async () => {
      const target = users.find((u) => u.uid === b.dataset.uid);
      const toCoach = b.dataset.role === "COACH";
      const self = target.uid === me.uid;
      const question = toCoach
        ? `Donner les droits coach à ${target.name} ? Il verra les réponses de toute l'équipe.`
        : `Retirer les droits coach à ${target.name}${self ? " (toi-même : tu perdras l'accès au suivi)" : ""} ?`;
      if (!confirm(question)) return;
      b.disabled = true;
      try {
        await api.changeRole(target.uid, b.dataset.role);
        if (self) location.reload();
        else renderAccounts(el, me);
      } catch (e) {
        setMsg($("#amsg"), e.message);
        b.disabled = false;
      }
    };
  });
}

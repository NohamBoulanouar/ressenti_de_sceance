import { api, errorMessage } from "../api.js";
import { $, claimView, esc, setMsg } from "../util.js";

/**
 * Page d'accueil : choix de l'équipe.
 * Athlète : ses équipes + rejoindre une équipe avec un code. Staff : toutes les équipes + créer une équipe.
 */
export async function renderHome(el, me, onPick, flash) {
  const still = claimView(el);
  const staff = me.role !== "ATHLETE";
  el.innerHTML = `<div class="card"><div class="mu">Chargement des équipes…</div></div>`;
  let teams, counts = new Map();
  try {
    teams = await api.teams(staff);
    if (staff) {
      const all = await Promise.all(teams.map((t) => api.members(t.id)));
      teams.forEach((t, i) => counts.set(t.id, all[i].length));
    }
  } catch (e) {
    if (still()) el.innerHTML = `<div class="card warn">${esc(errorMessage(e))}</div>`;
    return;
  }
  if (!still()) return;

  const pl = (n, w) => `${n} ${w}${n > 1 ? "s" : ""}`;
  el.innerHTML = `
    ${flash ? `<div class="card ok">${esc(flash)}</div>` : ""}
    <div class="home-head">
      <h2 class="home-title">${staff ? "Équipes" : "Mes équipes"}</h2>
      <div class="mu">${teams.length ? "Choisis l'équipe sur laquelle travailler." : staff ? "Crée ta première équipe pour commencer." : "Tu ne fais encore partie d'aucune équipe."}</div>
    </div>
    <div class="teams">
      ${teams.map((t) => `
        <button class="team-tile" data-team="${esc(t.id)}">
          <span class="team-dot">${esc(t.name.trim().charAt(0).toUpperCase())}</span>
          <span class="team-txt"><b>${esc(t.name)}</b>${staff ? `<span class="mu">${pl(counts.get(t.id) || 0, "athlète")}</span>` : ""}</span>
          <span class="team-go">→</span>
        </button>`).join("")}
    </div>
    <form class="card" id="hf" novalidate>
      <h2>${staff ? "Créer une équipe" : "Rejoindre une équipe"}</h2>
      ${staff
        ? `<div class="mu" style="margin-bottom:8px">Un code d'inscription est créé automatiquement : tu le retrouves dans l'onglet « Équipe ».</div>
           <input type="text" id="hv" maxlength="60" placeholder="Nom de l'équipe (ex. Seniors, Moins de 18…)">`
        : `<div class="mu" style="margin-bottom:8px">Entre le code donné par le coach de l'équipe.</div>
           <input type="text" id="hv" maxlength="20" placeholder="Ex. RUGBY2026" autocapitalize="characters" autocomplete="off">`}
      <button class="go" id="hgo" type="submit">${staff ? "Créer l'équipe" : "Rejoindre"}</button>
      <div id="hmsg" style="margin-top:8px;font-size:14px"></div>
    </form>`;

  const byId = new Map(teams.map((t) => [t.id, t]));
  el.querySelectorAll("[data-team]").forEach((b) => (b.onclick = () => onPick(byId.get(b.dataset.team))));

  $("#hf").onsubmit = async (ev) => {
    ev.preventDefault();
    const msg = $("#hmsg");
    const v = $("#hv").value.trim();
    const btn = $("#hgo");
    if (staff && !v) return setMsg(msg, "Donne un nom à l'équipe.");
    if (!staff && !v) return setMsg(msg, "Entre le code de l'équipe.");
    btn.disabled = true;
    try {
      if (staff) {
        await api.createTeam(v);
        renderHome(el, me, onPick, `Équipe « ${v} » créée.`);
      } else {
        const teamId = await api.joinTeam(v.toUpperCase());
        const team = (await api.teams(false)).find((t) => t.id === teamId);
        onPick(team);
      }
    } catch (e) {
      setMsg(msg, errorMessage(e));
      btn.disabled = false;
    }
  };
}

// Accès aux données : le front parle directement à Firestore.
// Les droits (athlète / coach, code d'équipe, validation) sont garantis par firestore.rules.
import { deleteUser, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import {
  collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, writeBatch,
} from "firebase/firestore";
import { auth, db } from "./firebase.js";
import { localDate } from "./util.js";

const MESSAGES = {
  "permission-denied": "Action refusée (droits insuffisants ou données invalides).",
  unavailable: "Base de données injoignable : vérifie ta connexion (ou que les émulateurs sont lancés).",
  "auth/wrong-password": "Mot de passe incorrect.",
  "auth/invalid-credential": "Mot de passe incorrect.",
  "auth/too-many-requests": "Trop d'essais, réessaie dans quelques minutes.",
};
export function errorMessage(e) {
  return MESSAGES[e?.code] || e?.message || "Erreur inattendue";
}

const uid = () => {
  if (!auth.currentUser) throw new Error("Non connecté");
  return auth.currentUser.uid;
};
const withId = (d) => ({ uid: d.id, ...d.data() });
/** Un lot Firestore est limité à 500 opérations : on découpe par 400. */
async function deleteInBatches(refs) {
  for (let i = 0; i < refs.length; i += 400) {
    const b = writeBatch(db);
    refs.slice(i, i + 400).forEach((r) => b.delete(r));
    await b.commit();
  }
}

const newestFirst = (a, b) => b.date.localeCompare(a.date) || (a.name || "").localeCompare(b.name || "");

const col = (name) => collection(db, name);
const byTeam = (name, teamId) => query(col(name), where("teamId", "==", teamId));
const randomCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans 0/O/1/I pour éviter les confusions
  return [...crypto.getRandomValues(new Uint8Array(8))].map((b) => chars[b % chars.length]).join("");
};
const createdDay = (u) => (u.createdAt?.toDate ? localDate(u.createdAt.toDate()) : localDate());

/** Exécute une liste d'opérations [(batch) => …] par lots de 400. */
async function inBatches(ops) {
  for (let i = 0; i < ops.length; i += 400) {
    const b = writeBatch(db);
    ops.slice(i, i + 400).forEach((op) => op(b));
    await b.commit();
  }
}

export const api = {
  randomCode,

  /** true une fois que le premier coach existe. */
  async setupDone() {
    return (await getDoc(doc(db, "meta", "setup"))).exists();
  },

  /** Profil de l'utilisateur connecté, ou null s'il n'est pas encore créé. */
  async me() {
    const snap = await getDoc(doc(db, "users", uid()));
    return snap.exists() ? withId(snap) : null;
  },

  /**
   * Création du profil. Premier compte : coach (sans poste).
   * Sinon : athlète, qui rejoint dans le même lot l'équipe correspondant à son code.
   */
  async createProfile({ name, poste, joinCode }) {
    const id = uid();
    const base = {
      name, poste, email: auth.currentUser.email,
      consentAt: serverTimestamp(), createdAt: serverTimestamp(),
    };
    if (!(await this.setupDone())) {
      const b = writeBatch(db);
      b.set(doc(db, "users", id), { ...base, poste: "", role: "COACH" });
      b.set(doc(db, "meta", "setup"), { firstCoach: id, at: serverTimestamp() });
      await b.commit();
      return this.me();
    }
    const teamId = await this.teamOfCode(joinCode);
    const b = writeBatch(db);
    b.set(doc(db, "users", id), { ...base, role: "ATHLETE", joinCode });
    b.set(doc(db, "members", `${teamId}_${id}`), { uid: id, teamId, since: localDate(), joinCode, at: serverTimestamp() });
    try {
      await b.commit();
    } catch (e) {
      if (e.code === "permission-denied") throw new Error("Inscription refusée : tu as peut-être été retiré de cette équipe. Contacte ton coach.");
      throw e;
    }
    return this.me();
  },

  /** poste = null pour un coach : seul le nom change. */
  async updateProfile(name, poste) {
    await updateDoc(doc(db, "users", uid()), poste == null ? { name } : { name, poste });
    return this.me();
  },

  // ── Équipes ──
  /** Équipe correspondant à un code d'inscription (erreur explicite sinon). */
  async teamOfCode(code) {
    const snap = await getDoc(doc(db, "teamCodes", code));
    if (!snap.exists()) throw new Error("Code d'équipe invalide. Demande le bon code à ton coach.");
    const teamId = snap.data().teamId;
    if (!teamId) throw new Error("Cette équipe est en cours de mise à jour par le coach : réessaie dans quelques minutes.");
    return teamId;
  },

  /** Équipes visibles : toutes pour le staff, celles dont on est membre pour un athlète. Triées par nom. */
  async teams(staff) {
    let list;
    if (staff) {
      list = (await getDocs(col("teams"))).docs.map((d) => ({ id: d.id, ...d.data() }));
    } else {
      const mine = (await getDocs(query(col("members"), where("uid", "==", uid())))).docs.map((d) => d.data().teamId);
      list = (await Promise.all(mine.map((t) => getDoc(doc(db, "teams", t)))))
        .filter((d) => d.exists()).map((d) => ({ id: d.id, ...d.data() }));
    }
    return list.sort((a, b) => a.name.localeCompare(b.name, "fr"));
  },

  /** Rejoindre une autre équipe avec son code. */
  async joinTeam(code) {
    const teamId = await this.teamOfCode(code);
    const id = `${teamId}_${uid()}`;
    if ((await getDocs(query(col("members"), where("uid", "==", uid())))).docs.some((d) => d.id === id)) {
      throw new Error("Tu fais déjà partie de cette équipe.");
    }
    try {
      await setDoc(doc(db, "members", id), { uid: uid(), teamId, since: localDate(), joinCode: code, at: serverTimestamp() });
    } catch (e) {
      if (e.code === "permission-denied") throw new Error("Impossible de rejoindre cette équipe : tu en as peut-être été retiré. Contacte ton coach.");
      throw e;
    }
    return teamId;
  },

  /** Crée une équipe avec un code d'inscription généré. */
  async createTeam(name) {
    const ref = doc(col("teams"));
    await setDoc(ref, { name, createdAt: serverTimestamp(), createdBy: uid() });
    await setDoc(doc(db, "teamCodes", randomCode()), { teamId: ref.id, createdAt: serverTimestamp(), createdBy: uid() });
    return ref.id;
  },

  async renameTeam(teamId, name) {
    await updateDoc(doc(db, "teams", teamId), { name });
  },

  /** Supprime une équipe et tout ce qui s'y rapporte (séances, réponses, membres, code). Les comptes sont conservés. */
  async deleteTeam(teamId) {
    const groups = await Promise.all(["responses", "sessions", "members", "teamCodes"].map((c) => getDocs(byTeam(c, teamId))));
    const removed = (await getDocs(col("removed"))).docs.filter((d) => d.data().teamId === teamId);
    await deleteInBatches([...groups.flatMap((g) => g.docs), ...removed].map((d) => d.ref));
    await deleteDoc(doc(db, "teams", teamId));
  },

  /** Membres (athlètes) d'une équipe : [{uid, since}]. */
  async members(teamId) {
    return (await getDocs(byTeam("members", teamId))).docs.map((d) => d.data());
  },

  async teamCode(teamId) {
    return (await getDocs(byTeam("teamCodes", teamId))).docs.map((d) => d.id)[0] || null;
  },

  /** Remplace le code de l'équipe : l'ancien ne permet plus de la rejoindre. */
  async setTeamCode(teamId, code) {
    if (code !== (await this.teamCode(teamId)) && (await getDoc(doc(db, "teamCodes", code))).exists()) {
      throw new Error("Ce code est déjà utilisé par une autre équipe.");
    }
    const b = writeBatch(db);
    (await getDocs(byTeam("teamCodes", teamId))).docs.forEach((d) => b.delete(d.ref));
    b.set(doc(db, "teamCodes", code), { teamId, createdAt: serverTimestamp(), createdBy: uid() });
    await b.commit();
  },

  /**
   * Passage au multi-équipes (une seule fois, par le staff) : les données existantes
   * (code, séances, réponses, athlètes, retraits) sont rattachées à une première équipe.
   */
  async migrateIfNeeded() {
    if ((await getDoc(doc(db, "meta", "teams"))).exists()) return false;
    const [teams, codes, sessions, responses, users, members, removed] = await Promise.all(
      ["teams", "teamCodes", "sessions", "responses", "users", "members", "removed"].map((c) => getDocs(col(c))));
    const legacy = (snap) => snap.docs.filter((d) => !d.data().teamId);
    const athletes = users.docs.map(withId).filter((u) => u.role === "ATHLETE");
    const hasLegacy = legacy(codes).length || legacy(sessions).length || legacy(responses).length || athletes.length;
    let teamId = teams.docs[0]?.id;
    if (hasLegacy && !teamId) teamId = await this.createTeam("Mon équipe").then(async (id) => {
      // createTeam a généré un code : on garde plutôt l'ancien s'il existe
      if (legacy(codes).length) {
        const b = writeBatch(db);
        (await getDocs(byTeam("teamCodes", id))).docs.forEach((d) => b.delete(d.ref));
        await b.commit();
      }
      return id;
    });
    const memberIds = new Set(members.docs.map((d) => d.id));
    const ops = [];
    if (teamId) {
      legacy(codes).forEach((d) => ops.push((b) => b.set(d.ref, { teamId, createdAt: serverTimestamp(), createdBy: uid() })));
      legacy(sessions).forEach((d) => ops.push((b) => b.update(d.ref, { teamId })));
      legacy(responses).forEach((d) => ops.push((b) => b.update(d.ref, { teamId })));
      athletes.filter((u) => !memberIds.has(`${teamId}_${u.uid}`)).forEach((u) =>
        ops.push((b) => b.set(doc(db, "members", `${teamId}_${u.uid}`), { uid: u.uid, teamId, since: createdDay(u), at: serverTimestamp() })));
      legacy(removed).forEach((d) => ops.push((b) => {
        const r = d.data();
        b.set(doc(db, "removed", `${teamId}_${d.id}`), { uid: d.id, teamId, name: r.name || "", email: r.email || "", at: serverTimestamp(), by: uid() });
        b.delete(d.ref);
      }));
    }
    await inBatches(ops);
    await setDoc(doc(db, "meta", "teams"), { teamId: teamId || "", at: serverTimestamp(), by: uid() });
    return Boolean(teamId);
  },

  // ── Réponses ──
  /** Une réponse par athlète et par séance : renvoyer pour la même séance remplace la précédente. */
  async submit(me, entry) {
    const ref = doc(db, "responses", `${me.uid}_${entry.sessionId}`);
    const existed = (await getDoc(ref)).exists();
    await setDoc(ref, { ...entry, uid: me.uid, name: me.name, poste: me.poste, updatedAt: serverTimestamp() });
    return { updated: existed };
  },

  /** Mes réponses dans une équipe, les plus récentes d'abord. */
  async myResponses(teamId, limit = 5) {
    const snap = await getDocs(query(col("responses"), where("uid", "==", uid())));
    return snap.docs.map((d) => d.data()).filter((r) => r.teamId === teamId).sort(newestFirst).slice(0, limit);
  },

  // ── Séances planifiées ──
  /** Séances d'une équipe, de la plus ancienne à la plus récente (date puis heure). */
  async sessions(teamId) {
    return (await getDocs(byTeam("sessions", teamId))).docs.map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => a.date.localeCompare(b.date) || (a.time || "").localeCompare(b.time || ""));
  },

  /** Planifie une ou plusieurs séances [{date, time, title}] dans une équipe. */
  async createSessions(teamId, list) {
    await inBatches(list.map(({ date, time, title }) => (b) =>
      b.set(doc(col("sessions")), { teamId, date, time, title, createdAt: serverTimestamp(), createdBy: uid() })));
  },

  /** Réponses à une séance précise (coach). */
  async sessionResponses(id) {
    return (await getDocs(query(col("responses"), where("sessionId", "==", id)))).docs.map((d) => d.data());
  },

  /** Supprime une séance et les réponses qui s'y rapportent. */
  async deleteSession(id) {
    const answers = (await getDocs(query(col("responses"), where("sessionId", "==", id)))).docs;
    await deleteInBatches([...answers.map((d) => d.ref), doc(db, "sessions", id)]);
  },

  // ── Coach ──
  /** Toutes les réponses d'une équipe (filtre de dates côté site), les plus récentes d'abord. */
  async teamResponses(teamId, from) {
    return (await getDocs(byTeam("responses", teamId))).docs.map((d) => d.data())
      .filter((r) => !from || r.date >= from).sort(newestFirst);
  },

  async users() {
    return (await getDocs(col("users"))).docs.map(withId)
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  },

  async changeRole(targetUid, role) {
    await updateDoc(doc(db, "users", targetUid), { role });
  },

  /**
   * Retire un athlète d'une équipe : supprime ses réponses dans cette équipe et bloque son retour.
   * S'il n'est plus dans aucune équipe, son profil est aussi supprimé.
   */
  async removeMember(teamId, member) {
    const answers = (await getDocs(query(col("responses"), where("uid", "==", member.uid)))).docs
      .filter((d) => d.data().teamId === teamId);
    await deleteInBatches(answers.map((d) => d.ref));
    const others = (await getDocs(query(col("members"), where("uid", "==", member.uid)))).docs
      .filter((d) => d.data().teamId !== teamId);
    const b = writeBatch(db);
    b.delete(doc(db, "members", `${teamId}_${member.uid}`));
    if (!others.length) b.delete(doc(db, "users", member.uid));
    b.set(doc(db, "removed", `${teamId}_${member.uid}`), {
      uid: member.uid, teamId, name: member.name, email: member.email, at: serverTimestamp(), by: uid(),
    });
    await b.commit();
  },

  async removedMembers(teamId) {
    return (await getDocs(col("removed"))).docs.map((d) => d.data()).filter((r) => r.teamId === teamId)
      .sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr"));
  },

  /** Autorise un athlète retiré à rejoindre de nouveau l'équipe (avec son code). */
  async allowBack(teamId, memberUid) {
    await deleteDoc(doc(db, "removed", `${teamId}_${memberUid}`));
  },

  /** Fin de saison d'une équipe : supprime ses réponses et ses séances (comptes et membres conservés). */
  async purgeSeason(teamId) {
    const [answers, sessions] = await Promise.all([getDocs(byTeam("responses", teamId)), getDocs(byTeam("sessions", teamId))]);
    await deleteInBatches([...answers.docs, ...sessions.docs].map((d) => d.ref));
    return { responses: answers.size, sessions: sessions.size };
  },

  /** RGPD : supprime les réponses, les appartenances aux équipes, le profil puis le compte de connexion. */
  async deleteMyAccount(password) {
    const user = auth.currentUser;
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
    const mine = await Promise.all(["responses", "members"].map((c) => getDocs(query(col(c), where("uid", "==", user.uid)))));
    await deleteInBatches(mine.flatMap((s) => s.docs).map((d) => d.ref));
    await deleteDoc(doc(db, "users", user.uid));
    await deleteUser(user);
  },
};

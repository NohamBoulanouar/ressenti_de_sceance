// Accès aux données : le front parle directement à Firestore.
// Les droits (athlète / coach, code d'équipe, validation) sont garantis par firestore.rules.
import { deleteUser, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import {
  collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, writeBatch,
} from "firebase/firestore";
import { auth, db } from "./firebase.js";

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
const newestFirst = (a, b) => b.date.localeCompare(a.date) || (a.name || "").localeCompare(b.name || "");

export const api = {
  /** true une fois que le premier coach existe. */
  async setupDone() {
    return (await getDoc(doc(db, "meta", "setup"))).exists();
  },

  /** Profil de l'utilisateur connecté, ou null s'il n'est pas encore créé. */
  async me() {
    const snap = await getDoc(doc(db, "users", uid()));
    return snap.exists() ? withId(snap) : null;
  },

  /** Création du profil. Premier compte de l'équipe : coach. Sinon : athlète avec code d'équipe. */
  async createProfile({ name, poste, joinCode }) {
    const id = uid();
    const base = {
      name, poste, email: auth.currentUser.email,
      consentAt: serverTimestamp(), createdAt: serverTimestamp(),
    };
    if (!(await this.setupDone())) {
      const b = writeBatch(db);
      b.set(doc(db, "users", id), { ...base, role: "COACH" });
      b.set(doc(db, "meta", "setup"), { firstCoach: id, at: serverTimestamp() });
      await b.commit();
    } else {
      try {
        await setDoc(doc(db, "users", id), { ...base, role: "ATHLETE", joinCode });
      } catch (e) {
        if (e.code === "permission-denied") throw new Error("Code d'équipe invalide. Demande le bon code à ton coach.");
        throw e;
      }
    }
    return this.me();
  },

  async updateProfile(name, poste) {
    await updateDoc(doc(db, "users", uid()), { name, poste });
    return this.me();
  },

  /** Une réponse par athlète et par date : renvoyer pour la même date remplace la précédente. */
  async submit(me, entry) {
    const ref = doc(db, "responses", `${me.uid}_${entry.date}`);
    const existed = (await getDoc(ref)).exists();
    await setDoc(ref, { ...entry, uid: me.uid, name: me.name, poste: me.poste, updatedAt: serverTimestamp() });
    return { updated: existed };
  },

  async myResponses(limit = 5) {
    const snap = await getDocs(query(collection(db, "responses"), where("uid", "==", uid())));
    return snap.docs.map((d) => d.data()).sort(newestFirst).slice(0, limit);
  },

  // ── Coach ──
  async teamResponses(from) {
    const q = from ? query(collection(db, "responses"), where("date", ">=", from)) : collection(db, "responses");
    return (await getDocs(q)).docs.map((d) => d.data()).sort(newestFirst);
  },

  async users() {
    return (await getDocs(collection(db, "users"))).docs.map(withId)
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  },

  async changeRole(targetUid, role) {
    await updateDoc(doc(db, "users", targetUid), { role });
  },

  async teamCodes() {
    return (await getDocs(collection(db, "teamCodes"))).docs.map((d) => d.id);
  },

  /** Remplace le code d'équipe actuel : l'ancien ne permet plus de s'inscrire. */
  async setTeamCode(code) {
    const b = writeBatch(db);
    (await this.teamCodes()).forEach((c) => b.delete(doc(db, "teamCodes", c)));
    b.set(doc(db, "teamCodes", code), { createdAt: serverTimestamp(), createdBy: uid() });
    await b.commit();
  },

  /** RGPD : supprime les réponses, le profil puis le compte de connexion. */
  async deleteMyAccount(password) {
    const user = auth.currentUser;
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
    const mine = (await getDocs(query(collection(db, "responses"), where("uid", "==", user.uid)))).docs;
    for (let i = 0; i < mine.length; i += 400) { // un lot Firestore est limité à 500 opérations
      const b = writeBatch(db);
      mine.slice(i, i + 400).forEach((d) => b.delete(d.ref));
      await b.commit();
    }
    await deleteDoc(doc(db, "users", user.uid));
    await deleteUser(user);
  },
};

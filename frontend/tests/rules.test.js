// Tests des règles Firestore, lancés contre l'émulateur : `npm run test:rules`
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import {
  collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, writeBatch,
} from "firebase/firestore";

let env;
const today = new Date().toISOString().slice(0, 10);

const ctx = (uid) => env.authenticatedContext(uid, { email: `${uid}@club.fr` }).firestore();

const profile = (uid, extra = {}) => ({
  name: uid, poste: "Centres", role: "ATHLETE", email: `${uid}@club.fr`,
  consentAt: serverTimestamp(), createdAt: serverTimestamp(), ...extra,
});

const SID = "s1"; // séance planifiée du jour (équipe T1)
const T1 = "t1";
const answer = (uid, extra = {}) => ({
  uid, name: uid, poste: "Centres", teamId: T1, sessionId: SID, date: today,
  mus: 50, car: 50, rep: 50, conc: 50, pla: 50, conf: 50, tec: 50, tac: 50,
  blessure: false, gene: "", updatedAt: serverTimestamp(), ...extra,
});

/** Séance planifiée (écrite en contournant les règles, sauf dans les tests dédiés). */
async function planSession(id = SID, date = today, teamId = T1) {
  await env.withSecurityRulesDisabled((c) =>
    setDoc(doc(c.firestore(), "sessions", id), { teamId, date, time: "", title: "Entraînement", createdAt: serverTimestamp(), createdBy: "coach" }));
}

/** Équipe + code d'inscription, créés par le coach. */
async function createTeam(tid = T1, code = "RUGBY2026", name = "Seniors") {
  const db = ctx("coach");
  const b = writeBatch(db);
  b.set(doc(db, "teams", tid), { name, createdAt: serverTimestamp(), createdBy: "coach" });
  b.set(doc(db, "teamCodes", code), { teamId: tid, createdAt: serverTimestamp(), createdBy: "coach" });
  return b.commit();
}

const member = (uid, tid = T1, extra = {}) => ({ uid, teamId: tid, since: today, joinCode: "RUGBY2026", at: serverTimestamp(), ...extra });

/** Inscription d'un athlète : profil + équipe dans le même lot (comme le site). */
async function signup(uid, code = "RUGBY2026", tid = T1) {
  const db = ctx(uid);
  const b = writeBatch(db);
  b.set(doc(db, "users", uid), profile(uid, { joinCode: code }));
  b.set(doc(db, "members", `${tid}_${uid}`), member(uid, tid, { joinCode: code }));
  return b.commit();
}

async function becomeFirstCoach(db, uid) {
  const b = writeBatch(db);
  b.set(doc(db, "users", uid), profile(uid, { role: "COACH", poste: "" }));
  b.set(doc(db, "meta", "setup"), { firstCoach: uid, at: serverTimestamp() });
  return b.commit();
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-ressenti-tests",
    firestore: { rules: readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8"), host: "127.0.0.1", port: 8080 },
  });
});
afterAll(() => env.cleanup());
beforeEach(() => env.clearFirestore());

describe("premier coach", () => {
  it("le premier compte devient coach, le second ne peut pas", async () => {
    await assertSucceeds(becomeFirstCoach(ctx("coach"), "coach"));
    await assertFails(becomeFirstCoach(ctx("pirate"), "pirate"));
  });

  it("un athlète doit avoir un poste, un coach non", async () => {
    await assertFails(setDoc(doc(ctx("x"), "users", "x"), profile("x", { poste: "" })));
  });

  it("impossible de se déclarer coach sans le lot d'initialisation", async () => {
    await assertFails(setDoc(doc(ctx("x"), "users", "x"), profile("x", { role: "COACH" })));
  });
});

describe("inscription athlète", () => {
  beforeEach(async () => {
    await becomeFirstCoach(ctx("coach"), "coach");
    await planSession();
    await createTeam();
  });

  it("accepte un bon code d'équipe (profil + équipe dans le même lot)", async () => {
    await assertSucceeds(signup("paul"));
  });
  it("le code ne permet de rejoindre que son équipe", async () => {
    await createTeam("t2", "JUNIORS2026", "Juniors");
    await assertFails(signup("paul", "RUGBY2026", "t2"));
    await assertSucceeds(signup("paul", "JUNIORS2026", "t2"));
    // puis il rejoint une seconde équipe avec son code
    await assertSucceeds(setDoc(doc(ctx("paul"), "members", `${T1}_paul`), member("paul")));
    await assertFails(setDoc(doc(ctx("paul"), "members", `${T1}_lea`), member("lea")));
  });
  it("refuse un mauvais code ou pas de code", async () => {
    await assertFails(setDoc(doc(ctx("paul"), "users", "paul"), profile("paul", { joinCode: "FAUX" })));
    await assertFails(setDoc(doc(ctx("paul"), "users", "paul"), profile("paul")));
  });
  it("refuse sans consentement, avec un poste inconnu ou pour un autre uid", async () => {
    const { consentAt, ...noConsent } = profile("paul", { joinCode: "RUGBY2026" });
    await assertFails(setDoc(doc(ctx("paul"), "users", "paul"), noConsent));
    await assertFails(setDoc(doc(ctx("paul"), "users", "paul"), profile("paul", { joinCode: "RUGBY2026", poste: "Ailier" })));
    await assertFails(setDoc(doc(ctx("paul"), "users", "lea"), profile("lea", { joinCode: "RUGBY2026" })));
  });
  it("un athlète ne peut pas lister les codes d'équipe ni gérer les équipes", async () => {
    await signup("paul");
    await assertFails(getDocs(collection(ctx("paul"), "teamCodes")));
    await assertSucceeds(getDocs(collection(ctx("coach"), "teamCodes")));
    await assertSucceeds(getDoc(doc(ctx("paul"), "teams", T1)));
    await assertFails(updateDoc(doc(ctx("paul"), "teams", T1), { name: "Pirates" }));
    await assertFails(setDoc(doc(ctx("paul"), "teams", "t9"), { name: "X", createdAt: serverTimestamp(), createdBy: "paul" }));
  });
  it("le coach renomme une équipe, mais pas avec un nom vide", async () => {
    await assertSucceeds(updateDoc(doc(ctx("coach"), "teams", T1), { name: "Seniors A" }));
    await assertFails(updateDoc(doc(ctx("coach"), "teams", T1), { name: " " }));
  });
  it("un athlète ne voit que ses équipes", async () => {
    await signup("paul");
    await signup("lea");
    await assertSucceeds(getDocs(query(collection(ctx("paul"), "members"), where("uid", "==", "paul"))));
    await assertFails(getDocs(collection(ctx("paul"), "members")));
    await assertSucceeds(getDocs(collection(ctx("coach"), "members")));
  });
});

describe("profils et rôles", () => {
  beforeEach(async () => {
    await becomeFirstCoach(ctx("coach"), "coach");
    await planSession();
    await createTeam();
    await signup("paul");
    await signup("lea");
  });

  it("un athlète modifie son nom/poste mais pas son rôle", async () => {
    await assertSucceeds(updateDoc(doc(ctx("paul"), "users", "paul"), { name: "Paul M.", poste: "Arrières" }));
    await assertFails(updateDoc(doc(ctx("paul"), "users", "paul"), { role: "COACH" }));
  });
  it("un athlète ne lit pas le profil des autres, le coach si", async () => {
    await assertFails(getDoc(doc(ctx("paul"), "users", "lea")));
    await assertSucceeds(getDoc(doc(ctx("coach"), "users", "lea")));
  });
  it("le coach promeut un athlète mais ne peut pas se retirer lui-même", async () => {
    await assertSucceeds(updateDoc(doc(ctx("coach"), "users", "paul"), { role: "COACH" }));
    await assertFails(updateDoc(doc(ctx("coach"), "users", "coach"), { role: "ATHLETE" }));
  });
  it("un athlète peut supprimer son compte, pas celui des autres", async () => {
    await assertFails(deleteDoc(doc(ctx("paul"), "users", "lea")));
    await assertSucceeds(deleteDoc(doc(ctx("paul"), "users", "paul")));
  });
});

describe("réponses", () => {
  beforeEach(async () => {
    await becomeFirstCoach(ctx("coach"), "coach");
    await planSession();
    await createTeam();
    await signup("paul");
    await signup("lea");
  });

  it("un athlète envoie et met à jour sa réponse", async () => {
    const db = ctx("paul");
    // le front lit d'abord le document (inexistant) pour savoir s'il s'agit d'une mise à jour
    await assertSucceeds(getDoc(doc(db, "responses", `paul_${SID}`)));
    await assertFails(getDoc(doc(db, "responses", `lea_${SID}`)));
    await assertSucceeds(setDoc(doc(db, "responses", `paul_${SID}`), answer("paul")));
    await assertSucceeds(setDoc(doc(db, "responses", `paul_${SID}`), answer("paul", { mus: 90 })));
  });
  it("refuse les valeurs hors 1-100, une date future ou un mauvais identifiant", async () => {
    const db = ctx("paul");
    await assertFails(setDoc(doc(db, "responses", `paul_${SID}`), answer("paul", { mus: 150 })));
    await planSession("futur", "2099-01-01");
    await assertFails(setDoc(doc(db, "responses", "paul_futur"), answer("paul", { sessionId: "futur", date: "2099-01-01" })));
    await assertFails(setDoc(doc(db, "responses", "autre-id"), answer("paul")));
  });
  it("impossible d'écrire pour un autre ou de falsifier son nom", async () => {
    const db = ctx("paul");
    await assertFails(setDoc(doc(db, "responses", `lea_${SID}`), answer("lea")));
    await assertFails(setDoc(doc(db, "responses", `paul_${SID}`), answer("paul", { name: "Lea" })));
  });
  it("un athlète ne lit que ses réponses, le coach lit tout", async () => {
    await setDoc(doc(ctx("paul"), "responses", `paul_${SID}`), answer("paul"));
    await setDoc(doc(ctx("lea"), "responses", `lea_${SID}`), answer("lea"));
    await assertSucceeds(getDocs(query(collection(ctx("paul"), "responses"), where("uid", "==", "paul"))));
    await assertFails(getDocs(collection(ctx("paul"), "responses")));
    await assertFails(getDoc(doc(ctx("paul"), "responses", `lea_${SID}`)));
    await assertSucceeds(getDocs(collection(ctx("coach"), "responses")));
  });
  it("il faut être membre de l'équipe de la séance", async () => {
    await createTeam("t2", "JUNIORS2026", "Juniors");
    await planSession("s2", today, "t2");
    await assertFails(setDoc(doc(ctx("paul"), "responses", "paul_s2"), answer("paul", { sessionId: "s2", teamId: "t2" })));
    await assertFails(setDoc(doc(ctx("paul"), "responses", `paul_${SID}`), answer("paul", { teamId: "t2" })));
    // le staff répond dans toutes les équipes
    await assertSucceeds(setDoc(doc(ctx("coach"), "responses", "coach_s2"), answer("coach", { poste: "", sessionId: "s2", teamId: "t2" })));
  });
  it("sans profil, impossible d'envoyer une réponse", async () => {
    await assertFails(setDoc(doc(ctx("inconnu"), "responses", `inconnu_${SID}`), answer("inconnu")));
  });
});

describe("coach = rôle unique, retrait d'un membre, fin de saison", () => {
  beforeEach(async () => {
    await becomeFirstCoach(ctx("coach"), "coach");
    await planSession();
    await createTeam();
    await signup("paul");
    await signup("lea");
    await setDoc(doc(ctx("paul"), "responses", `paul_${SID}`), answer("paul"));
    await setDoc(doc(ctx("lea"), "responses", `lea_${SID}`), answer("lea"));
  });

  it("un coach peut répondre au questionnaire (sans poste)", async () => {
    await assertSucceeds(setDoc(doc(ctx("coach"), "responses", `coach_${SID}`), answer("coach", { poste: "" })));
  });

  it("une ancienne réponse avec opposition reste valide, mais pas une valeur hors limites", async () => {
    await assertSucceeds(setDoc(doc(ctx("paul"), "responses", `paul_${SID}`), answer("paul", { opp: 60 })));
    await assertFails(setDoc(doc(ctx("paul"), "responses", `paul_${SID}`), answer("paul", { opp: 150 })));
  });

  it("un coach modifie son nom sans poste", async () => {
    await assertSucceeds(updateDoc(doc(ctx("coach"), "users", "coach"), { name: "Simon" }));
  });

  it("un athlète promu coach peut encore répondre", async () => {
    await updateDoc(doc(ctx("coach"), "users", "paul"), { role: "COACH" });
    await assertSucceeds(setDoc(doc(ctx("paul"), "responses", `paul_${SID}`), answer("paul", { mus: 80 })));
  });

  it("le coach retire un athlète d'une équipe, qui ne peut plus la rejoindre", async () => {
    const db = ctx("coach");
    const b = writeBatch(db);
    b.delete(doc(db, "responses", `paul_${SID}`));
    b.delete(doc(db, "members", `${T1}_paul`));
    b.set(doc(db, "removed", `${T1}_paul`), { uid: "paul", teamId: T1, name: "paul", email: "paul@club.fr", at: serverTimestamp(), by: "coach" });
    await assertSucceeds(b.commit());
    await assertFails(setDoc(doc(ctx("paul"), "members", `${T1}_paul`), member("paul")));
    // le coach l'autorise à revenir
    await assertSucceeds(deleteDoc(doc(db, "removed", `${T1}_paul`)));
    await assertSucceeds(setDoc(doc(ctx("paul"), "members", `${T1}_paul`), member("paul")));
  });

  it("impossible de marquer « retiré » un membre encore dans l'équipe", async () => {
    await assertFails(setDoc(doc(ctx("coach"), "removed", `${T1}_lea`), { uid: "lea", teamId: T1, name: "lea", email: "lea@club.fr", at: serverTimestamp(), by: "coach" }));
  });

  it("un athlète ne peut ni retirer un autre membre, ni supprimer ses réponses", async () => {
    const db = ctx("paul");
    await assertFails(deleteDoc(doc(db, "users", "lea")));
    await assertFails(deleteDoc(doc(db, "responses", `lea_${SID}`)));
    await assertFails(deleteDoc(doc(db, "members", `${T1}_lea`)));
    await assertFails(setDoc(doc(db, "removed", `${T1}_lea`), { uid: "lea", teamId: T1, name: "lea", email: "lea@club.fr", at: serverTimestamp(), by: "paul" }));
    await assertFails(getDocs(collection(db, "removed")));
  });

  it("un coach ne peut pas supprimer un autre coach ni se retirer lui-même", async () => {
    await updateDoc(doc(ctx("coach"), "users", "paul"), { role: "COACH" });
    await assertFails(deleteDoc(doc(ctx("coach"), "users", "paul")));
    await assertFails(setDoc(doc(ctx("coach"), "removed", `${T1}_coach`), { uid: "coach", teamId: T1, name: "c", email: "c@club.fr", at: serverTimestamp(), by: "coach" }));
  });

  it("fin de saison : le coach supprime toutes les réponses d'un coup (lot de 400)", async () => {
    await env.withSecurityRulesDisabled(async (c) => {
      const admin = c.firestore();
      for (let i = 0; i < 4; i++) {
        const b = writeBatch(admin);
        for (let j = 0; j < 100; j++) b.set(doc(admin, "responses", `x${i}_${j}`), { uid: "paul", date: today });
        await b.commit();
      }
    });
    const db = ctx("coach");
    const all = await getDocs(collection(db, "responses"));
    const b = writeBatch(db);
    all.docs.slice(0, 400).forEach((d) => b.delete(d.ref));
    await assertSucceeds(b.commit());
  });
});

describe("rôle développeur", () => {
  beforeEach(async () => {
    await becomeFirstCoach(ctx("coach"), "coach");
    await planSession();
    await createTeam();
    await signup("paul");
    await signup("noham");
    await setDoc(doc(ctx("paul"), "responses", `paul_${SID}`), answer("paul"));
    // DEV s'attribue uniquement depuis la console (règles contournées)
    await env.withSecurityRulesDisabled((c) => updateDoc(doc(c.firestore(), "users", "noham"), { role: "DEV" }));
  });

  it("personne ne peut s'attribuer ou attribuer DEV depuis le site", async () => {
    await assertFails(updateDoc(doc(ctx("paul"), "users", "paul"), { role: "DEV" }));
    await assertFails(updateDoc(doc(ctx("coach"), "users", "paul"), { role: "DEV" }));
  });

  it("le dev voit tout comme un coach et gère les rôles", async () => {
    const db = ctx("noham");
    await assertSucceeds(getDocs(collection(db, "responses")));
    await assertSucceeds(getDocs(collection(db, "users")));
    await assertSucceeds(getDocs(collection(db, "teamCodes")));
    await assertSucceeds(updateDoc(doc(db, "users", "paul"), { role: "COACH" }));
  });

  it("un coach ne peut ni changer le rôle du dev, ni le retirer", async () => {
    const db = ctx("coach");
    await assertFails(updateDoc(doc(db, "users", "noham"), { role: "ATHLETE" }));
    await assertFails(deleteDoc(doc(db, "users", "noham")));
    await deleteDoc(doc(db, "members", `${T1}_noham`));
    await assertFails(setDoc(doc(db, "removed", `${T1}_noham`), { uid: "noham", teamId: T1, name: "n", email: "n@club.fr", at: serverTimestamp(), by: "coach" }));
  });

  it("le dev peut répondre au questionnaire et changer son nom", async () => {
    await assertSucceeds(setDoc(doc(ctx("noham"), "responses", `noham_${SID}`), answer("noham")));
    await assertSucceeds(updateDoc(doc(ctx("noham"), "users", "noham"), { name: "Noham" }));
  });
});

describe("séances planifiées", () => {
  beforeEach(async () => {
    await becomeFirstCoach(ctx("coach"), "coach");
    await createTeam();
    await signup("paul");
  });

  const session = (extra = {}) => ({ teamId: T1, date: today, time: "18:30", title: "Entraînement", createdAt: serverTimestamp(), createdBy: "coach", ...extra });

  it("le coach planifie une séance, l'athlète la lit mais ne peut pas en créer", async () => {
    await assertSucceeds(setDoc(doc(ctx("coach"), "sessions", "a"), session()));
    await assertSucceeds(getDocs(collection(ctx("paul"), "sessions")));
    await assertFails(setDoc(doc(ctx("paul"), "sessions", "b"), session({ createdBy: "paul" })));
    await assertFails(deleteDoc(doc(ctx("paul"), "sessions", "a")));
  });

  it("séance invalide refusée (heure, titre vide)", async () => {
    await assertFails(setDoc(doc(ctx("coach"), "sessions", "c"), session({ time: "25h" })));
    await assertFails(setDoc(doc(ctx("coach"), "sessions", "c"), session({ title: "  " })));
    await assertFails(setDoc(doc(ctx("coach"), "sessions", "c"), session({ teamId: "inexistante" })));
  });

  it("une réponse doit viser une séance existante, à sa date", async () => {
    await setDoc(doc(ctx("coach"), "sessions", "a"), session());
    const db = ctx("paul");
    await assertSucceeds(setDoc(doc(db, "responses", "paul_a"), answer("paul", { sessionId: "a" })));
    await assertFails(setDoc(doc(db, "responses", "paul_inexistante"), answer("paul", { sessionId: "inexistante" })));
    await assertFails(setDoc(doc(db, "responses", "paul_a"), answer("paul", { sessionId: "a", date: "2020-01-01" })));
  });

  it("deux séances le même jour : deux réponses distinctes", async () => {
    await setDoc(doc(ctx("coach"), "sessions", "matin"), session({ time: "09:00" }));
    await setDoc(doc(ctx("coach"), "sessions", "soir"), session({ time: "18:00" }));
    const db = ctx("paul");
    await assertSucceeds(setDoc(doc(db, "responses", "paul_matin"), answer("paul", { sessionId: "matin" })));
    await assertSucceeds(setDoc(doc(db, "responses", "paul_soir"), answer("paul", { sessionId: "soir" })));
  });
});

describe("migration vers le multi-équipes", () => {
  beforeEach(async () => {
    await becomeFirstCoach(ctx("coach"), "coach");
    // données d'avant : code sans équipe, séance et réponse sans teamId, retrait global
    await env.withSecurityRulesDisabled(async (c) => {
      const a = c.firestore();
      await setDoc(doc(a, "teamCodes", "RUGBY2026"), { createdAt: serverTimestamp(), createdBy: "coach" });
      await setDoc(doc(a, "users", "paul"), profile("paul", { joinCode: "RUGBY2026" }));
      await setDoc(doc(a, "sessions", SID), { date: today, time: "", title: "Entraînement", createdAt: serverTimestamp(), createdBy: "coach" });
      const { teamId, ...old } = answer("paul");
      await setDoc(doc(a, "responses", `paul_${SID}`), old);
      await setDoc(doc(a, "removed", "lea"), { name: "lea", email: "lea@club.fr", at: serverTimestamp(), by: "coach" });
    });
  });

  it("le staff rattache tout à une première équipe en un lot", async () => {
    const db = ctx("coach");
    const b = writeBatch(db);
    b.set(doc(db, "teams", T1), { name: "Mon équipe", createdAt: serverTimestamp(), createdBy: "coach" });
    b.set(doc(db, "teamCodes", "RUGBY2026"), { teamId: T1, createdAt: serverTimestamp(), createdBy: "coach" });
    b.update(doc(db, "sessions", SID), { teamId: T1 });
    b.update(doc(db, "responses", `paul_${SID}`), { teamId: T1 });
    b.set(doc(db, "members", `${T1}_paul`), { uid: "paul", teamId: T1, since: "2026-09-01", at: serverTimestamp() });
    b.set(doc(db, "removed", `${T1}_lea`), { uid: "lea", teamId: T1, name: "lea", email: "lea@club.fr", at: serverTimestamp(), by: "coach" });
    b.delete(doc(db, "removed", "lea"));
    b.set(doc(db, "meta", "teams"), { teamId: T1, at: serverTimestamp(), by: "coach" });
    await assertSucceeds(b.commit());
    // le rattachement ne se fait qu'une fois, et un athlète ne peut pas le faire
    await assertFails(updateDoc(doc(db, "responses", `paul_${SID}`), { teamId: "t2" }));
  });

  it("un athlète ne peut pas rattacher une réponse", async () => {
    await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), "teams", T1), { name: "X", createdAt: serverTimestamp(), createdBy: "coach" }));
    await assertFails(updateDoc(doc(ctx("paul"), "responses", `paul_${SID}`), { teamId: T1 }));
  });
});

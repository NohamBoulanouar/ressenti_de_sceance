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

const answer = (uid, extra = {}) => ({
  uid, name: uid, poste: "Centres", date: today,
  mus: 50, car: 50, rep: 50, conc: 50, pla: 50, conf: 50, tec: 50, tac: 50, opp: 50,
  blessure: false, gene: "", updatedAt: serverTimestamp(), ...extra,
});

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
    await setDoc(doc(ctx("coach"), "teamCodes", "RUGBY2026"), { createdAt: serverTimestamp(), createdBy: "coach" });
  });

  it("accepte un bon code d'équipe", async () => {
    await assertSucceeds(setDoc(doc(ctx("paul"), "users", "paul"), profile("paul", { joinCode: "RUGBY2026" })));
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
  it("un athlète ne peut pas lire les codes d'équipe", async () => {
    await setDoc(doc(ctx("paul"), "users", "paul"), profile("paul", { joinCode: "RUGBY2026" }));
    await assertFails(getDocs(collection(ctx("paul"), "teamCodes")));
    await assertSucceeds(getDocs(collection(ctx("coach"), "teamCodes")));
  });
});

describe("profils et rôles", () => {
  beforeEach(async () => {
    await becomeFirstCoach(ctx("coach"), "coach");
    await setDoc(doc(ctx("coach"), "teamCodes", "RUGBY2026"), { createdAt: serverTimestamp(), createdBy: "coach" });
    await setDoc(doc(ctx("paul"), "users", "paul"), profile("paul", { joinCode: "RUGBY2026" }));
    await setDoc(doc(ctx("lea"), "users", "lea"), profile("lea", { joinCode: "RUGBY2026" }));
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
    await setDoc(doc(ctx("coach"), "teamCodes", "RUGBY2026"), { createdAt: serverTimestamp(), createdBy: "coach" });
    await setDoc(doc(ctx("paul"), "users", "paul"), profile("paul", { joinCode: "RUGBY2026" }));
    await setDoc(doc(ctx("lea"), "users", "lea"), profile("lea", { joinCode: "RUGBY2026" }));
  });

  it("un athlète envoie et met à jour sa réponse", async () => {
    const db = ctx("paul");
    // le front lit d'abord le document (inexistant) pour savoir s'il s'agit d'une mise à jour
    await assertSucceeds(getDoc(doc(db, "responses", `paul_${today}`)));
    await assertFails(getDoc(doc(db, "responses", `lea_${today}`)));
    await assertSucceeds(setDoc(doc(db, "responses", `paul_${today}`), answer("paul")));
    await assertSucceeds(setDoc(doc(db, "responses", `paul_${today}`), answer("paul", { mus: 90 })));
  });
  it("refuse les valeurs hors 1-100, une date future ou un mauvais identifiant", async () => {
    const db = ctx("paul");
    await assertFails(setDoc(doc(db, "responses", `paul_${today}`), answer("paul", { mus: 150 })));
    await assertFails(setDoc(doc(db, "responses", "paul_2099-01-01"), answer("paul", { date: "2099-01-01" })));
    await assertFails(setDoc(doc(db, "responses", "autre-id"), answer("paul")));
  });
  it("impossible d'écrire pour un autre ou de falsifier son nom", async () => {
    const db = ctx("paul");
    await assertFails(setDoc(doc(db, "responses", `lea_${today}`), answer("lea")));
    await assertFails(setDoc(doc(db, "responses", `paul_${today}`), answer("paul", { name: "Lea" })));
  });
  it("un athlète ne lit que ses réponses, le coach lit tout", async () => {
    await setDoc(doc(ctx("paul"), "responses", `paul_${today}`), answer("paul"));
    await setDoc(doc(ctx("lea"), "responses", `lea_${today}`), answer("lea"));
    await assertSucceeds(getDocs(query(collection(ctx("paul"), "responses"), where("uid", "==", "paul"))));
    await assertFails(getDocs(collection(ctx("paul"), "responses")));
    await assertFails(getDoc(doc(ctx("paul"), "responses", `lea_${today}`)));
    await assertSucceeds(getDocs(collection(ctx("coach"), "responses")));
  });
  it("sans profil, impossible d'envoyer une réponse", async () => {
    await assertFails(setDoc(doc(ctx("inconnu"), "responses", `inconnu_${today}`), answer("inconnu")));
  });
});

describe("coach = rôle unique, retrait d'un membre, fin de saison", () => {
  beforeEach(async () => {
    await becomeFirstCoach(ctx("coach"), "coach");
    await setDoc(doc(ctx("coach"), "teamCodes", "RUGBY2026"), { createdAt: serverTimestamp(), createdBy: "coach" });
    await setDoc(doc(ctx("paul"), "users", "paul"), profile("paul", { joinCode: "RUGBY2026" }));
    await setDoc(doc(ctx("lea"), "users", "lea"), profile("lea", { joinCode: "RUGBY2026" }));
    await setDoc(doc(ctx("paul"), "responses", `paul_${today}`), answer("paul"));
    await setDoc(doc(ctx("lea"), "responses", `lea_${today}`), answer("lea"));
  });

  it("un coach ne peut pas envoyer de réponse", async () => {
    await assertFails(setDoc(doc(ctx("coach"), "responses", `coach_${today}`), answer("coach", { poste: "" })));
  });

  it("un coach modifie son nom sans poste", async () => {
    await assertSucceeds(updateDoc(doc(ctx("coach"), "users", "coach"), { name: "Simon" }));
  });

  it("un athlète promu coach ne peut plus répondre", async () => {
    await updateDoc(doc(ctx("coach"), "users", "paul"), { role: "COACH" });
    await assertFails(setDoc(doc(ctx("paul"), "responses", `paul_${today}`), answer("paul", { mus: 80 })));
  });

  it("le coach retire un athlète, qui ne peut plus se réinscrire", async () => {
    const db = ctx("coach");
    const b = writeBatch(db);
    b.delete(doc(db, "responses", `paul_${today}`));
    b.delete(doc(db, "users", "paul"));
    b.set(doc(db, "removed", "paul"), { name: "paul", email: "paul@club.fr", at: serverTimestamp(), by: "coach" });
    await assertSucceeds(b.commit());
    await assertSucceeds(getDoc(doc(ctx("paul"), "removed", "paul")));
    await assertFails(setDoc(doc(ctx("paul"), "users", "paul"), profile("paul", { joinCode: "RUGBY2026" })));
    // le coach l'autorise à revenir
    await assertSucceeds(deleteDoc(doc(db, "removed", "paul")));
    await assertSucceeds(setDoc(doc(ctx("paul"), "users", "paul"), profile("paul", { joinCode: "RUGBY2026" })));
  });

  it("un athlète ne peut ni retirer un autre membre, ni supprimer ses réponses", async () => {
    const db = ctx("paul");
    await assertFails(deleteDoc(doc(db, "users", "lea")));
    await assertFails(deleteDoc(doc(db, "responses", `lea_${today}`)));
    await assertFails(setDoc(doc(db, "removed", "lea"), { name: "lea", email: "lea@club.fr", at: serverTimestamp(), by: "paul" }));
    await assertFails(getDocs(collection(db, "removed")));
  });

  it("un coach ne peut pas supprimer un autre coach ni se retirer lui-même", async () => {
    await updateDoc(doc(ctx("coach"), "users", "paul"), { role: "COACH" });
    await assertFails(deleteDoc(doc(ctx("coach"), "users", "paul")));
    await assertFails(setDoc(doc(ctx("coach"), "removed", "coach"), { name: "c", email: "c@club.fr", at: serverTimestamp(), by: "coach" }));
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

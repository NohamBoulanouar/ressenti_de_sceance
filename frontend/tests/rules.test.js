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
  b.set(doc(db, "users", uid), profile(uid, { role: "COACH" }));
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

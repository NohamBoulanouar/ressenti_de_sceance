# Ressenti de séance

Suivi du ressenti des athlètes après chaque séance (physique, mental, rugby, santé), avec une vue coach pour l'équipe.

| Dossier | Contenu | Éditeur |
|---|---|---|
| `frontend/` | Site web (HTML/JS + Vite, Firebase Auth) | VS Code |
| `backend/` | API REST Spring Boot 3 (Java 17+), Firebase Admin / Firestore | IntelliJ IDEA |
| racine | Config Firebase (`firebase.json`, `firestore.rules`) | — |

```
Navigateur ──(email + mot de passe)──▶ Firebase Auth
    │ jeton
    ▼
API Spring Boot :8081 ──(SDK Admin)──▶ Firestore
```

Le navigateur ne touche jamais Firestore directement (`firestore.rules` bloque tout) : l'API vérifie le jeton et les droits athlète / coach.

---

## Lancer en local (3 terminaux)

### Prérequis (une seule fois)
- **Node.js 20+** : https://nodejs.org
- **Java 17+** (IntelliJ peut le télécharger : File > Project Structure > SDK)
- **Firebase CLI** : `npm install -g firebase-tools`

Aucun compte Google n'est nécessaire en local : tout tourne dans les **émulateurs Firebase** (projet `demo-ressenti`).

### 1. Émulateurs Firebase (à la racine du projet)
```bash
firebase emulators:start --import=./emulator-data --export-on-exit
```
- Auth sur 9099, Firestore sur 8080, interface d'admin sur **http://127.0.0.1:4000**
- `--import/--export-on-exit` garde tes comptes et réponses entre deux lancements (dossier `emulator-data/`, ignoré par Git).
  La toute première fois, le dossier n'existe pas : lance sans `--import=./emulator-data` (avec seulement `--export-on-exit=./emulator-data`).

### 2. Back (IntelliJ)
- *File > Open* → dossier `backend` (IntelliJ détecte le projet Maven)
- Lancer `RessentiApplication` (bouton ▶)
- Ou en terminal : `cd backend` puis `./mvnw spring-boot:run` (`mvnw.cmd spring-boot:run` sous Windows)
- API sur **http://localhost:8081**

### 3. Front (VS Code)
```bash
cd frontend
npm install
npm run dev
```
Ouvrir **http://localhost:5173**

### Premier test
1. Crée un compte : **le tout premier compte créé devient coach**.
2. Crée un 2ᵉ compte (fenêtre de navigation privée) : il sera athlète.
3. Le coach peut donner les droits coach à d'autres comptes depuis l'onglet **Comptes**.

---

## Fonctionnalités V1
- Comptes email + mot de passe ; nom et poste saisis **une seule fois** (modifiables dans « Mon profil »)
- Rôles **athlète** / **coach** (il reste toujours au moins un coach)
- Questionnaire : 9 curseurs, blessure, gêne ; **une réponse par séance** (renvoyer pour la même date la remplace)
- Coach : filtres période / poste / joueur, moyennes, blessures et gênes, tableau par joueur, intensité par séance, export CSV (Excel FR)
- Mot de passe oublié (en local, le lien apparaît dans le terminal des émulateurs)

## API
Toutes les routes exigent `Authorization: Bearer <jeton Firebase>`.

| Méthode | Route | Qui | Rôle |
|---|---|---|---|
| GET | `/api/me` | tous | Mon profil (404 si pas encore complété) |
| PUT | `/api/me` | tous | Créer / modifier nom + poste |
| GET | `/api/postes` | tous | Liste des postes |
| POST | `/api/responses` | tous | Envoyer une réponse |
| GET | `/api/responses/me?limit=5` | tous | Mes dernières réponses |
| GET | `/api/responses?from=&to=` | coach | Réponses de l'équipe |
| GET | `/api/users` | coach | Comptes de l'équipe |
| PATCH | `/api/users/{uid}/role` | coach | `{"role":"COACH"\|"ATHLETE"}` |

## Données (Firestore)
- `users/{uid}` : `email, name, poste, role, createdAt`
- `responses/{uid}_{date}` : `uid, name, poste, date, mus, car, rep, conc, pla, conf, tec, tac, opp, blessure, gene, updatedAt`

## Passer en production (plus tard)
1. Créer le vrai projet Firebase (région UE), activer Auth (email/mot de passe) et Firestore.
2. Back : `app.firebase.emulator=false`, `app.firebase.project-id=<id>`, variable `GOOGLE_APPLICATION_CREDENTIALS` = clé de compte de service (**ne jamais la commiter**).
3. Front : copier `.env.production.example` en `.env.production.local` et le remplir, puis `npm run build`.
4. `firebase deploy --only firestore:rules,hosting` pour les règles et le front.
5. ⚠️ L'API Java doit être hébergée quelque part (Cloud Run, Render, Railway…). C'est la seule partie qui peut sortir du gratuit : à étudier avant la mise en ligne.
6. RGPD : consentement explicite (données de santé), page confidentialité, accord parental pour les moins de 15 ans.

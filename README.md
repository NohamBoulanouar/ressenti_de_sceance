# Ressenti de séance

Suivi du ressenti des athlètes après chaque séance (physique, mental, rugby, santé), avec une vue coach pour l'équipe.
Le site est installable sur téléphone (PWA) et fonctionne avec le plan gratuit de Firebase.

```
Navigateur / téléphone ──▶ Firebase Auth  (comptes email + mot de passe)
        │
        └──────────────▶ Firestore      (données, droits garantis par firestore.rules)
```

Pas de serveur à héberger : le site parle directement à Firebase, et **toute la sécurité est dans `firestore.rules`** (testée par `npm run test:rules`).

| Chemin | Rôle |
|---|---|
| `frontend/` | Le site (HTML/JS + Vite), à ouvrir dans VS Code |
| `firestore.rules` | Qui a le droit de lire / écrire quoi |
| `frontend/tests/rules.test.js` | Tests automatiques des règles |
| `firebase.json` | Config Firebase (hébergement, émulateurs) |

---

## Lancer en local

Prérequis (une fois) : **Node.js 20+** et **Java 11+** (les émulateurs Firebase en ont besoin ; un JDK installé par IntelliJ suffit).

```bash
cd frontend
npm install
```

Puis deux terminaux, depuis `frontend/` :

```bash
npm run emulators   # Auth + Firestore en local, interface sur http://127.0.0.1:4000
npm run dev         # le site sur http://localhost:5173
```

Les données locales sont gardées entre deux lancements dans `emulator-data/` (ignoré par Git).
Pour repartir de zéro : arrêter les émulateurs et supprimer ce dossier.

### Premier test
1. Crée un compte : **le tout premier compte devient coach** (pas de code demandé).
2. Onglet **Équipe & code** → *Générer* → *Créer* : c'est le code à donner aux athlètes.
3. Dans une fenêtre de navigation privée, crée un compte athlète avec ce code.

### Tests des règles de sécurité
```bash
npm run test:rules
```

---

## Fonctionnement

- **Inscription** : email + mot de passe, puis nom, poste, **code d'équipe** et **consentement RGPD** (une seule fois).
- **Rôles** : le premier inscrit est coach. Un coach peut donner ou retirer le rôle coach aux autres, mais pas se le retirer à lui-même : il reste donc toujours au moins un coach.
- **Code d'équipe** : sans lui, impossible de créer un profil. Le changer bloque les nouvelles inscriptions avec l'ancien code, sans toucher aux comptes existants.
- **Questionnaire** : 9 curseurs, blessure, gêne. **Une réponse par séance** : renvoyer pour la même date remplace la réponse.
- **Suivi coach** : filtres période / poste / joueur, moyennes, blessures et gênes, tableau par joueur, intensité par séance, export CSV (Excel FR).
- **RGPD** : page confidentialité, consentement horodaté, modification du profil, **suppression du compte et de toutes ses réponses** par l'athlète (« Mon profil »).
- **PWA** : « Ajouter à l'écran d'accueil » sur iPhone/Android, une fois le site en ligne.

### Ce que garantissent les règles Firestore
- Un athlète ne lit et n'écrit **que ses propres** réponses ; il ne voit pas le profil des autres.
- Personne ne peut se donner le rôle coach ; seul un coach peut le donner à quelqu'un d'autre.
- Notes entre 1 et 100, date pas dans le futur, une seule réponse par athlète et par date, nom et poste cohérents avec le profil.
- Inscription refusée sans code d'équipe valide ou sans consentement.
- Les codes d'équipe ne sont lisibles que par les coachs.

### Données (Firestore)
- `users/{uid}` : `name, poste, role, email, joinCode, consentAt, createdAt`
- `responses/{uid}_{date}` : `uid, name, poste, date, mus, car, rep, conc, pla, conf, tec, tac, opp, blessure, gene, updatedAt`
- `teamCodes/{code}` : codes valides
- `meta/setup` : marque que le premier coach existe

---

## Mettre en ligne (gratuit, plan Spark)

1. **Créer le projet** sur https://console.firebase.google.com (sans Google Analytics).
2. **Authentication** → *Commencer* → activer **Adresse e-mail/Mot de passe**.
3. **Firestore Database** → *Créer une base* → mode **production**, emplacement **en Europe** (ex. `eur3` ou `europe-west9` Paris). ⚠️ L'emplacement ne peut plus être changé ensuite.
4. **Paramètres du projet** → *Vos applications* → ajouter une **application Web** → copier la config.
5. Dans `frontend/`, copier `.env.production.example` en `.env.production.local` et le remplir avec cette config.
6. Relier le dossier au projet (une fois), depuis la racine :
   ```bash
   cd frontend
   npx firebase login
   npx firebase use --add --config ../firebase.json   # choisir le projet, alias "default"
   ```
7. Déployer le site et les règles :
   ```bash
   npm run deploy
   ```
   Le site est en ligne sur `https://<id-du-projet>.web.app`.
8. Créer **ton** compte en premier (tu deviens coach), puis le code d'équipe.

Avant d'inviter l'équipe : adapter le texte de `frontend/src/views/privacy.js` (nom du club, contact).

## Limites connues (V1)
- Pas de lien magique ni de connexion Google (email + mot de passe uniquement).
- « Mot de passe oublié » : en local, le lien s'affiche dans le terminal des émulateurs.
- Un coach qui veut supprimer son compte doit d'abord être repassé athlète par un autre coach.

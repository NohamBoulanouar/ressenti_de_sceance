// [clé, titre, question, libellé gauche, libellé droite] — curseur de 1 à 100 (valeur non affichée)
export const QS = [
  ["Physique", [
    ["mus", "Intensité musculaire", "Quel a été ton niveau d'effort musculaire ?", "Très facile", "Effort maximal"],
    ["car", "Intensité cardio", "Quel a été ton niveau d'effort cardio-respiratoire ?", "Très facile", "Effort maximal"],
    ["rep", "Répétition des efforts", "Aujourd'hui, te sentais-tu capable de répéter les efforts ?", "Pas du tout", "Sans baisse"],
  ]],
  ["Mental", [
    ["conc", "Concentration", "Étais-tu concentré pendant la séance ?", "Pas du tout", "Toujours attentif"],
    ["pla", "Plaisir", "As-tu pris du plaisir pendant la séance ?", "J'ai détesté", "Maximum de plaisir"],
    ["conf", "Confiance", "Te sentais-tu confiant dans ce que tu faisais ?", "Pas du tout", "Totalement confiant"],
  ]],
  ["Rugby", [
    ["tec", "Maîtrise technique", "Comment as-tu ressenti ta maîtrise technique (passes, plaquages, rucks…) ?", "Très mauvaise", "Excellente"],
    ["tac", "Maîtrise tactique", "Comment as-tu ressenti ta lecture du jeu et ta compréhension des systèmes ?", "Perdu", "Très à l'aise"],
  ]],
];

export const KEYS = QS.flatMap(([, qs]) => qs.map((q) => q[0]));
export const LABELS = Object.fromEntries(QS.flatMap(([, qs]) => qs.map((q) => [q[0], q[1]])));
export const SHORT = { mus: "Musc.", car: "Cardio", rep: "Répét.", conc: "Conc.", pla: "Plaisir", conf: "Conf.", tec: "Tech.", tac: "Tact." };
export const POSTES = ["1ère ligne", "2ème ligne", "3ème ligne", "9/10", "Centres", "Arrières"];

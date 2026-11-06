// [clé, titre, question, libellé bas, libellé haut]
export const QS = [
  ["Physique", [
    ["mus", "Intensité musculaire", "Quel a été ton niveau d'effort musculaire ?", "1 = très facile", "100 = effort maximal"],
    ["car", "Intensité cardio", "Quel a été ton niveau d'effort cardio-respiratoire ?", "1 = très facile", "100 = effort maximal"],
    ["rep", "Répétition des efforts", "Aujourd'hui, te sentais-tu capable de répéter les efforts ?", "1 = pas du tout", "100 = sans baisse"],
  ]],
  ["Mental", [
    ["conc", "Concentration", "Étais-tu concentré pendant la séance ?", "1 = pas du tout", "100 = toujours attentif"],
    ["pla", "Plaisir", "As-tu pris du plaisir pendant la séance ?", "1 = j'ai détesté", "100 = maximum de plaisir"],
    ["conf", "Confiance", "Te sentais-tu confiant dans ce que tu faisais ?", "1 = pas du tout", "100 = totalement confiant"],
  ]],
  ["Rugby", [
    ["tec", "Maîtrise technique", "Comment as-tu ressenti ta maîtrise technique (passes, plaquages, rucks…) ?", "1 = très mauvaise", "100 = excellente"],
    ["tac", "Maîtrise tactique", "Comment as-tu ressenti ta lecture du jeu et ta compréhension des systèmes ?", "1 = perdu", "100 = très à l'aise"],
    ["opp", "Opposition", "Comment as-tu ressenti la difficulté de l'opposition ?", "1 = beaucoup trop faible · 50 = adaptée", "100 = beaucoup trop forte"],
  ]],
];

export const KEYS = QS.flatMap(([, qs]) => qs.map((q) => q[0]));
export const LABELS = Object.fromEntries(QS.flatMap(([, qs]) => qs.map((q) => [q[0], q[1]])));
export const SHORT = { mus: "Musc.", car: "Cardio", rep: "Répét.", conc: "Conc.", pla: "Plaisir", conf: "Conf.", tec: "Tech.", tac: "Tact.", opp: "Opp." };
export const POSTES = ["1ère ligne", "2ème ligne", "3ème ligne", "9/10", "Centres", "Arrières"];

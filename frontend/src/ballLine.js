// Échelle « ligne + ballon » : une simple ligne, sans curseur ni jauge.
// Au premier appui sur la ligne, un ballon de rugby apparaît à cet endroit ; on peut ensuite le faire glisser.
// Valeur de 1 à 100 (jamais affichée). Accessible au clavier (flèches, Début, Fin).

/** HTML d'une ligne. */
export function ballLineHtml(key, label) {
  return `<div class="bl" role="slider" tabindex="0" data-k="${key}" aria-label="${label}"
      aria-valuemin="1" aria-valuemax="100" aria-valuetext="pas encore répondu">
    <span class="bl-ball" aria-hidden="true"></span>
  </div>`;
}

/**
 * Active toutes les lignes de `root`.
 * onChange(key, value) est appelé à chaque modification.
 */
export function initBallLines(root, onChange) {
  root.querySelectorAll(".bl").forEach((line) => {
    const set = (value) => {
      const v = Math.max(1, Math.min(100, Math.round(value)));
      line.style.setProperty("--pct", `${((v - 1) / 99) * 100}%`);
      line.classList.add("set");
      line.classList.remove("todo");
      line.setAttribute("aria-valuenow", v);
      line.setAttribute("aria-valuetext", `${v} sur 100`);
      line.dataset.value = v;
      onChange(line.dataset.k, v);
    };
    const valueAt = (clientX) => {
      const r = line.getBoundingClientRect();
      return 1 + Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * 99;
    };

    // Souris / doigt : un appui pose le ballon, un glissement horizontal le déplace.
    // Un geste vertical (défilement de la page) ne pose rien.
    let start = null;
    line.addEventListener("pointerdown", (e) => {
      start = { x: e.clientX, y: e.clientY, dragging: e.pointerType === "mouse" };
      line.setPointerCapture(e.pointerId);
      if (start.dragging) set(valueAt(e.clientX)); // à la souris, effet immédiat
    });
    line.addEventListener("pointermove", (e) => {
      if (!start) return;
      if (!start.dragging && Math.abs(e.clientX - start.x) > 4 && Math.abs(e.clientX - start.x) > Math.abs(e.clientY - start.y)) {
        start.dragging = true;
      }
      if (start.dragging) {
        line.classList.add("dragging");
        set(valueAt(e.clientX));
      }
    });
    const end = (e, cancelled) => {
      if (!start) return;
      if (!cancelled && !start.dragging) set(valueAt(e.clientX)); // simple appui
      start = null;
      line.classList.remove("dragging");
    };
    line.addEventListener("pointerup", (e) => end(e, false));
    line.addEventListener("pointercancel", (e) => end(e, true));

    // Clavier
    line.addEventListener("keydown", (e) => {
      const cur = line.dataset.value ? +line.dataset.value : 50;
      const steps = { ArrowRight: 5, ArrowUp: 5, ArrowLeft: -5, ArrowDown: -5, PageUp: 20, PageDown: -20 };
      if (e.key in steps) set(line.dataset.value ? cur + steps[e.key] : 50);
      else if (e.key === "Home") set(1);
      else if (e.key === "End") set(100);
      else return;
      e.preventDefault();
    });
  });
}

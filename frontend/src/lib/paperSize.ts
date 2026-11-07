// Format de papier des bordereaux et reçus magasinier : A4 (feuille entière) ou A5 (demi-feuille, comme un carnet).
// Le choix est mémorisé sur cet ordinateur (navigateur). Si le navigateur refuse de stocker (navigation privée),
// le choix est gardé en mémoire jusqu'à la fermeture de la page.
export type PaperSize = "A4" | "A5";

const KEY = "qp.paperSize";
let memory: PaperSize = "A4";

export function getPaperSize(): PaperSize {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "A4" || saved === "A5") return saved;
  } catch {
    // stockage indisponible : on utilise la mémoire
  }
  return memory;
}

export function setPaperSize(size: PaperSize) {
  memory = size;
  try {
    localStorage.setItem(KEY, size);
  } catch {
    // ignoré : la valeur reste en mémoire
  }
}

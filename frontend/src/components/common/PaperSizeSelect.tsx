import { useState } from "react";
import { Select } from "@/components/ui/input";
import { getPaperSize, setPaperSize, type PaperSize } from "@/lib/paperSize";

// Choix du papier pour l'impression des bordereaux et reçus magasinier (A4 ou A5).
export function PaperSizeSelect({ className }: { className?: string }) {
  const [size, setSize] = useState<PaperSize>(getPaperSize());
  return (
    <label className={"flex items-center gap-2 text-sm text-muted-foreground " + (className ?? "")}>
      Papier
      <Select
        aria-label="Format du papier d'impression"
        className="h-8 w-24"
        value={size}
        onChange={(e) => {
          const next = e.target.value as PaperSize;
          setPaperSize(next);
          setSize(next);
        }}
      >
        <option value="A4">A4</option>
        <option value="A5">A5</option>
      </Select>
    </label>
  );
}

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "XOF"): string {
  try {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount || 0);
  } catch {
    return `${Math.round(amount || 0).toLocaleString("fr-FR")} ${currency}`;
  }
}

// Quantité lisible : arrondie à 3 décimales, sans zéros inutiles (2,5 ; 20 ; 0,333)
export function formatQty(n: number | null | undefined): string {
  const v = Math.round((Number(n) || 0) * 1000) / 1000;
  return v.toLocaleString("fr-FR", { maximumFractionDigits: 3 });
}

// Unité d'une ligne de vente : celle choisie à la vente, sinon l'unité de base du produit.
export function itemUnit(it: { unit?: string | null; product?: { unit?: string } | null }): string {
  return it.unit || it.product?.unit || "";
}

export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export const PAYMENT_LABELS: Record<string, string> = {
  ESPECES: "Espèces",
  MOBILE_MONEY: "Mobile Money",
  CARTE: "Carte",
  VIREMENT: "Virement",
  MIXTE: "Mixte",
};

export function paymentLabel(method: string): string {
  return PAYMENT_LABELS[method] ?? method;
}

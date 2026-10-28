import { formatCurrency, formatDate, formatDateTime, formatDeliveryNumber, formatQty, itemUnit, paymentLabel } from "@/lib/utils";
import { qrSvg } from "@/lib/qr";
import type { Company, Sale } from "@/types";

// ---------------------------------------------------------------------------
// Documents imprimables : devis proforma (A4) et reçu ticket (80 mm).
// Le document est construit en HTML puis imprimé dans un cadre invisible :
// seule la page du document est imprimée (pas l'application), et le navigateur
// permet aussi « Enregistrer au format PDF ».
// ---------------------------------------------------------------------------

const esc = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// Texte libre (pied de page) : échappé, retours à la ligne conservés
const multiline = (v: string) => esc(v).replace(/\r?\n/g, "<br>");

export function printHtml(html: string) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  if (!win) {
    iframe.remove();
    return;
  }
  const doc = win.document;
  doc.open();
  doc.write(html);
  doc.close();

  const remove = () => iframe.remove();
  win.onafterprint = remove;
  setTimeout(remove, 120000);

  const run = () => {
    win.focus();
    win.print();
  };

  // Attend le chargement du logo avant d'imprimer
  const pending = Array.from(doc.images).filter((img) => !img.complete);
  if (!pending.length) {
    setTimeout(run, 150);
    return;
  }
  Promise.all(
    pending.map(
      (img) =>
        new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
        })
    )
  ).then(() => setTimeout(run, 150));
}

const TITLES: Record<string, string> = {
  DEVIS: "DEVIS PROFORMA",
  BON_LIVRAISON: "BON DE LIVRAISON",
  VENTE: "REÇU DE VENTE",
};

function header(company: Company, small: boolean) {
  const lines = [company.address, company.phone && `Tél : ${company.phone}`, company.email].filter(Boolean) as string[];
  return `
    <div class="head ${small ? "head-small" : ""}">
      ${company.logo ? `<img class="logo" src="${esc(company.logo)}" alt="">` : ""}
      <div class="company">
        <div class="company-name">${esc(company.name)}</div>
        ${lines.map((l) => `<div class="muted">${esc(l)}</div>`).join("")}
      </div>
    </div>`;
}

// ------------------------------ Devis proforma A4 ------------------------------

export function buildProformaHtml(sale: Sale, company: Company): string {
  const cur = company.currency || "XOF";
  const money = (n: number) => esc(formatCurrency(n, cur));
  const title = TITLES[sale.type] ?? "DOCUMENT";
  const customer = sale.customer;

  const rows = sale.items
    .map(
      (it, i) => `
      <tr>
        <td class="c">${i + 1}</td>
        <td>${esc(it.product?.name ?? it.productId)}</td>
        <td class="r">${esc(formatQty(it.quantity))}${itemUnit(it) ? ` <span class="muted">${esc(itemUnit(it))}</span>` : ""}</td>
        <td class="r">${money(it.unitPrice)}</td>
        <td class="r">${it.discount > 0 ? money(it.discount) : "—"}</td>
        <td class="r b">${money(it.total)}</td>
      </tr>`
    )
    .join("");

  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>${esc(title)} ${esc(sale.number)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #111; margin: 0; }
  .head { display: flex; align-items: center; gap: 14px; border-bottom: 2px solid #111; padding-bottom: 10px; }
  .logo { max-height: 70px; max-width: 140px; object-fit: contain; }
  .company-name { font-size: 20px; font-weight: 700; }
  .muted { color: #555; }
  h1 { font-size: 22px; letter-spacing: 1px; margin: 18px 0 4px; }
  .meta { display: flex; justify-content: space-between; gap: 20px; margin: 14px 0 16px; }
  .box { border: 1px solid #bbb; border-radius: 4px; padding: 8px 10px; min-width: 45%; }
  .box h3 { margin: 0 0 4px; font-size: 11px; text-transform: uppercase; color: #555; letter-spacing: .5px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #eee; text-align: left; font-size: 11px; text-transform: uppercase; padding: 7px 8px; border: 1px solid #bbb; }
  td { padding: 7px 8px; border: 1px solid #ccc; vertical-align: top; }
  .r { text-align: right; white-space: nowrap; } .c { text-align: center; width: 28px; } .b { font-weight: 700; }
  tr { page-break-inside: avoid; }
  .totals { width: 46%; margin: 12px 0 0 auto; }
  .totals div { display: flex; justify-content: space-between; padding: 4px 8px; }
  .totals .grand { background: #111; color: #fff; font-size: 14px; font-weight: 700; border-radius: 3px; margin-top: 4px; padding: 8px; }
  .note { margin-top: 18px; font-size: 11px; color: #444; }
  .sign { display: flex; justify-content: space-between; gap: 30px; margin-top: 36px; page-break-inside: avoid; }
  .sign div { flex: 1; border-top: 1px solid #111; padding-top: 4px; text-align: center; font-size: 11px; color: #555; }
  .footer { margin-top: 22px; padding-top: 8px; border-top: 1px solid #bbb; text-align: center; font-size: 11px; color: #444; }
</style></head><body>
  ${header(company, false)}
  <h1>${esc(title)}</h1>
  <div class="meta">
    <div class="box">
      <h3>Document</h3>
      <div><b>N° ${esc(sale.number)}</b></div>
      <div>Date : ${esc(formatDate(sale.createdAt))}</div>
      ${sale.user?.name ? `<div>Établi par : ${esc(sale.user.name)}</div>` : ""}
    </div>
    <div class="box">
      <h3>Client</h3>
      <div><b>${esc(customer?.name || "Client comptant")}</b></div>
      ${customer?.phone ? `<div>Tél : ${esc(customer.phone)}</div>` : ""}
      ${customer?.address ? `<div>${esc(customer.address)}</div>` : ""}
    </div>
  </div>
  <table>
    <thead><tr><th class="c">#</th><th>Désignation</th><th class="r">Qté</th><th class="r">Prix unitaire</th><th class="r">Remise</th><th class="r">Montant</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="totals">
    <div><span>Sous-total</span><span>${money(sale.subtotal)}</span></div>
    ${sale.discount > 0 ? `<div><span>Remise</span><span>- ${money(sale.discount)}</span></div>` : ""}
    <div class="grand"><span>TOTAL</span><span>${money(sale.totalAmount)}</span></div>
  </div>
  ${sale.type === "DEVIS" ? `<p class="note">Ce devis proforma ne constitue pas une facture. Les prix peuvent évoluer ; le stock n'est pas réservé tant que la vente n'est pas validée.</p>` : ""}
  <div class="sign"><div>Signature du client</div><div>Cachet et signature de l'entreprise</div></div>
  ${company.receiptFooter ? `<div class="footer">${multiline(company.receiptFooter)}</div>` : ""}
</body></html>`;
}

// ------------------------------ Reçu ticket 80 mm ------------------------------

export function buildReceiptHtml(sale: Sale, company: Company): string {
  const cur = company.currency || "XOF";
  const money = (n: number) => esc(formatCurrency(n, cur));
  const title = TITLES[sale.type] ?? "REÇU";
  const remaining = sale.totalAmount - sale.paidAmount;

  const items = sale.items
    .map(
      (it) => `
      <div class="item">
        <div>${esc(it.product?.name ?? it.productId)}</div>
        <div class="row"><span>${esc(formatQty(it.quantity))}${itemUnit(it) ? ` ${esc(itemUnit(it))}` : ""} x ${money(it.unitPrice)}${it.discount > 0 ? ` (remise ${money(it.discount)})` : ""}</span><span class="b">${money(it.total)}</span></div>
      </div>`
    )
    .join("");

  const payments = sale.salePayments?.length
    ? sale.salePayments.map((p) => `<div class="row"><span>${esc(paymentLabel(p.method))}</span><span>${money(p.amount)}</span></div>`).join("")
    : sale.paidAmount > 0
    ? `<div class="row"><span>${esc(paymentLabel(sale.paymentMethod))}</span><span>${money(sale.paidAmount)}</span></div>`
    : "";

  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>${esc(title)} ${esc(sale.number)}</title>
<style>
  @page { size: 80mm auto; margin: 3mm; }
  * { box-sizing: border-box; }
  body { width: 74mm; margin: 0 auto; font-family: "Courier New", monospace; font-size: 11px; color: #000; }
  .center { text-align: center; }
  .logo { max-height: 50px; max-width: 60mm; object-fit: contain; display: block; margin: 0 auto 4px; }
  .company-name { font-size: 14px; font-weight: 700; }
  .muted { color: #333; }
  .sep { border-top: 1px dashed #000; margin: 6px 0; }
  .row { display: flex; justify-content: space-between; gap: 6px; }
  .item { margin-bottom: 4px; }
  .b { font-weight: 700; }
  .total { font-size: 14px; font-weight: 700; }
  .footer { text-align: center; margin-top: 8px; }
</style></head><body>
  <div class="center">
    ${company.logo ? `<img class="logo" src="${esc(company.logo)}" alt="">` : ""}
    <div class="company-name">${esc(company.name)}</div>
    ${company.address ? `<div class="muted">${esc(company.address)}</div>` : ""}
    ${company.phone ? `<div class="muted">Tél : ${esc(company.phone)}</div>` : ""}
    ${company.email ? `<div class="muted">${esc(company.email)}</div>` : ""}
  </div>
  <div class="sep"></div>
  <div class="center b">${esc(title)}</div>
  <div class="row"><span>N° ${esc(sale.number)}</span></div>
  <div>${esc(formatDateTime(sale.createdAt))}</div>
  ${sale.customer?.name ? `<div>Client : ${esc(sale.customer.name)}</div>` : ""}
  ${sale.user?.name ? `<div>Vendeur : ${esc(sale.user.name)}</div>` : ""}
  <div class="sep"></div>
  ${items}
  <div class="sep"></div>
  ${sale.discount > 0 ? `<div class="row"><span>Remise</span><span>- ${money(sale.discount)}</span></div>` : ""}
  <div class="row total"><span>TOTAL</span><span>${money(sale.totalAmount)}</span></div>
  ${
    sale.type === "VENTE"
      ? `<div class="sep"></div>
         ${payments}
         <div class="row"><span>Payé</span><span>${money(sale.paidAmount)}</span></div>
         ${remaining > 0.0001 ? `<div class="row b"><span>Reste à payer</span><span>${money(remaining)}</span></div>` : ""}`
      : ""
  }
  <div class="sep"></div>
  <div class="footer">${company.receiptFooter ? multiline(company.receiptFooter) : "Merci de votre confiance"}</div>
</body></html>`;
}

// ------------------- Bordereau de livraison (copie client) et reçu magasinier -------------------
//
// À chaque vente, la caisse produit 2 documents :
//  1. le BORDEREAU DE LIVRAISON : la copie du client, avec les prix (modèle papier de l'entreprise) ;
//  2. le REÇU MAGASINIER : que le client présente au magasinier pour retirer ses produits.
//     Sans aucun prix, avec un QR code et un code secret unique, valable sans limite de date
//     jusqu'à ce que tout soit remis. Le magasinier le valide dans le logiciel (page « Remises »).

type Parts = { css: string; body: string };

function htmlDocument(title: string, parts: Parts[]): string {
  const pages = parts.map((p) => `<section class="page">${p.body}</section>`).join("");
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #111; margin: 0; }
  .page { page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  ${parts.map((p) => p.css).join("\n")}
</style></head><body>${pages}</body></html>`;
}

const BL_MIN_ROWS = 10; // lignes vides ajoutées pour garder l'aspect du carnet papier

function deliveryNoteParts(sale: Sale, company: Company): Parts {
  const cur = company.currency || "XOF";
  const money = (n: number) => esc(formatCurrency(n, cur));
  const d = new Date(sale.createdAt);
  const two = (n: number) => String(n).padStart(2, "0");

  const rows = sale.items.map(
    (it) => `
      <tr>
        <td>${esc(it.product?.name ?? it.productId)}</td>
        <td class="r">${esc(formatQty(it.quantity))}${itemUnit(it) ? ` <span class="muted">${esc(itemUnit(it))}</span>` : ""}</td>
        <td class="r">${money(it.unitPrice)}</td>
        <td class="r b">${money(it.total)}</td>
      </tr>`
  );
  while (rows.length < BL_MIN_ROWS) rows.push(`<tr class="empty"><td>&nbsp;</td><td></td><td></td><td></td></tr>`);

  const remaining = sale.totalAmount - sale.paidAmount;
  const contact: string[] = [];
  if (company.address) contact.push(`<div><b>Siège :</b> ${esc(company.address)}</div>`);
  if (company.phone) contact.push(`<div><b>Contacts :</b> ${esc(company.phone)}</div>`);
  if (company.email) contact.push(`<div><b>E-mail :</b> ${esc(company.email)}</div>`);

  const css = `
  .bl-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
  .bl-name { flex: 1; border: 2px solid #111; border-radius: 14px; padding: 8px 16px; font-size: 30px; font-weight: 800; line-height: 1.1; }
  .bl-date { width: 62mm; border: 2px solid #111; border-radius: 6px; }
  .bl-date table { width: 100%; border-collapse: collapse; }
  .bl-date th { font-size: 10px; text-transform: uppercase; padding: 3px 0; border-bottom: 1px solid #111; border-right: 1px solid #111; }
  .bl-date td { text-align: center; font-size: 17px; font-weight: 700; padding: 8px 0; border-right: 1px solid #111; }
  .bl-date th:last-child, .bl-date td:last-child { border-right: 0; }
  .bl-head { display: flex; gap: 14px; align-items: center; margin-top: 10px; }
  .bl-logo { width: 38mm; flex: none; text-align: center; }
  .bl-logo img { max-width: 100%; max-height: 28mm; object-fit: contain; }
  .bl-slogan { font-size: 9px; font-style: italic; color: #333; margin-top: 2px; }
  .bl-info { flex: 1; text-align: center; line-height: 1.4; }
  .bl-info .act { font-size: 12px; margin-bottom: 4px; }
  .bl-title { display: flex; align-items: center; justify-content: center; gap: 12px; margin: 14px 0 8px; }
  .bl-title h1 { font-size: 22px; margin: 0; letter-spacing: .5px; }
  .bl-num { border: 2px solid #111; border-radius: 6px; padding: 2px 14px; font-size: 26px; font-weight: 800; letter-spacing: 1px; }
  .bl-client { border: 2px solid #111; border-radius: 14px; padding: 8px 16px; font-size: 15px; font-weight: 700; margin-bottom: 10px; }
  .bl-client span { font-weight: 400; }
  .bl-table { width: 100%; border-collapse: collapse; border: 2px solid #111; }
  .bl-table th { text-align: center; font-size: 12px; padding: 8px 6px; border: 1px solid #111; }
  .bl-table th:first-child { text-align: left; }
  .bl-table td { padding: 8px 8px; border: 1px solid #111; vertical-align: top; }
  .bl-table tr { page-break-inside: avoid; }
  .bl-table tr.empty td { height: 9mm; }
  .bl-table .r { text-align: right; white-space: nowrap; }
  .bl-table .b { font-weight: 700; }
  .bl-table .muted { color: #555; }
  .bl-total { display: flex; border: 2px solid #111; border-radius: 0 0 14px 14px; margin-top: -1px; }
  .bl-total div { padding: 9px 14px; font-size: 16px; font-weight: 800; }
  .bl-total .label { width: 30%; border-right: 2px solid #111; }
  .bl-total .value { flex: 1; text-align: right; }
  .bl-pay { margin-top: 6px; font-size: 11px; text-align: right; color: #333; }
  .bl-footer { margin-top: 14px; text-align: center; font-size: 11px; color: #444; }`;

  const body = `
  <div class="bl-top">
    <div class="bl-name">${esc(company.name)}</div>
    <div class="bl-date">
      <table>
        <thead><tr><th>Jour</th><th>Mois</th><th>Année</th></tr></thead>
        <tbody><tr><td>${two(d.getDate())}</td><td>${two(d.getMonth() + 1)}</td><td>${d.getFullYear()}</td></tr></tbody>
      </table>
    </div>
  </div>
  <div class="bl-head">
    <div class="bl-logo">
      ${company.logo ? `<img src="${esc(company.logo)}" alt="">` : ""}
      ${company.slogan ? `<div class="bl-slogan">${esc(company.slogan)}</div>` : ""}
    </div>
    <div class="bl-info">
      ${company.activities ? `<div class="act">${multiline(company.activities)}</div>` : ""}
      ${contact.join("")}
    </div>
  </div>
  <div class="bl-title">
    <h1>BORDEREAU DE LIVRAISON N°</h1>
    <div class="bl-num">${esc(formatDeliveryNumber(sale.deliveryNumber) || sale.number)}</div>
  </div>
  <div class="bl-client">Client : <span>${esc(sale.customer?.name || "Client comptant")}</span></div>
  <table class="bl-table">
    <thead><tr><th>DESIGNATIONS</th><th style="width:20%">QUANT</th><th style="width:20%">P. UNIT</th><th style="width:22%">P. TOTAL</th></tr></thead>
    <tbody>${rows.join("")}</tbody>
  </table>
  <div class="bl-total"><div class="label">TOTAL</div><div class="value">${money(sale.totalAmount)}</div></div>
  ${remaining > 0.0001 ? `<div class="bl-pay">Payé : ${money(sale.paidAmount)} — <b>Reste à payer : ${money(remaining)}</b></div>` : ""}
  <div class="bl-footer">${company.receiptFooter ? multiline(company.receiptFooter) : "Merci de votre confiance"}</div>`;

  return { css, body };
}

// Le code est affiché par blocs de 4 pour être lu et saisi sans erreur : 7K3M-9X2Q-WR4T-BD8F
const groupCode = (code: string) => code.replace(/(.{4})(?=.)/g, "$1-");

function pickupSlipParts(sale: Sale, company: Company, code: string): Parts {
  const rows = sale.items
    .map(
      (it) => `
      <tr>
        <td>${esc(it.product?.name ?? it.productId)}</td>
        <td class="r b">${esc(formatQty(it.quantity))} ${esc(itemUnit(it))}</td>
      </tr>`
    )
    .join("");

  const css = `
  .rm-wrap { border: 2px dashed #111; border-radius: 10px; padding: 14px 16px; }
  .rm-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
  .rm-co { font-size: 15px; font-weight: 800; }
  .rm-title { font-size: 22px; font-weight: 800; letter-spacing: .5px; margin: 2px 0 0; }
  .rm-sub { font-size: 11px; color: #333; }
  .rm-num { border: 2px solid #111; border-radius: 6px; padding: 4px 12px; font-size: 22px; font-weight: 800; text-align: center; }
  .rm-num small { display: block; font-size: 9px; font-weight: 400; text-transform: uppercase; letter-spacing: .5px; }
  .rm-meta { display: flex; gap: 22px; margin: 10px 0; font-size: 12px; }
  .rm-table { width: 100%; border-collapse: collapse; }
  .rm-table th { background: #eee; text-align: left; font-size: 11px; text-transform: uppercase; padding: 6px 8px; border: 1px solid #111; }
  .rm-table td { padding: 7px 8px; border: 1px solid #555; }
  .rm-table .r { text-align: right; white-space: nowrap; width: 28%; }
  .rm-table .b { font-weight: 700; }
  .rm-table tr { page-break-inside: avoid; }
  .rm-secure { display: flex; align-items: center; gap: 16px; margin-top: 14px; padding-top: 12px; border-top: 1px solid #111; }
  .rm-qr svg { display: block; width: 38mm; height: 38mm; }
  .rm-code { font-family: "Courier New", monospace; font-size: 20px; font-weight: 800; letter-spacing: 2px; }
  .rm-label { font-size: 10px; text-transform: uppercase; letter-spacing: .5px; color: #444; }
  .rm-warn { font-size: 10px; color: #333; margin-top: 6px; line-height: 1.4; }
  .rm-sign { display: flex; gap: 30px; margin-top: 22px; }
  .rm-sign div { flex: 1; border-top: 1px solid #111; padding-top: 4px; text-align: center; font-size: 10px; color: #555; }`;

  const d = new Date(sale.createdAt);
  const body = `
  <div class="rm-wrap">
    <div class="rm-top">
      <div>
        <div class="rm-co">${esc(company.name)}</div>
        <div class="rm-title">REÇU MAGASINIER</div>
        <div class="rm-sub">À présenter au magasinier pour retirer les produits ci-dessous</div>
      </div>
      <div class="rm-num"><small>Bordereau n°</small>${esc(formatDeliveryNumber(sale.deliveryNumber) || sale.number)}</div>
    </div>
    <div class="rm-meta">
      <div><b>Date :</b> ${esc(formatDateTime(d))}</div>
      <div><b>Client :</b> ${esc(sale.customer?.name || "Client comptant")}</div>
      ${sale.store?.name ? `<div><b>Dépôt :</b> ${esc(sale.store.name)}</div>` : ""}
    </div>
    <table class="rm-table">
      <thead><tr><th>Désignation</th><th class="r">Quantité</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="rm-secure">
      <div class="rm-qr">${qrSvg("QP1:" + code, 300)}</div>
      <div>
        <div class="rm-label">Code du reçu</div>
        <div class="rm-code">${esc(groupCode(code))}</div>
        <div class="rm-warn">
          Ce reçu est <b>unique et personnel</b>. Il n'a pas de date limite : il reste valable jusqu'à la remise complète des produits,
          puis il est annulé. Ne le donnez pas à un tiers et ne le photographiez pas.
        </div>
      </div>
    </div>
    <div class="rm-sign"><div>Signature du magasinier</div><div>Signature du client</div></div>
  </div>`;

  return { css, body };
}

export function buildDeliveryNoteHtml(sale: Sale, company: Company): string {
  return htmlDocument(`Bordereau de livraison ${formatDeliveryNumber(sale.deliveryNumber) || sale.number}`, [deliveryNoteParts(sale, company)]);
}

export function buildPickupSlipHtml(sale: Sale, company: Company, code: string): string {
  return htmlDocument(`Reçu magasinier ${formatDeliveryNumber(sale.deliveryNumber) || sale.number}`, [pickupSlipParts(sale, company, code)]);
}

// Les 2 documents d'une vente, en une seule impression : page 1 = bordereau client, page 2 = reçu magasinier.
export function buildSaleBundleHtml(sale: Sale, company: Company, code: string): string {
  return htmlDocument(`Vente ${sale.number}`, [deliveryNoteParts(sale, company), pickupSlipParts(sale, company, code)]);
}

export function printDeliveryNote(sale: Sale, company: Company) {
  printHtml(buildDeliveryNoteHtml(sale, company));
}

export function printPickupSlip(sale: Sale, company: Company, code: string) {
  printHtml(buildPickupSlipHtml(sale, company, code));
}

export function printSaleBundle(sale: Sale, company: Company, code: string) {
  printHtml(buildSaleBundleHtml(sale, company, code));
}

// Devis et bon de livraison : A4 proforma. Vente avec bordereau : bordereau client.
// Anciennes ventes (avant le bordereau) : ticket 80 mm comme avant.
export function printSaleDocument(sale: Sale, company: Company) {
  if (sale.type !== "VENTE") return printHtml(buildProformaHtml(sale, company));
  if (sale.deliveryNumber != null) return printHtml(buildDeliveryNoteHtml(sale, company));
  printHtml(buildReceiptHtml(sale, company));
}

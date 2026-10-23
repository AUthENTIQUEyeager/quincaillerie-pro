import { formatCurrency, formatDate, formatDateTime, paymentLabel } from "@/lib/utils";
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
        <td>${esc(it.product?.name ?? it.productId)}${it.product?.unit ? ` <span class="muted">(${esc(it.product.unit)})</span>` : ""}</td>
        <td class="r">${esc(it.quantity)}</td>
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
        <div class="row"><span>${esc(it.quantity)} x ${money(it.unitPrice)}${it.discount > 0 ? ` (remise ${money(it.discount)})` : ""}</span><span class="b">${money(it.total)}</span></div>
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

// Devis (et bon de livraison) : A4 proforma. Vente : ticket 80 mm.
export function printSaleDocument(sale: Sale, company: Company) {
  printHtml(sale.type === "VENTE" ? buildReceiptHtml(sale, company) : buildProformaHtml(sale, company));
}

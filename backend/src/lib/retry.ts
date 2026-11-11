// Numéros de vente / d'achat : ils sont calculés à partir du nombre d'enregistrements existants.
// Si deux ventes sont validées exactement au même instant (deux caisses), elles peuvent calculer le même numéro :
// la base en refuse une (erreur P2002, règle d'unicité). Au lieu de renvoyer une erreur au caissier, on rejoue
// l'enregistrement entier : comme il est dans une transaction, rien n'a été gardé du premier essai, et le
// nouveau comptage tient compte de la vente qui vient d'être enregistrée.
export async function retryOnUniqueClash<T>(fn: () => Promise<T>, attempts = 5): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      if (err?.code !== "P2002" || attempt >= attempts) throw err;
    }
  }
}

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PackageCheck, ScanLine, Search, Camera, CheckCircle2, X } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DELIVERY_STATUS_LABELS, formatDateTime, formatDeliveryNumber, formatQty } from "@/lib/utils";
import toast from "react-hot-toast";
import type { DeliverySlip, PendingDelivery } from "@/types";

const round3 = (n: number) => Math.round(n * 1000) / 1000;
const toNumber = (text: string) => Number(text.trim().replace(",", "."));

// La caméra est proposée seulement si le navigateur sait lire les QR codes (Chrome / Edge / Android).
const canScanWithCamera = typeof window !== "undefined" && "BarcodeDetector" in window && !!navigator.mediaDevices?.getUserMedia;

export default function DeliveriesPage() {
  const queryClient = useQueryClient();
  const codeInputRef = useRef<HTMLInputElement>(null);

  const [code, setCode] = useState("");
  const [slip, setSlip] = useState<DeliverySlip | null>(null);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [scanOpen, setScanOpen] = useState(false);

  const { data: pending } = useQuery({
    queryKey: ["pending-deliveries"],
    queryFn: async () => (await api.get<PendingDelivery[]>("/deliveries/pending")).data,
  });

  // Par défaut, on propose de tout remettre : le magasinier corrige seulement en cas de remise partielle.
  function showSlip(s: DeliverySlip) {
    setSlip(s);
    setQty(Object.fromEntries(s.items.map((it) => [it.id, it.remaining > 0 ? String(it.remaining) : ""])));
  }

  function reset() {
    setSlip(null);
    setQty({});
    setCode("");
    setTimeout(() => codeInputRef.current?.focus(), 0);
  }

  const lookup = useMutation({
    mutationFn: async (c: string) => (await api.post<DeliverySlip>("/deliveries/lookup", { code: c })).data,
    onSuccess: (s) => showSlip(s),
    onError: () => setSlip(null), // le message d'erreur est affiché par l'intercepteur axios
  });

  function submitCode(raw: string) {
    const c = raw.trim();
    if (c) lookup.mutate(c);
  }

  // Contrôle côté écran (le serveur refait les mêmes vérifications)
  function lineError(it: DeliverySlip["items"][number]): string | null {
    const text = qty[it.id] ?? "";
    if (text.trim() === "") return null; // rien à remettre sur cette ligne
    const n = toNumber(text);
    if (!Number.isFinite(n) || n < 0) return "Quantité invalide";
    if (n > it.remaining + 1e-9) return `Maximum ${formatQty(it.remaining)}`;
    if (!it.allowDecimal && !Number.isInteger(n)) return "Quantité entière uniquement";
    return null;
  }

  const lines = slip
    ? slip.items
        .map((it) => ({ saleItemId: it.id, quantity: round3(toNumber(qty[it.id] ?? "") || 0) }))
        .filter((l) => l.quantity > 0)
    : [];
  const hasError = slip ? slip.items.some((it) => lineError(it) !== null) : false;

  const deliver = useMutation({
    mutationFn: async () =>
      (await api.post<DeliverySlip>("/deliveries/deliver", { code, lines })).data,
    onSuccess: (s) => {
      toast.success(s.deliveryStatus === "SERVIE" ? "Remise enregistrée : le reçu est entièrement servi" : "Remise partielle enregistrée");
      showSlip(s);
      queryClient.invalidateQueries({ queryKey: ["pending-deliveries"] });
      queryClient.invalidateQueries({ queryKey: ["stock"] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
    },
  });

  const servi = slip?.deliveryStatus === "SERVIE";

  return (
    <div>
      <PageHeader title="Remises magasin" description="Le client présente son reçu : scannez le QR code ou saisissez le code, puis validez ce que vous remettez" />

      <Card className="mb-6 max-w-2xl">
        <CardContent className="pt-5">
          <Label htmlFor="pickup-code">Code du reçu magasinier</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <ScanLine className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="pickup-code"
                ref={codeInputRef}
                autoFocus
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                className="pl-9 font-mono uppercase tracking-wider"
                placeholder="Scannez le QR code ou tapez le code (ex. 7K3M-9X2Q-WR4T-BD8F)"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => {
                  // Les douchettes (lecteurs USB) envoient le code suivi de « Entrée »
                  if (e.key === "Enter") submitCode(code);
                }}
              />
            </div>
            <Button loading={lookup.isPending} disabled={!code.trim()} onClick={() => submitCode(code)}>
              <Search className="h-4 w-4" />
              Vérifier
            </Button>
            {canScanWithCamera && (
              <Button variant="outline" onClick={() => setScanOpen(true)}>
                <Camera className="h-4 w-4" />
                Caméra
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {slip && (
        <Card className="mb-8">
          <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
            <div>
              <CardTitle>
                Bordereau n° {formatDeliveryNumber(slip.deliveryNumber) || slip.number}
                <span className="ml-2 font-mono text-xs font-normal text-muted-foreground">{slip.number}</span>
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatDateTime(slip.createdAt)} · Client : <span className="font-medium text-foreground">{slip.customerName || "Client comptant"}</span> · Dépôt :{" "}
                <span className="font-medium text-foreground">{slip.store.name}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={servi ? "success" : "warning"}>{DELIVERY_STATUS_LABELS[slip.deliveryStatus]}</Badge>
              <Button variant="ghost" size="icon" onClick={reset} aria-label="Nouvelle recherche" title="Nouvelle recherche">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {servi && (
              <div className="flex items-center gap-2 rounded-md border border-success/30 bg-success/10 p-3 text-sm text-success">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Tous les produits de ce reçu ont été remis. Il ne peut plus être utilisé.
              </div>
            )}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Désignation</TableHead>
                  <TableHead className="text-right">Vendu</TableHead>
                  <TableHead className="text-right">Déjà remis</TableHead>
                  <TableHead className="text-right">Reste</TableHead>
                  {!servi && <TableHead className="w-40">À remettre maintenant</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {slip.items.map((it) => {
                  const err = lineError(it);
                  return (
                    <TableRow key={it.id}>
                      <TableCell>
                        <p className="font-medium">{it.productName}</p>
                        {it.sku && <p className="text-xs text-muted-foreground">{it.sku}</p>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatQty(it.quantity)} {it.unit}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{formatQty(it.deliveredQty)}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{formatQty(it.remaining)}</TableCell>
                      {!servi && (
                        <TableCell>
                          {it.remaining > 0 ? (
                            <>
                              <Input
                                type="text"
                                inputMode="decimal"
                                aria-label={`Quantité à remettre : ${it.productName}`}
                                className={"h-8 text-right tabular-nums " + (err ? "border-destructive" : "")}
                                value={qty[it.id] ?? ""}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => {
                                  if (/^\d*[.,]?\d*$/.test(e.target.value)) setQty((q) => ({ ...q, [it.id]: e.target.value }));
                                }}
                              />
                              {err && <p className="mt-0.5 text-xs font-medium text-destructive">{err}</p>}
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">Tout remis</span>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {!servi && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  Pour une remise partielle, mettez la quantité réellement remise (ou videz la case). Le client reviendra avec le même reçu pour le reste.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setQty(Object.fromEntries(slip.items.map((it) => [it.id, it.remaining > 0 ? String(it.remaining) : ""])))}
                  >
                    Tout remettre
                  </Button>
                  <Button loading={deliver.isPending} disabled={!lines.length || hasError} onClick={() => deliver.mutate()}>
                    <PackageCheck className="h-4 w-4" />
                    Valider la remise
                  </Button>
                </div>
              </div>
            )}

            {!!slip.deliveries.length && (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Remises déjà faites</p>
                <div className="divide-y divide-border rounded-md border border-border text-sm">
                  {slip.deliveries.map((d) => (
                    <div key={d.id} className="px-3 py-2">
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(d.createdAt)}
                        {d.userName ? ` · par ${d.userName}` : ""}
                      </p>
                      <p>{d.lines.map((l) => `${formatQty(l.quantity)} × ${l.productName}`).join(" · ")}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="mb-1 font-display text-base font-semibold">Ventes en attente de remise</h2>
        <p className="mb-3 text-sm text-muted-foreground">Suivi uniquement : pour remettre des produits, il faut toujours le reçu du client (QR code ou code).</p>
        {!pending?.length ? (
          <EmptyState icon={PackageCheck} title="Rien en attente" description="Tous les produits vendus ont été remis." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bordereau</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Dépôt</TableHead>
                <TableHead>Reste à remettre</TableHead>
                <TableHead>État</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{formatDeliveryNumber(p.deliveryNumber) || p.number}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDateTime(p.createdAt)}</TableCell>
                  <TableCell>{p.customerName || "Comptant"}</TableCell>
                  <TableCell className="text-muted-foreground">{p.storeName}</TableCell>
                  <TableCell className="text-sm">{p.remainingLines.map((l) => `${formatQty(l.remaining)} ${l.unit} ${l.productName}`).join(" · ")}</TableCell>
                  <TableCell>
                    <Badge variant="warning">{DELIVERY_STATUS_LABELS[p.deliveryStatus]}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <CameraScanner
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onCode={(value) => {
          setScanOpen(false);
          setCode(value);
          submitCode(value);
        }}
      />
    </div>
  );
}

// Lecture du QR code avec la caméra (API BarcodeDetector du navigateur, aucune bibliothèque externe).
function CameraScanner({ open, onClose, onCode }: { open: boolean; onClose: () => void; onCode: (value: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer: number | undefined;
    setError(null);

    (async () => {
      try {
        const Detector = (window as any).BarcodeDetector;
        const detector = new Detector({ formats: ["qr_code"] });
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        const tick = async () => {
          if (stopped) return;
          try {
            const found = await detector.detect(video);
            const value: string | undefined = found?.[0]?.rawValue;
            if (value) {
              onCode(value);
              return;
            }
          } catch {
            // image pas encore prête : on réessaie
          }
          timer = window.setTimeout(tick, 250);
        };
        tick();
      } catch {
        setError("Impossible d'utiliser la caméra. Autorisez l'accès à la caméra, ou tapez le code à la main.");
      }
    })();

    return () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // onCode est recréé à chaque rendu : on ne relance pas la caméra pour autant
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Scanner le reçu</DialogTitle>
        </DialogHeader>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <video ref={videoRef} className="aspect-square w-full rounded-md bg-black object-cover" muted playsInline />
        )}
        <p className="text-xs text-muted-foreground">Placez le QR code du reçu devant la caméra.</p>
      </DialogContent>
    </Dialog>
  );
}

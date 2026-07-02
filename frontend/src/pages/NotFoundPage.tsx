import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center px-4">
      <p className="font-display text-5xl font-bold text-primary">404</p>
      <p className="text-muted-foreground">Cette page n'existe pas.</p>
      <Link to="/">
        <Button>Retour à l'accueil</Button>
      </Link>
    </div>
  );
}

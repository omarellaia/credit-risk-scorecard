import { Suspense } from "react";
import { PortfolioView } from "@/components/PortfolioView";
export default function Page() {
  return <Suspense fallback={<p className="text-muted">Chargement…</p>}><PortfolioView /></Suspense>;
}

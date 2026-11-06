import { Suspense } from "react";
import { ScoreForm } from "@/components/ScoreForm";

export default function ScorePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Scorer un emprunteur</h1>
      <Suspense fallback={<p className="text-muted">Chargement…</p>}><ScoreForm /></Suspense>
    </div>
  );
}

import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { metricsData } from "@/lib/data";

export const metadata: Metadata = { title: "Credit Risk Scorecard", description: "IRB-style retail credit model (PD, LGD, EAD) trained on Lending Club loans." };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const s = metricsData.sets;
  return (
    <html lang="fr">
      <body className="min-h-screen antialiased">
        <header className="border-b border-line bg-panel">
          <div className="mx-auto max-w-6xl px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
            <div className="font-semibold tracking-tight">Risque de crédit <span className="text-muted font-normal">· grille PD, LGD, EAD</span></div>
            <Nav />
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 pb-10 pt-4 text-xs text-muted border-t border-line">
          Projet de cours — modèle de type IRB entraîné sur des données publiques de prêts à la consommation américains (Lending Club, prêts émis {s.train.years[0]}–{s.test.years.at(-1)}).
          Ce n'est pas un modèle bancaire ni un conseil.
        </footer>
      </body>
    </html>
  );
}

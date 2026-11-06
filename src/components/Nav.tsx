"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [["/", "Synthèse"], ["/scorecard", "Grille de score"], ["/score", "Scorer un emprunteur"], ["/portfolio", "Portefeuille"], ["/report", "Rapport"], ["/method", "Méthode"]] as const;

export function Nav() {
  const path = usePathname();
  return (
    <nav className="flex flex-wrap gap-1 text-sm">
      {LINKS.map(([href, l]) => (
        <Link key={href} href={href} className={`rounded px-2.5 py-1 ${path === href ? "bg-accent-soft text-accent font-medium" : "text-muted hover:text-ink"}`}>{l}</Link>
      ))}
    </nav>
  );
}

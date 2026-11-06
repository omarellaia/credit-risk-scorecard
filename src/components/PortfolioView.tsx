"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { calibrationData, portfolioData as P } from "@/lib/data";
import { cutoffStats } from "@/lib/portfolio";
import { musd, num, pct } from "@/lib/format";
import { CalibrationChart, LossChart } from "./Charts";
import { Card, Stat, TableWrap } from "./ui";

export function PortfolioView() {
  const sp = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const bands = P.bands;
  const minB = bands[0].lo, maxB = bands.at(-1)!.lo;
  const raw = Number(sp.get("seuil"));
  const cutoff = Number.isFinite(raw) && sp.get("seuil") !== null ? Math.min(maxB, Math.max(minB, raw)) : minB;
  const s = cutoffStats(bands, cutoff);
  const set = (v: number | null) => router.replace(v === null ? path : `${path}?seuil=${v}`, { scroll: false });
  const cal = calibrationData.bands.test.map((b) => ({ band: `${b.lo}`, predicted: b.pd_mean, observed: b.observed, n: b.n }));
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Portefeuille de test ({P.years.join(", ")})</h1>
        <p className="text-sm text-muted">{num(P.totals.n)} prêts, {musd(P.totals.amount)} prêtés · EAD attendue {musd(P.totals.ead)} · perte attendue {musd(P.totals.el)} contre {musd(P.totals.realised_loss)} réalisée · RWA {musd(P.totals.rwa)}</p>
      </div>
      <Card title="Seuil d'acceptation">
        <label className="block">
          <div className="flex justify-between text-sm"><span>Accepter les scores ≥</span><span className="num font-medium">{cutoff}</span></div>
          <input type="range" className="w-full accent-[var(--accent)]" min={minB} max={maxB} step={P.band_width} value={cutoff} onChange={(e) => set(Number(e.target.value))} />
        </label>
        <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-5">
          <Stat label="Taux d'acceptation" value={pct(s.approvalRate)} sub={`${num(s.approved)} prêts`} />
          <Stat label="Taux de défaut accepté" value={pct(s.badRate)} sub={`tous : ${pct(s.badRateAll)}`} />
          <Stat label="Perte attendue" value={musd(s.el)} sub={`${pct(s.elRate, 2)} de l'EAD`} />
          <Stat label="Perte réalisée" value={musd(s.realised)} />
          <Stat label="RWA" value={musd(s.rwa)} />
        </div>
        <button disabled={cutoff === minB} onClick={() => set(null)} className="mt-3 rounded border border-line px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-accent-soft">Réinitialiser</button>
      </Card>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <Card title="Calibrage : PD prédite contre défaut observé (test)"><CalibrationChart data={cal} /><p className="text-xs text-muted">Tranches de 20 points ; les barres doivent suivre la ligne.</p></Card>
        <Card title="Perte attendue contre perte réalisée par tranche"><LossChart data={bands.map((b) => ({ band: b.lo, el: b.el, realised: b.realised_loss }))} cutoff={cutoff > minB ? cutoff : undefined} /></Card>
      </div>
      <Card title="Par tranche de score">
        <TableWrap>
          <table className="fin">
            <thead><tr><th>Score</th><th>Prêts</th><th>PD moyenne</th><th>Défaut observé</th><th>EAD</th><th>Perte attendue</th><th>Perte réalisée</th><th>RWA</th><th>RWA / EAD</th></tr></thead>
            <tbody>
              {bands.map((b) => (
                <tr key={b.lo} className={b.lo >= cutoff ? "" : "text-muted"}>
                  <td>{b.lo}–{b.hi}</td><td className="num">{num(b.n)}</td><td className="num">{pct(b.pd_mean)}</td><td className="num">{pct(b.observed)}</td><td className="num">{musd(b.ead, 2)}</td>
                  <td className="num">{musd(b.el, 2)}</td><td className="num">{musd(b.realised_loss, 2)}</td><td className="num">{musd(b.rwa, 2)}</td><td className="num">{pct(b.rwa / b.ead, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Card>
      <Card title="LGD et EAD (prêts en défaut, années de développement)">
        <TableWrap>
          <table className="fin">
            <thead><tr><th>Montant</th><th>Défauts</th><th>LGD moyenne</th><th>EAD / montant</th></tr></thead>
            <tbody>{P.lgd_ead.bands.map((b) => <tr key={b.label}><td>{b.label}</td><td className="num">{num(b.n)}</td><td className="num">{pct(b.lgd)}</td><td className="num">{pct(b.ead_ratio)}</td></tr>)}
              <tr className="total"><td>Ensemble</td><td className="num">{num(P.lgd_ead.n_defaults)}</td><td className="num">{pct(P.lgd_ead.lgd_mean)}</td><td className="num">{pct(P.lgd_ead.ead_ratio_mean)}</td></tr></tbody>
          </table>
        </TableWrap>
      </Card>
    </div>
  );
}

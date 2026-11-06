import { Card, Stat, TableWrap } from "@/components/ui";
import { VintageChart } from "@/components/Charts";
import { calibrationData, card, metricsData as M, portfolioData as P, summaryData as S } from "@/lib/data";
import { dec, num, pct } from "@/lib/format";

const SETS = [["train", "Entraînement"], ["validation", "Validation"], ["test", "Test (hors période)"]] as const;
const psiRead = (x: number) => (x < 0.1 ? "stable" : x < 0.25 ? "dérive modérée" : "dérive forte");

export default function Summary() {
  const t = M.sets.test;
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Grille de score crédit retail — validation hors période</h1>
        <p className="text-sm text-muted">Prêts Lending Club à {S.term_months} mois · entraînement {S.train_years[0]}–{S.train_years.at(-1)}, validation {S.valid_years.join(", ")}, test {S.test_years.join(", ")} · {card.variables.length} variables</p>
      </div>
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card><Stat label="Gini (test)" value={dec(t.gini)} sub={`entraînement ${dec(M.sets.train.gini)}`} /></Card>
        <Card><Stat label="KS (test)" value={dec(t.ks)} sub={`AUC ${dec(t.auc)}`} /></Card>
        <Card><Stat label="PSI entraînement → test" value={dec(M.stability.test.psi, 4)} sub={psiRead(M.stability.test.psi)} /></Card>
        <Card><Stat label="Perte attendue (test)" value={pct(P.totals.el / P.totals.ead, 2)} sub={`de l'EAD · réalisée ${pct(P.totals.realised_loss / P.totals.ead, 2)}`} /></Card>
      </div>
      <Card title="Entraînement, validation et test côte à côte">
        <TableWrap>
          <table className="fin">
            <thead><tr><th>Échantillon</th><th>Années</th><th>Prêts</th><th>Défauts</th><th>Taux de défaut</th><th>PD moyenne</th><th>AUC</th><th>Gini</th><th>KS</th><th>PSI vs entraînement</th></tr></thead>
            <tbody>
              {SETS.map(([k, l]) => {
                const s = M.sets[k];
                return (
                  <tr key={k}><td>{l}</td><td>{s.years[0]}{s.years.length > 1 ? `–${s.years.at(-1)}` : ""}</td><td className="num">{num(s.n)}</td><td className="num">{num(s.bads)}</td>
                    <td className="num">{pct(s.default_rate)}</td><td className="num">{pct(s.pd_mean)}</td><td className="num">{dec(s.auc)}</td><td className="num font-medium">{dec(s.gini)}</td><td className="num">{dec(s.ks)}</td>
                    <td className="num">{k === "train" ? "—" : dec(M.stability[k].psi, 4)}</td></tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
        <p className="mt-2 text-xs text-muted">PD calibrée sur le taux de défaut de long terme des années de développement {calibrationData.development_years[0]}–{calibrationData.development_years.at(-1)} ({pct(calibrationData.long_run_default_rate, 2)}). Gini = 2 × AUC − 1.</p>
      </Card>
      <Card title="Performance par millésime"><VintageChart data={M.by_vintage} /></Card>
    </div>
  );
}

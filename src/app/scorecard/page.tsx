import { Card, TableWrap } from "@/components/ui";
import { card, label } from "@/lib/data";
import { dec, num, pct } from "@/lib/format";

export default function ScorecardPage() {
  const s = card.scaling;
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Grille de score</h1>
        <p className="text-sm text-muted">{s.base_score} points à une cote de {s.base_odds}:1, +{s.pdo} points doublent la cote · points de base {num(card.base_points, 2)} · Factor {dec(s.factor, 4)}, Offset {dec(s.offset, 4)}</p>
      </div>
      <Card title="Variables classées par information value">
        <TableWrap>
          <table className="fin">
            <thead><tr><th>Variable</th><th>IV</th><th>Décision</th></tr></thead>
            <tbody>
              {card.all_variables.map((v) => {
                const kept = card.variables.find((x) => x.name === v.name);
                const ex = card.excluded.find((x) => x.variable === v.name);
                return <tr key={v.name}><td>{label(v.name)}</td><td className="num">{dec(v.iv, 4)}</td>
                  <td className={kept ? "text-good" : "text-muted"} style={{ textAlign: "left" }}>{kept ? `retenue (β = ${dec(kept.coef, 3)})` : ex?.reason ?? ""}</td></tr>;
              })}
            </tbody>
          </table>
        </TableWrap>
      </Card>
      {card.variables.map((v) => (
        <Card key={v.name} title={label(v.name)} aside={<span className="text-xs text-muted">IV {dec(v.iv, 4)} · β {dec(v.coef, 3)} · p {v.pvalue < 1e-4 ? "< 0,0001" : dec(v.pvalue, 4)}</span>}>
          <TableWrap>
            <table className="fin">
              <thead><tr><th>Classe</th><th>Prêts</th><th>Part</th><th>Taux de défaut</th><th>WoE</th><th>Points</th></tr></thead>
              <tbody>
                {v.bins.map((b, i) => {
                  const tot = v.bins.reduce((a, x) => a + x.n, 0);
                  return <tr key={i}><td style={{ whiteSpace: "normal" }}>{b.label}</td><td className="num">{num(b.n)}</td><td className="num">{pct(b.n / tot)}</td><td className="num">{pct(b.bad_rate)}</td>
                    <td className="num">{dec(b.woe, 3)}</td><td className={`num font-medium ${b.points >= 0 ? "text-good" : "text-bad"}`}>{num(b.points, 1)}</td></tr>;
                })}
              </tbody>
            </table>
          </TableWrap>
        </Card>
      ))}
    </div>
  );
}

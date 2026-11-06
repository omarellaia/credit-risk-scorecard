"use client";
import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { card, label, portfolioData } from "@/lib/data";
import { irbOtherRetail, rangeWarnings, scoreBorrower } from "@/lib/scoring";
import { dec, num, pct, usd } from "@/lib/format";
import { PointsChart } from "./Charts";
import { Card, Stat, TableWrap } from "./ui";

const AMOUNT = "montant";

/** Form values live in the URL so a result can be shared by link. Defaults: training medians / most common category. */
export function ScoreForm() {
  const sp = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const defaults = useMemo(() => {
    const d: Record<string, string> = {};
    for (const v of card.variables) {
      const r = card.ranges[v.name];
      d[v.name] = v.type === "numeric" ? String(r.median ?? "") : String([...v.bins].sort((a, b) => b.n - a.n)[0].categories!.find((c) => c !== "__other__"));
    }
    d[AMOUNT] = "10000";
    return d;
  }, []);
  const val = (k: string) => sp.get(k) ?? defaults[k];
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(sp.toString());
    next.set(k, v);
    router.replace(`${path}?${next.toString()}`, { scroll: false });
  };
  const inputs = Object.fromEntries(card.variables.map((v) => {
    const x = val(v.name);
    return [v.name, v.type === "numeric" ? (x === "" ? null : Number(x)) : x];
  }));
  const res = scoreBorrower(card, inputs);
  const warn = rangeWarnings(card, inputs);
  const amount = Math.max(0, Number(val(AMOUNT)) || 0);
  const lb = portfolioData.lgd_ead.bands.find((b) => amount >= b.lo && (b.hi === null || amount < b.hi)) ?? portfolioData.lgd_ead.bands[0];
  const ead = amount * lb.ead_ratio;
  const { k } = irbOtherRetail(res.pd, lb.lgd);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
      <Card title="Emprunteur">
        <div className="space-y-3">
          {card.variables.map((v) => {
            const r = card.ranges[v.name];
            return (
              <label key={v.name} className="block text-sm">
                <span className="text-muted">{label(v.name)}</span>
                {v.type === "numeric" ? (
                  <input type="number" inputMode="decimal" value={val(v.name)} onChange={(e) => set(v.name, e.target.value)}
                    className={`mt-1 w-full rounded border bg-panel px-2 py-1.5 num ${warn.includes(v.name) ? "border-warn" : "border-line"}`} placeholder="vide = manquant" />
                ) : (
                  <select value={val(v.name)} onChange={(e) => set(v.name, e.target.value)} className="mt-1 w-full rounded border border-line bg-panel px-2 py-1.5">
                    {r.categories!.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                )}
                {v.type === "numeric" && <span className="text-xs text-muted">entraînement : 1 % = {num(r.p01, 1)}, médiane {num(r.median, 1)}, 99 % = {num(r.p99, 1)}</span>}
              </label>
            );
          })}
          <label className="block text-sm border-t border-line pt-3">
            <span className="text-muted">Montant du prêt ($) — pour la perte attendue, pas dans le score</span>
            <input type="number" value={val(AMOUNT)} onChange={(e) => set(AMOUNT, e.target.value)} className="mt-1 w-full rounded border border-line bg-panel px-2 py-1.5 num" />
          </label>
          <button onClick={() => router.replace(path, { scroll: false })} className="rounded border border-line px-3 py-1.5 text-sm hover:bg-accent-soft">Réinitialiser</button>
        </div>
      </Card>
      <div className="space-y-4 min-w-0">
        <Card>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Score" value={num(res.score, 0)} sub={`base ${num(card.base_points, 1)} pts`} />
            <Stat label="PD à 12 mois*" value={pct(res.pd, 2)} sub={`cote ${dec(res.odds, 1)}:1`} />
            <Stat label="Perte attendue" value={usd(res.pd * lb.lgd * ead)} sub={`LGD ${pct(lb.lgd, 0)} · EAD ${usd(ead)}`} />
            <Stat label="RWA (IRB retail)" value={usd(k * 12.5 * ead)} sub={`K = ${pct(k, 2)} de l'EAD`} />
          </div>
          <p className="mt-3 text-xs text-muted">* PD sur la durée du prêt (36 mois), calibrée sur le taux de défaut de long terme, plancher {pct(card.pd_floor, 2)}. LGD et ratio EAD/montant : moyennes observées pour la tranche « {lb.label} ».</p>
          {warn.length > 0 && <p className="mt-2 rounded bg-warn-soft px-3 py-2 text-sm text-warn">Hors de la plage d'entraînement (1er–99e centile) : {warn.map(label).join(", ")}. Le score reste calculé, mais le modèle n'a presque jamais vu ce profil.</p>}
        </Card>
        <Card title="Points apportés par chaque variable">
          <PointsChart data={res.contributions.map((c) => ({ name: label(c.name), points: c.points }))} />
          <TableWrap><table className="fin mt-2">
            <thead><tr><th>Variable</th><th>Classe</th><th>Points</th></tr></thead>
            <tbody>
              {res.contributions.map((c) => <tr key={c.name}><td>{label(c.name)}</td><td style={{ whiteSpace: "normal" }}>{c.bin.label}</td><td className="num">{num(c.points, 2)}</td></tr>)}
              <tr className="total"><td>Score</td><td /><td className="num">{num(res.score, 2)}</td></tr>
            </tbody>
          </table></TableWrap>
        </Card>
      </div>
    </div>
  );
}

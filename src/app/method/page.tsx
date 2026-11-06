import { Card, TableWrap } from "@/components/ui";
import { card, summaryData as S, portfolioData as P } from "@/lib/data";
import { num, pct } from "@/lib/format";

export default function Method() {
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Données, définitions, hypothèses et limites</h1>
      <Card title="Données">
        <p className="text-sm">Lending Club, prêts acceptés 2007–2018 (Kaggle, jeu « wordsforthewise/lending-club »). Prêts à {S.term_months} mois arrivés à échéance fin 2018 ; entraînement {S.train_years[0]}–{S.train_years.at(-1)}, validation {S.valid_years.join(", ")}, test {S.test_years.join(", ")} (découpage par date d'émission, jamais aléatoire).</p>
        <TableWrap><table className="fin mt-2"><thead><tr><th>Étape</th><th>Prêts</th></tr></thead><tbody>{S.steps.map((s) => <tr key={s.step}><td>{s.step}</td><td className="num">{num(s.rows)}</td></tr>)}</tbody></table></TableWrap>
      </Card>
      <Card title="Définitions">
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li><b>Défaut</b> : {S.default_statuses.join(", ")} ; <b>non-défaut</b> : {S.good_statuses.join(", ")}. Prêts en cours ou en retard exclus.</li>
          <li><b>PD</b> : probabilité de défaut sur la durée du prêt, calibrée sur le taux de long terme, plancher {pct(card.pd_floor, 2)}.</li>
          <li><b>EAD</b> : montant financé − principal remboursé au défaut (moyenne {pct(P.lgd_ead.ead_ratio_mean)} du montant).</li>
          <li><b>LGD</b> : 1 − (récupérations − frais de recouvrement) / EAD (moyenne {pct(P.lgd_ead.lgd_mean)}).</li>
          <li><b>Score</b> : {card.scaling.base_score} points à {card.scaling.base_odds}:1, +{card.scaling.pdo} points doublent la cote.</li>
        </ul>
      </Card>
      <Card title="Variables exclues (règles anti-fuite)">
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li><b>Mesure de risque de Lending Club</b> : {S.excluded_lc_risk.join(", ")}.</li>
          <li><b>Connues après l'octroi</b> : {S.excluded_post_origination.join(", ")}.</li>
          <li><b>Historique partiel (à partir de 2012)</b> : {S.excluded_partial_history.join(", ")}.</li>
        </ul>
      </Card>
      <Card title="Hypothèses et limites">
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>Prêts acceptés uniquement : pas d'inférence des refusés.</li>
          <li>Prêts à la consommation américains, aucune variable macroéconomique, une seule période économique.</li>
          <li>LGD et EAD : moyennes par tranche de montant, sans actualisation ni coûts non enregistrés ; conversion de 100 %.</li>
          <li>Capital : formule IRB « autre clientèle de détail » appliquée à titre d'illustration ; modèle de type IRB, non conforme.</li>
          <li>Modèle entraîné sur des prêts américains : projet de cours, pas un modèle bancaire.</li>
        </ul>
      </Card>
    </div>
  );
}

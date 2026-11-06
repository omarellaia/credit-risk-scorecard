# Modèle de risque de crédit retail — rapport de validation

Grille de score PD, estimations de LGD et d'EAD, perte attendue et capital IRB, sur les prêts Lending Club à 36 mois. Projet de cours, modèle « de type IRB » entraîné sur des données publiques : ce n'est pas un modèle bancaire conforme. Tous les chiffres de ce rapport sont lus dans les fichiers exportés par le pipeline.

## Synthèse

- **Ce qui a été construit** : une grille de {{n_vars}} variables par poids de l'évidence (WoE) et régression logistique, calibrée sur le taux de défaut de long terme ({{long_run}}), prolongée par une LGD, une EAD, la perte attendue et le capital de Bâle pour la clientèle de détail.
- **Discrimination hors période** : Gini {{test_gini}} et KS {{test_ks}} sur le millésime {{test_years}}, jamais utilisé pour un choix, contre un Gini de {{train_gini}} à l'entraînement. La perte est faible ({{gini_drop}}) et la population est {{psi_reading}} (PSI {{psi_test}}).
- **Perte attendue** : {{el_rate}} de l'exposition sur le portefeuille de test, contre {{realised_rate}} réalisée.
- **Limite principale** : le modèle ne voit que des prêts acceptés (pas d'inférence des refusés), aux États-Unis, sur une seule période économique, et il sous-estime le défaut du millésime de test ({{pred_vs_obs_test}}).

## Données et définition du défaut

Fichier Lending Club des prêts acceptés, émis de 2007 à 2018 ({{raw_rows}} lignes). **Défaut** = statut « Charged Off » ou « Default » ; **non-défaut** = « Fully Paid ». Les prêts encore en cours ou en retard sont retirés, car leur issue n'est pas connue. Seuls les prêts dont l'échéance est atteinte fin 2018 sont gardés, sinon les défauts récents seraient sous-comptés.

{{table:steps}}

Les prêts à 60 mois émis après 2013 n'ont pas atteint leur échéance : garder les deux durées donnerait un entraînement (36 + 60 mois) différent du test (36 mois seulement). Le modèle porte donc sur les **{{n36}} prêts à 36 mois** : entraînement {{train_years}}, validation {{valid_years}}, test {{test_years}}.

{{table:years}}

Variables exclues : la note et le taux d'intérêt de Lending Club (leur propre mesure du risque : les garder ferait du modèle une copie du leur), toutes les colonnes remplies après l'octroi (paiements, encours, récupérations, dernier FICO), et les variables de bureau publiées seulement à partir de 2012. La liste complète est dans le README.

## Méthode

1. **Découpage** : chaque variable numérique est coupée en 20 quantiles, puis les classes voisines sont fusionnées jusqu'à ce que le taux de défaut soit monotone et que chaque classe pèse au moins 5 % des prêts. Les catégories sont classées par taux de défaut et regroupées de la même façon. Les valeurs manquantes ont leur propre classe ; une variable sans manquant à l'entraînement leur donne la classe la plus risquée.
2. **WoE et IV** : WoE = ln(%bons / %mauvais) par classe, IV = Σ (%bons − %mauvais) × WoE, avec 0,5 ajouté aux effectifs pour éviter les classes vides.
3. **Sélection** : IV ≥ 0,02, puis une variable de chaque paire corrélée à plus de 0,7 est retirée (on garde la plus forte). {{n_candidates}} variables candidates, {{n_vars}} retenues.
4. **Régression** : logistique sur les WoE (statsmodels). Comme une WoE élevée signifie moins de risque, chaque coefficient doit être négatif ; une variable de mauvais signe ou non significative (p > 0,05) est retirée et le modèle réestimé.
5. **Mise à l'échelle** : Score = Offset + Factor × ln(cote), avec Factor = PDO / ln 2 = {{factor}} et Offset = {{offset}}, soit {{base_score}} points à une cote de {{base_odds}}:1 et +{{pdo}} points pour doubler la cote. Points de base : {{base_points}}.
6. **Calibrage** : la constante est décalée de {{shift}} pour que la PD moyenne de l'entraînement égale le taux de défaut de long terme des années {{dev_years}} ({{long_run}}). Plancher de PD : {{pd_floor}}.

## Grille de score

{{table:iv}}

{{table:signs}}

Chaque signe se lit économiquement : un FICO et un revenu plus élevés réduisent le risque ; l'endettement, l'utilisation du crédit renouvelable et les demandes de crédit récentes l'augmentent ; les propriétaires avec prêt immobilier sont moins risqués que les locataires ; les prêts pour carte de crédit ou achat important le sont moins que ceux pour une petite entreprise ou un motif médical.

{{table:points}}

## Validation

{{table:metrics}}

Le Gini baisse de {{gini_drop}} entre l'entraînement et le test : une perte faible, qui ne signale pas de surapprentissage. Le PSI de {{psi_test}} indique une population stable. Ce niveau de Gini est modeste pour une grille de crédit : sans la note de Lending Club, le modèle ne voit que les variables de la demande.

**Calibrage sur le test.** La PD moyenne ({{test_pd}}) est inférieure au défaut observé ({{test_dr}}), un écart de {{calib_gap}} : le millésime {{test_years}} est plus risqué que la moyenne de long terme. C'est l'effet attendu d'un calibrage « à travers le cycle » ; une banque ajouterait une marge de prudence ou recalibrerait.

{{table:calibration}}

{{table:vintage}}

## LGD, EAD et perte attendue

Sur les {{n_defaults_dev}} prêts en défaut des années de développement : **EAD** = montant financé − principal remboursé, soit en moyenne {{ead_ratio}} du montant ; **LGD** = 1 − (récupérations − frais de recouvrement) / EAD, en moyenne {{lgd}}, moyennée par tranche de montant. Simplifications : pas d'actualisation des récupérations, pas d'autre coût que ceux enregistrés, conversion de 100 % (pas de lignes non tirées).

{{table:lgd}}

Perte attendue = PD × LGD × EAD. Sur le test : EAD attendue {{ead}}, perte attendue {{el}} contre {{realised}} réalisée ({{el_vs_realised}}), en ligne avec la sous-estimation de la PD sur ce millésime.

{{table:loss}}

## Capital

Formule IRB pour l'« autre clientèle de détail » : corrélation R = 0,03 × w + 0,16 × (1 − w) avec w = (1 − e^(−35 PD)) / (1 − e^(−35)), K = LGD × [Φ((Φ⁻¹(PD) + √R Φ⁻¹(0,999)) / √(1 − R)) − PD], RWA = K × 12,5 × EAD, sans ajustement de maturité.

Sur le test, les RWA atteignent {{rwa}}, soit une densité de {{rwa_density}} de l'EAD ; à 8 %, {{capital_8}} de fonds propres. **Perte attendue et perte inattendue** : la perte attendue est un coût moyen, couvert par le prix (le taux d'intérêt) et les provisions ; la perte inattendue, l'écart dans une mauvaise année (au seuil de 99,9 %), est couverte par les fonds propres.

Exemple d'usage : avec un seuil d'acceptation à 530 points, {{cut530_approval}} des demandes seraient acceptées et le taux de défaut passerait de {{all_bad}} à {{cut530_bad}}.

## Limites

- **Prêts acceptés seulement** : les demandeurs refusés par Lending Club manquent. En banque : inférence des refusés (augmentation, parcelling).
- **Prêts à la consommation américains**, sans variable macroéconomique, sur une seule période (2007–2015). En banque : ajout de variables macro et tests de résistance.
- **Calibrage** : la PD sous-estime le défaut du millésime de test. En banque : suivi trimestriel du PSI et du calibrage, recalibrage si le PSI dérive ou si l'écart persiste.
- **LGD et EAD** simplifiées (moyennes par tranche, sans actualisation).

## Annexe

Le dictionnaire des données, les tables complètes et la carte du code sont dans le README et sur la page Méthode. Vérification indépendante : `notebooks/independent_check.ipynb`.

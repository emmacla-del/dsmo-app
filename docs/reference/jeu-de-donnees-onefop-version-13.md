# Jeu de données ONEFOP — version 13

Note à l'intention des analystes qui exploitent les exports SPSS (`.sav`),
CSV (`.csv` + syntaxe `.sps`) et Excel du questionnaire ONEFOP.
Rédigée le 18 octobre 2026 ; elle fait suite à
[la note de la version 12](jeu-de-donnees-onefop-version-12.md).

Elle ne concerne que la partition **Projet / Programme**, et dans celle-ci le
seul tableau 4.6. Les autres types d'employeur (entreprise, coopérative, CTD,
ONG, administration, centre de formation professionnelle) sont inchangés.

## Ce qui change

Le tableau 4.6 — « Combien de personnes vulnérables avez-vous recruté selon
le statut et la nature de la vulnérabilité » — collecte désormais la **nature
de la vulnérabilité**, comme le tableau S22Q05 des cinq autres
questionnaires. Il collectait la catégorie socioprofessionnelle.

| | Lignes du tableau 4.6 |
|---|---|
| Jusqu'à la v12 | Cadres · Agents de maîtrise · Agents d'exécution |
| À partir de la v13 | Déplacés internes · Réfugiés · Orphelins |

Les colonnes ne changent pas : Permanent et Temporaire, chacun en Homme /
Femme / Total, plus la colonne Total.

### Pourquoi

Le questionnaire papier Projet / Programme se contredit à cette question. Son
intitulé de ligne annonce « Nature de vulnérabilité / Nature of
vulnerability » et sa question française demande bien « selon le statut et la
nature de la vulnérabilité » — mais les trois lignes imprimées en dessous
sont les catégories socioprofessionnelles de la question 4.5, et sa question
anglaise est celle de 4.5 recopiée. Le questionnaire Entreprise tranche : à
la même question (S22Q05), même libellé français, il imprime bien Déplacés
internes / Réfugiés / Orphelins — ce que la plateforme collecte depuis
toujours pour l'entreprise, la coopérative, la CTD et l'ONG.

Collectée par CSP, cette variable n'était comparable avec aucun des autres
questionnaires, et la nature de la vulnérabilité — c'est-à-dire la variable
elle-même — n'était jamais recueillie pour les projets et programmes.

Décision du propriétaire du produit, 18 octobre 2026 (CLAUDE.md §21).

### Variables

18 variables sont **retirées** : leurs noms restent réservés et ne seront
jamais réattribués.

| Retirées (v12 et avant) | Remplacées par (v13) |
|---|---|
| `pp_s4q06_cadres_<statut>_<sexe>` | `pp_s4q06_deplaces_internes_<statut>_<sexe>` |
| `pp_s4q06_foremen_<statut>_<sexe>` | `pp_s4q06_refugies_<statut>_<sexe>` |
| `pp_s4q06_workers_<statut>_<sexe>` | `pp_s4q06_orphelins_<statut>_<sexe>` |

où `<statut>` vaut `permanent`, `temporary` ou `total`, et `<sexe>` `male`,
`female` ou `total`. La ligne de total `pp_s4q06_total_*` reste, complétée de
ses cellules de statut `total` comme celles de S22Q05.

## Ce qui ne change pas

Le libellé de la question 4.6, qui demandait déjà la nature de la
vulnérabilité ; le tableau 4.5 (handicap), qui reste par catégorie
socioprofessionnelle ; les noms, largeurs, valeurs et l'ordre de toutes les
autres variables ; le code `-98` des variables non applicables ; les fichiers
restreints (liste nominative 8.8 et coordonnées VT) et leurs règles d'accès.

## Effet sur vos scripts

- Une syntaxe qui lit `pp_s4q06_cadres_*`, `pp_s4q06_foremen_*` ou
  `pp_s4q06_workers_*` ne trouvera plus ces colonnes : remplacez-les par les
  trois natures.
- **Un dossier transmis avant la v13 garde ses réponses sous les noms
  retirés** : ses colonnes v13 sont donc vides. Les deux séries ne sont pas
  la même variable — une réponse « cadres » ne dit rien de la nature de la
  vulnérabilité — et aucune conversion n'a été faite. Ne fusionnez pas les
  deux séries dans une même colonne ; vérifiez `schemaVersion` avant de
  fusionner deux exports.
- Pour comparer les projets et programmes aux autres employeurs sur cette
  variable, les lignes sont désormais les mêmes qu'en S22Q05, à la différence
  des préfixes (`pp_s4q06_` contre `s22q05_ent_` / `s22q05_oth_`).

La version d'un fichier se lit dans la variable `schemaVersion`, dans
l'en-tête de la syntaxe `.sps` (« Version du schéma du jeu de données : 13. »)
et dans l'en-tête HTTP `X-Dataset-Schema-Version`.

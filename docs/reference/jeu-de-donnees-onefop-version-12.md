# Jeu de données ONEFOP — version 12

Note à l'intention des analystes qui exploitent les exports SPSS (`.sav`),
CSV (`.csv` + syntaxe `.sps`) et Excel du questionnaire ONEFOP.
Rédigée le 17 octobre 2026 ; elle fait suite à
[la note de la version 11](jeu-de-donnees-onefop-version-11.md).

Elle ne concerne que la partition **Projet / Programme**. Les autres types
d'employeur (entreprise, coopérative, CTD, ONG, administration, centre de
formation professionnelle) sont inchangés.

## Ce qui change

Deux corrections : des réponses codées qui ne portaient aucune étiquette
deviennent lisibles.

### 1. `PP_S1Q01`, `PP_S1Q13` et `PP_S1Q14` contiennent désormais le libellé

| Variable | Question | Avant (v11) | À partir de la v12 |
|---|---|---|---|
| `PP_S1Q01` | Nature de la structure | `1` | `Projet/ Project` |
| `PP_S1Q13` | Situation du projet / programme | `2` | `Actif/ Active` |
| `PP_S1Q14` | Motif d'arrêt | `1` | `Arrivé à terme/ Expired` |

Ces trois variables étaient enregistrées sous forme de code, alors que la
syntaxe `.sps` déclare leurs `VALUE LABELS` sur les libellés d'option
(`'Projet/ Project' "Projet"`). SPSS n'appliquait donc aucune étiquette et
l'analyste lisait un `1` nu — tandis que `PP_S1Q05` (milieu) et `PP_S1Q08`
(secteur), dans la même section, contenaient bien le libellé. Deux codages
coexistaient dans une même section du même questionnaire.

Les trois variables suivent maintenant la règle de tous les autres types
d'employeur : la valeur enregistrée est le libellé d'option, et le
dictionnaire s'y applique. **Le dictionnaire n'a pas changé** : ce sont les
données qui rejoignent les étiquettes déjà publiées.

Les déclarations déjà enregistrées ont été converties, de sorte qu'un export
rejouant une période ancienne donne le même résultat qu'un export d'
aujourd'hui. Aucune déclaration n'a été modifiée autrement : seul le codage
de ces trois réponses change, pas la réponse elle-même.

La colonne « Motif d'arrêt » de l'export Excel affiche de la même façon le
libellé et non plus un chiffre.

### 2. Le tableau des prestations (section 2) a enfin son dictionnaire

Les colonnes codées du tableau des prestations reçoivent les étiquettes de
valeurs qu'elles n'avaient jamais eues :

| Colonnes | Codes |
|---|---|
| `PP_S2_ACT_01_TARGET` … `PP_S2_ACT_13_TARGET` | 1 Jeune non diplômé · 2 Jeune diplômé · 3 Femme · 4 Monde rural · 5 Population urbaine · 6 Autre |
| `PP_S2_ACT_01_SUPPORT` … `PP_S2_ACT_13_SUPPORT` | 1 Gratuit · 2 Tarifé · 3 Aide financière remboursable · 4 Aide financière non remboursable · 5 Autre |
| `PP_S2_ACT_01_SCOPE` … `PP_S2_ACT_13_SCOPE` | 1 National · 2 Régional · 3 Local · 4 Autre |

Ici, **les valeurs ne changent pas** : ces colonnes contiennent toujours le
code (`"1"`..`"6"`, type A254). Jusqu'à la v11, la syntaxe ne déclarait
aucune `VALUE LABELS` pour elles, et un `2` n'était interprétable qu'en
ayant le questionnaire sous les yeux.

Les trois autres colonnes de chaque prestation — `_DESC`, `_DATE`, `_DUR` —
sont du texte libre et ne prennent pas d'étiquettes.

## Ce qui ne change pas

Les noms, les largeurs et l'ordre des variables ; toutes les autres valeurs ;
le code `-98` des variables non applicables ; les fichiers restreints (liste
nominative 8.8 et coordonnées VT) et leurs règles d'accès.

## Effet sur vos scripts

- Une syntaxe qui teste `PP_S1Q01`, `PP_S1Q13` ou `PP_S1Q14` sur `'1'`,
  `'2'`… doit tester le libellé d'option (ou s'appuyer sur l'étiquette de
  valeur, qui s'applique désormais). Les bases exportées avant la v12 gardent
  l'ancien codage : vérifiez `schemaVersion` avant de fusionner deux exports.
- Une syntaxe qui recode `PP_S2_ACT_*_TARGET`, `_SUPPORT` ou `_SCOPE` à
  partir des codes continue de fonctionner sans modification.

La version d'un fichier se lit dans la variable `schemaVersion`, dans
l'en-tête de la syntaxe `.sps` (« Version du schéma du jeu de données : 12. »)
et dans l'en-tête HTTP `X-Dataset-Schema-Version`.

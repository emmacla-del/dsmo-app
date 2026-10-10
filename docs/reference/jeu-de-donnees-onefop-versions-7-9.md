# Jeu de données ONEFOP — versions 7 à 9

Note à l'intention des analystes qui exploitent les exports SPSS (`.sav`),
CSV (`.csv` + syntaxe `.sps`) et Excel du questionnaire ONEFOP.
Rédigée le 10 octobre 2026 ; elle fait suite à la version 6 (textes libres
non tronqués, A2000).

## Reconnaître la version d'un fichier

La version figure à trois endroits :

- la variable système `schemaVersion` de chaque ligne ;
- l'en-tête de la syntaxe `.sps` : « Version du schéma du jeu de données : 9. » ;
- l'en-tête HTTP `X-Dataset-Schema-Version` de l'export.

Une syntaxe écrite pour une version antérieure reste valable : aucune
variable existante n'a été renommée, supprimée ni déplacée entre les
versions 6 et 9. Les nouvelles variables s'insèrent après celle de leur
question. Si une syntaxe lit le CSV **par position** (`GET DATA` à colonnes
fixes), régénérez-la : utilisez toujours le `.sps` fourni avec le fichier.

## Synthèse

| Version | Changement | Effet sur vos scripts |
|---|---|---|
| 7 | 7.1.3 : canaux de communication codés, « précisez » par partie prenante, une variable 0/1 par partie prenante × canal (45) | Nouvelles variables ; `VT7_7`…`VT7_11` portent des étiquettes de valeur |
| 8 | Corrections : répondant VT1_15, totaux calculés, largeur de `establishmentId`, dates de période | Valeurs auparavant vides ou décalées désormais correctes |
| 9 | Toutes les autres questions à choix multiples ont leurs variables 0/1 (53) | Nouvelles variables ; plus besoin de découper les listes |

Seul le questionnaire des centres de formation professionnelle (partition
TVET) est concerné : les questionnaires employeurs n'ont pas de question à
choix multiples.

## Règle de codage des variables 0/1 (versions 7 et 9)

Chaque option d'une question à choix multiples a sa variable numérique,
placée juste après la variable de la question (qui garde la liste des
réponses séparées par des virgules) :

| Valeur | Sens |
|---|---|
| `1` | option cochée |
| `0` | question répondue, option non cochée |
| vide (manquant système) | question non affichée ou non répondue — **ce n'est pas un « Non »** |
| `-98` | non applicable : l'établissement n'est pas un centre de formation |

Étiquettes de valeur : `0` « Non », `1` « Oui ». `-98` est déclaré
manquant utilisateur, comme pour toutes les variables numériques depuis la
version 5. `-99` (« Non renseigné ») reste réservé et n'est pas encore
produit.

### Noms des variables

- Questions dont les options sont des codes courts (7.1.3) : `<question>_<code>`,
  par exemple `VT7_7_06` = « Élèves — WhatsApp ».
- Autres questions : `<question>_<nn>`, numéro de l'option dans l'ordre du
  questionnaire, par exemple `VT2_2_01` = « … — Stage académique ».
  Les options ne sont jamais renumérotées : une option nouvelle prend le
  numéro suivant.

Le libellé de chaque variable reprend la question et l'option
(« … — Stage académique »). Le dictionnaire complet est dans le `.sps`.

Questions concernées en version 9 : VT2_2, VT2_18, VT2_25, VT2_27,
VT2_38, VT2_42, VT3_2, VT6_2, VT6_5, VT6_8, VT7_20_DOMAINS, VT9_2.

## Version 7 — 7.1.3, canaux de communication

La question 7.1.3 (« parties prenantes informées » : élèves, personnel
enseignant, personnel non enseignant, parents/tuteurs, conseil
d'établissement) était saisie en texte libre. Elle est désormais codée :

| Code | Canal |
|---|---|
| 01 | Lettre / correspondance officielle |
| 02 | Note de service / circulaire administrative |
| 03 | Réunion / séance d'information |
| 04 | Communication verbale / bouche-à-oreille |
| 05 | Appel téléphonique / SMS |
| 06 | WhatsApp |
| 07 | Courrier électronique (e-mail) |
| 08 | Affichage au tableau d'affichage |
| 96 | Autre (préciser) |

- `VT7_7` (élèves), `VT7_8` (personnel enseignant), `VT7_9` (personnel non
  enseignant), `VT7_10` (parents/tuteurs), `VT7_11` (conseil
  d'établissement) : liste des codes cochés, par exemple `03,06`.
- `VT7_7_OTHER` … `VT7_11_OTHER` : texte du « précisez » lorsque 96 est
  coché, vide sinon.
- `VT7_7_01` … `VT7_11_96` : les 45 variables 0/1.

**Liste provisoire.** Cette liste a été adoptée le 9 octobre 2026 en
attendant la liste écrite du MINEFOP (les colonnes du formulaire papier
n'ont pas de titre). Si elle change, des codes seront ajoutés ; aucun code
existant ne changera de sens.

Les déclarations envoyées avant le codage contiennent encore du texte libre
dans `VT7_7`…`VT7_11` ; leurs variables 0/1 sont vides.

## Version 8 — corrections

Ces corrections s'appliquent à **tout nouvel export**, y compris pour les
déclarations déjà reçues : il suffit de réexporter.

1. **Répondant (VT1_15).** Nom, fonction, téléphones et e-mail du
   répondant (`VT1_15_NAME`, `VT1_15_FUNCTION`, `VT1_15_TEL1`,
   `VT1_15_TEL2`, `VT1_15_EMAIL`) étaient toujours vides alors qu'ils sont
   enregistrés. Ils sont désormais exportés.
2. **Totaux calculés.** Les colonnes « Total (calculé) » des tableaux saisis
   ligne par ligne (4.2, 4.8, 4.9, 4.10, 4.11, 6.3, 8.1, 8.2) étaient vides.
   Elles valent la somme de leur groupe (total = hommes + femmes ; total des
   entrants = entrants hommes + femmes, etc.). Un total reste vide si l'une de
   ses cellules l'est : une cellule vide n'est pas comptée comme 0.
3. **`establishmentId`.** L'identifiant (36 caractères) était tronqué à 25
   dans le `.sav` ; il est déclaré A36.
4. **Dates de période.** `periodStart` et `periodEnd` sont la date
   calendaire de Douala. Une campagne commençant à minuit à Douala
   (23 h 00 UTC la veille) apparaissait avec la date de la veille, par
   exemple `2026-09-30` au lieu de `2026-10-01` pour le 4e trimestre 2026.

**Fichiers produits avant la version 8** : répondant VT1_15 vide, totaux
des tableaux ligne par ligne vides (recalculez-les à partir des cellules),
`establishmentId` tronqué dans le `.sav`, et `periodStart` éventuellement
décalé d'un jour pour les campagnes créées depuis l'interface. Réexportez
plutôt que de corriger à la main.

## Exemple SPSS : ensemble à réponses multiples

Avec les variables 0/1, une question à choix multiples s'analyse
directement comme ensemble dichotomique :

```spss
MRSETS
  /MDGROUP NAME=$canaux_eleves
    LABEL='7.1.3 Canaux de communication — Élèves'
    CATEGORYLABELS=VARLABELS
    VARIABLES=VT7_7_01 VT7_7_02 VT7_7_03 VT7_7_04 VT7_7_05 VT7_7_06 VT7_7_07 VT7_7_08 VT7_7_96
    VALUE=1.

CTABLES
  /TABLE $canaux_eleves [COUNT COLPCT.RESPONSES.COUNT].
```

Un ensemble dichotomique ne compte que les centres ayant au moins un « 1 » :
un centre qui a répondu sans rien cocher (tout à 0) en est exclu, comme un
centre sans réponse (tout vide). Pour distinguer ces deux cas, comptez les
valeurs manquantes de la variable de la question (`VT7_7` vide = non
répondu).

## À savoir

- Par défaut, l'export officiel ne contient que les déclarations visées
  (approuvées). Un autre statut peut être choisi ; dans tous les cas, une
  déclaration ayant une anomalie bloquante ouverte est exclue.
- Depuis le 9 octobre 2026, les avertissements de cohérence (totaux qui ne
  concordent pas d'un tableau à l'autre) ne bloquent plus l'approbation ni
  l'export ; ils restent visibles pour la revue. Des déclarations
  auparavant exclues peuvent donc apparaître une fois visées.
- L'état nominatif des formateurs (8.8) n'est pas exporté.

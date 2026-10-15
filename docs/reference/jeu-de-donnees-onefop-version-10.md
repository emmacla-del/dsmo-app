# Jeu de données ONEFOP — version 10

Note à l'intention des analystes qui exploitent les exports SPSS (`.sav`),
CSV (`.csv` + syntaxe `.sps`) et Excel du questionnaire ONEFOP.
Rédigée le 15 octobre 2026 ; elle fait suite à
[la note des versions 7 à 9](jeu-de-donnees-onefop-versions-7-9.md).

## Ce qui change

Les questions 9.1 « Autre (à préciser) » et 9.2 « Perspectives » du
questionnaire des centres de formation professionnelle (partition TVET)
comportent chacune cinq lignes à remplir. Jusqu'à la version 9, les cinq
lignes étaient réunies dans une seule variable, séparées par des virgules
(`VT9_4` = « Ouvrir une filière froid et climatisation,,,, »), ce qui ne
permettait pas de les distinguer quand une réponse contient elle-même une
virgule.

À partir de la version 10, chaque ligne est une variable texte :

| Question | Variables (v10) | Remplace (v9) |
|---|---|---|
| 9.1 Autre (à préciser) | `VT9_3_1` … `VT9_3_5` | `VT9_3` |
| 9.2 Perspectives | `VT9_4_1` … `VT9_4_5` | `VT9_4` |

- Ordre : celui dans lequel le répondant a rempli les lignes.
- Ligne vide : valeur vide (manquante système), jamais -98.
- Largeur : A2000, comme tout texte libre depuis la version 6.
- Les dix variables prennent la place de `VT9_3` et `VT9_4` ; aucune autre
  variable n'est renommée ni déplacée.

## Effet sur vos scripts

C'est la première version qui **retire** des variables : `VT9_3` et `VT9_4`
n'existent plus dans les fichiers v10 (leurs noms restent réservés et ne
seront jamais réutilisés). Une syntaxe qui les cite doit être adaptée, par
exemple pour reconstituer l'ancienne liste :

```spss
STRING VT9_4_liste (A10000).
COMPUTE VT9_4_liste = CONCAT(RTRIM(VT9_4_1), "; ", RTRIM(VT9_4_2), "; ",
  RTRIM(VT9_4_3), "; ", RTRIM(VT9_4_4), "; ", RTRIM(VT9_4_5)).
EXECUTE.
```

La version d'un fichier se lit dans la variable `schemaVersion`, dans
l'en-tête de la syntaxe `.sps` (« Version du schéma du jeu de données : 10. »)
et dans l'en-tête HTTP `X-Dataset-Schema-Version`.

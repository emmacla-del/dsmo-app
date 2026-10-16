# Jeu de données ONEFOP — version 11

Note à l'intention des analystes qui exploitent les exports SPSS (`.sav`),
CSV (`.csv` + syntaxe `.sps`) et Excel du questionnaire ONEFOP.
Rédigée le 16 octobre 2026 ; elle fait suite à
[la note de la version 10](jeu-de-donnees-onefop-version-10.md).

## Ce qui change

Le jeu de données statistique est anonyme. Jusqu'à la version 10, il
contenait pourtant les coordonnées des personnes de contact des centres de
formation professionnelle (partition TVET). À partir de la version 11, ces
neuf variables n'y figurent plus :

| Question | Variables retirées |
|---|---|
| 1.15 Répondant | `VT1_15_NAME`, `VT1_15_TEL1`, `VT1_15_TEL2`, `VT1_15_EMAIL` |
| 1.16 Promoteur / directeur | `VT1_16_NAME`, `VT1_16_TEL1`, `VT1_16_TEL2`, `VT1_16_EMAIL` |
| 2.1.12 Adresse e-mail du centre | `VT2_12` |

- Restent dans le jeu de données : la fonction du répondant
  (`VT1_15_FUNCTION`), le sexe (`VT1_15_SEX`, `VT1_16_SEX`) et toutes les
  autres variables, sans changement de nom ni d'ordre.
- Les neuf noms restent réservés dans le registre et ne seront jamais
  réutilisés pour une autre variable.

## Où trouver les coordonnées

Elles sont dans un fichier séparé, le **fichier restreint des coordonnées
(VT)** : `POST /data-management/export/vt-contact/{csv,sav,manifest}`.

- Une ligne par déclaration, reliée au jeu de données principal par
  `submissionId`. Elle reprend aussi `establishmentId`, `companyName`,
  `region`, `department`, `quarterCode` et `status`.
- Les noms des neuf variables sont ceux de la version 10.
- Accès réservé à SUPER_ADMIN et ADMIN_ONEFOP, contrôlé par le serveur ;
  chaque téléchargement est inscrit dans l'historique des exports. Les rôles
  régionaux et départementaux ne reçoivent jamais ces coordonnées.
- Ce fichier s'ajoute à la liste nominative du personnel (8.8), déjà
  séparée pour la même raison.

## Effet sur vos scripts

Une syntaxe qui cite l'une des neuf variables doit d'abord fusionner le
fichier des coordonnées, par exemple :

```spss
MATCH FILES /FILE=* /TABLE='onefop_vt_contacts_restreints.sav'
  /BY submissionId.
EXECUTE.
```

Les deux fichiers doivent être triés par `submissionId`.

La version d'un fichier se lit dans la variable `schemaVersion`, dans
l'en-tête de la syntaxe `.sps` (« Version du schéma du jeu de données : 11. »)
et dans l'en-tête HTTP `X-Dataset-Schema-Version`.

# Arrondissements Pending Decision (Absent from the 360 List)

The following **29 arrondissements** were present in the previous database reference data / seed, but are absent from the reviewed 360 subdivisions list (`docs/reference/arrondissements-mapping.xlsx`).

Per migration policy:
- **They are NOT deleted from the database.**
- They remain in place in the `subdivisions` table with their existing UUIDs.
- They have been assigned frozen non-colliding codes using the next free sequence number in their respective department.
- Awaiting administrative review and decision.

| # | Region | Department | Arrondissement | Assigned Code | Status / Note |
|---|--------|------------|----------------|---------------|---------------|
| 1 | Adamaoua | Djérem | Mbakaou | `0103` | Absent from 360 list; pending confirmation |
| 2 | Adamaoua | Mbéré | Gonmé | `0405` | Absent from 360 list; pending confirmation |
| 3 | Adamaoua | Vina | Meidougou | `0509` | Absent from 360 list; pending confirmation |
| 4 | Centre | Mbam-et-Inoubou | Koro | `0810` | Absent from 360 list; pending confirmation |
| 5 | Centre | Nyong-et-Mfoumou | Kobdombo | `1406` | Absent from 360 list; pending confirmation |
| 6 | Centre | Nyong-et-Mfoumou | Menomale | `1407` | Absent from 360 list; pending confirmation |
| 7 | Est | Haut-Nyong | Angossas | `1715` | Absent from 360 list; pending confirmation |
| 8 | Est | Haut-Nyong | Atok | `1716` | Absent from 360 list; pending confirmation |
| 9 | Est | Haut-Nyong | Dimako | `1717` | Absent from 360 list; pending confirmation |
| 10 | Est | Kadey | Nguelebok | `1808` | Absent from 360 list; pending confirmation |
| 11 | Est | Kadey | Ouli | `1809` | Absent from 360 list; pending confirmation |
| 12 | Extrême-Nord | Mayo-Danay | Moulouvaye | `2212` | Absent from 360 list; pending confirmation |
| 13 | Extrême-Nord | Mayo-Kani | Tchanaga | `2308` | Absent from 360 list; pending confirmation |
| 14 | Extrême-Nord | Mayo-Kani | Toulourou | `2309` | Absent from 360 list; pending confirmation |
| 15 | Extrême-Nord | Mayo-Sava | Limani | `2404` | Absent from 360 list; pending confirmation |
| 16 | Extrême-Nord | Mayo-Tsanaga | Mozogo | `2508` | Absent from 360 list; pending confirmation |
| 17 | Extrême-Nord | Mayo-Tsanaga | Roua | `2509` | Absent from 360 list; pending confirmation |
| 18 | Littoral | Moungo | Bonalea | `2614` | Absent from 360 list; pending confirmation |
| 19 | Littoral | Moungo | Ekom | `2615` | Absent from 360 list; pending confirmation |
| 20 | Littoral | Wouri | Manoka | `2907` | Absent from 360 list; pending confirmation |
| 21 | Nord | Bénoué | Ngong | `3013` | Absent from 360 list; pending confirmation |
| 22 | Nord | Mayo-Rey | Pignde | `3305` | Absent from 360 list; pending confirmation |
| 23 | Nord-Ouest | Boyo | Fonfuka | `3405` | Absent from 360 list; pending confirmation |
| 24 | Nord-Ouest | Menchum | Benakuma | `3705` | Absent from 360 list; pending confirmation |
| 25 | Nord-Ouest | Menchum | Zhoa | `3706` | Absent from 360 list; pending confirmation |
| 26 | Ouest | Hauts-Plateaux | Bansoa | `4305` | Absent from 360 list; pending confirmation |
| 27 | Sud | Océan | Grand Batanga | `5110` | Absent from 360 list; pending confirmation |
| 28 | Sud | Vallée-du-Ntem | Nkpwa | `5205` | Absent from 360 list; pending confirmation |
| 29 | Sud-Ouest | Manyu | Tinto | `5605` | Absent from 360 list; pending confirmation |

## Total Summary
- **Canonical Subdivisions (reviewed 360 list)**: 360
- **Pending Subdivisions (preserved in database)**: 29
- **Total Subdivisions in Database Table**: 389

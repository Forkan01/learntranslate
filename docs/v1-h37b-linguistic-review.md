# V1-H.37B — Published German word-card linguistic review

Review scope: production **published** Word Cards, read-only. Reviewed 12 noun headwords, their articles, plurals, and primary English translations. This is a human-readable review record, **not** an automated linguistic correctness guarantee. No production content has been edited.

| German | Article | Plural | English meaning | Review |
|---|---|---|---|---|
| Antrag | der | Anträge | application; formal request | Accept |
| Beschwerde | die | Beschwerden | complaint; symptom (usually plural in medical contexts) | Review sense formatting |
| Bewerbung | die | Bewerbungen | job application | Accept |
| Fehler | der | Fehler | mistake; error | Accept |
| Gefühl | das | Gefühle | feeling | Accept |
| Gespräch | das | Gespräche | conversation; discussion | Accept |
| Gewohnheit | die | Gewohnheiten | habit | Accept |
| Miete | die | Mieten | rent | Accept |
| Prüfung | die | Prüfungen | exam | Accept; other contexts include examination/test |
| Rechnung | die | Rechnungen | bill; invoice | Accept |
| Verspätung | die | Verspätungen | delay | Accept |
| Zutat | die | Zutaten | ingredient | Accept |

## Findings

- All **12 reviewed noun articles and plurals** are consistent with standard German usage.
- The primary English meanings are reasonable for the curated contexts; no high-confidence factual grammar error was identified in these 12 entries.
- **Review candidate — Beschwerde:** the stored translation `complaint; symptom (usually plural in medical contexts)` mixes a lookup sense with explanatory text. The reverse English search currently splits only at semicolons and matches whole senses, so searching `symptom` may not retrieve the card. Prefer a clean sense `complaint; symptom` and preserve the plural/medical distinction in `usageNotes`, after reviewing the intended search behavior. Do not automatically rewrite it.
- **Coverage:** This pass reviewed headword grammar and primary translations, not every bilingual example or all sentence cards. Those belong to H.37C/D.
- **Search semantics:** English reverse lookup is exact by sense; adding additional synonyms changes search discoverability. Any content corrections require explicit review, then a separately tested publication step.

## Release safeguards

1. Keep the published database unchanged in H.37B.
2. Do not infer correctness of translations from structural schema tests.
3. Approve proposed edits individually and test both direct and reverse search afterward.

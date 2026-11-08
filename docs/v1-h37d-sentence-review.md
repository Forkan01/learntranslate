# V1-H.37D — Published Sentence Card linguistic review

## Scope and inventory reconciliation

Read-only query of production `public.cards` with `status='published'` and `content.type='sentence'` returned **12 Sentence Cards**. A previous H.37A summary incorrectly reported 10 sentences; the correct current published inventory is **12 Word Cards + 12 Sentence Cards = 24 cards**. This report corrects that count. No database records were modified.

## Editorial review

| German sentence | English translation | Review |
|---|---|---|
| Das Programm funktioniert nicht wie erwartet. | The program isn't working as expected. | Accept: idiomatic and faithful |
| Ich bin auf der Suche nach einer Stelle. | I'm looking for a job. | Accept: natural job-search context; `Stelle` can also mean position |
| Ich freue mich auf das Wochenende. | I'm looking forward to the weekend. | Accept: `sich freuen auf + Akkusativ` correctly noted |
| Ich fühle mich heute nicht gut. | I don't feel well today. | Accept |
| Ich habe den Anschluss verpasst. | I missed my connection. | Accept: public-transport context |
| Ich habe die Prüfung bestanden. | I passed the exam. | Accept |
| Ich hätte gern einen Termin. | I'd like an appointment. | Accept: polite request |
| Ich muss noch etwas erledigen. | I still have something to take care of. | Accept: natural paraphrase |
| Kann ich mit Karte bezahlen? | Can I pay by card? | Accept |
| Könnten Sie das bitte wiederholen? | Could you please repeat that? | Accept: polite formal `Sie` |
| Wann ist die Miete fällig? | When is the rent due? | Accept |
| Was empfehlen Sie? | What do you recommend? | Accept: formal `Sie` |

## Findings

- All **12** published Sentence Cards contain a non-empty German sentence, English translation and `naturalMeaning`.
- No high-confidence translation or German grammar errors identified in the reviewed primary sentences.
- **All 12 lack optional `grammarBreakdown` and `wordBreakdown`**. This is *not* a schema failure. If the product aims to teach sentence grammar interactively, add curated breakdowns gradually, prioritizing `sich freuen auf + Akkusativ`, polite Konjunktiv II (`hätte`, `könnten`), separable verbs (`wiederholen` is **not** separable), and perfect tense (`habe ... verpasst/bestanden`).
- The existing natural meanings are concise and generally context-appropriate.
- **Pedagogical nuance:** `Ich hätte gern einen Termin` uses polite Konjunktiv II; `Was empfehlen Sie?` and `Könnten Sie ...?` use formal address. These are useful future optional grammar annotations, not required corrections.

## Next steps

1. Preserve existing published content until proposed enrichments are reviewed.
2. Keep optional grammar/word breakdowns optional in automated validators.
3. Add specific curated grammar notes in a separate reviewed data-change milestone if desired.
4. Verify card rendering and search after any publication changes.

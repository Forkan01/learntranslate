// V1-H.37F: editorially curated teaching enrichment for existing German sentence cards.
// Proposals only. Never automatically mutate published database records.
export const curatedSentenceGrammar = [
  {
    term: "Ich freue mich auf das Wochenende.",
    grammarBreakdown: [
      "sich freuen auf + Akkusativ means to look forward to something.",
      "mich is the reflexive pronoun used with ich.",
      "das Wochenende stays das in the accusative because it is neuter."
    ],
    wordBreakdown: [
      { word: "Ich", meaning: "I" },
      { word: "freue mich auf", meaning: "look forward to", note: "reflexive expression: sich freuen auf" },
      { word: "das Wochenende", meaning: "the weekend" }
    ]
  },
  {
    term: "Ich hätte gern einen Termin.",
    grammarBreakdown: [
      "hätte is Konjunktiv II of haben and makes this request polite.",
      "einen Termin is accusative: der Termin becomes einen Termin."
    ],
    wordBreakdown: [
      { word: "Ich", meaning: "I" },
      { word: "hätte gern", meaning: "would like", note: "polite expression" },
      { word: "einen Termin", meaning: "an appointment" }
    ]
  },
  {
    term: "Könnten Sie das bitte wiederholen?",
    grammarBreakdown: [
      "könnten is Konjunktiv II of können, used for a polite request.",
      "Sie is the formal you and is capitalized.",
      "wiederholen is the infinitive at the end of the clause; it is not a separable verb."
    ],
    wordBreakdown: [
      { word: "Könnten", meaning: "could", note: "polite conditional form" },
      { word: "Sie", meaning: "you", note: "formal" },
      { word: "das", meaning: "that" },
      { word: "bitte", meaning: "please" },
      { word: "wiederholen", meaning: "repeat" }
    ]
  },
  {
    term: "Ich habe die Prüfung bestanden.",
    grammarBreakdown: [
      "The Perfekt tense uses habe (present tense of haben) plus bestanden (past participle).",
      "bestehen means to pass an exam in this context.",
      "die Prüfung is the accusative object; feminine die remains die."
    ],
    wordBreakdown: [
      { word: "Ich", meaning: "I" },
      { word: "habe ... bestanden", meaning: "passed", note: "Perfekt tense" },
      { word: "die Prüfung", meaning: "the exam" }
    ]
  }
];

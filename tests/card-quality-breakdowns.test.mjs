import test from "node:test";
import assert from "node:assert/strict";
import { auditLearningCard } from "../scripts/card-quality-audit.mjs";

const sentence = {schemaVersion:1,type:"sentence",sourceLanguage:"de",targetLanguage:"en",term:"Ich freue mich auf das Wochenende.",translation:"I'm looking forward to the weekend.",naturalMeaning:"Expresses anticipation."};
test("optional breakdowns may be absent",()=>assert.deepEqual(auditLearningCard(sentence),[]));
test("well-formed teaching notes pass",()=>assert.deepEqual(auditLearningCard({...sentence,grammarBreakdown:["sich freuen auf + Akkusativ"],wordBreakdown:[{word:"Wochenende",meaning:"weekend"}]}),[]));
test("empty grammar notes are rejected",()=>assert.ok(auditLearningCard({...sentence,grammarBreakdown:[""]}).includes("invalid_grammar_breakdown")));
test("incomplete word breakdown rejected",()=>assert.ok(auditLearningCard({...sentence,wordBreakdown:[{word:"Wochenende"}]}).includes("invalid_word_breakdown")));
test("non-array breakdown rejected",()=>assert.ok(auditLearningCard({...sentence,grammarBreakdown:"text"}).includes("invalid_grammar_breakdown")));

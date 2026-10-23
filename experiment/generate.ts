// npm run experiment:generate
// Writes experiment/questions.csv with answers computed from the app's data
// and engine. The file is git-ignored so the answer key never sits in the
// public repo where a browsing assistant could find it.
import { writeFileSync } from 'node:fs';
import { toCsv } from './csv';
import { buildQuestions, QUESTION_COLUMNS } from './questions';

const today = new Date().toISOString().slice(0, 10);
const questions = buildQuestions(today);
writeFileSync('experiment/questions.csv', toCsv(questions as unknown as Record<string, unknown>[], QUESTION_COLUMNS));
console.log(`Wrote experiment/questions.csv: ${questions.length} questions.`);

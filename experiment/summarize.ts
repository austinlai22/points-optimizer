// npm run experiment:summarize -- experiment/results.csv
// Prints accuracy by assistant, condition and category for a filled results
// file. Needs experiment/questions.csv (npm run experiment:generate) to know
// each question's category.
import { existsSync, readFileSync } from 'node:fs';
import { parseCsv } from './csv';
import { summarize, type ResultRow } from './summary';

const resultsPath = process.argv[2] ?? 'experiment/results.csv';
for (const path of [resultsPath, 'experiment/questions.csv']) {
  if (!existsSync(path)) {
    console.error(`Missing ${path}.`);
    process.exit(1);
  }
}

const categoryById = Object.fromEntries(
  parseCsv(readFileSync('experiment/questions.csv', 'utf8')).map((q) => [q.id, q.category]),
);
const rows = summarize(parseCsv(readFileSync(resultsPath, 'utf8')) as unknown as ResultRow[], categoryById);
console.table(rows.map((r) => ({ Assistant: r.assistant, Condition: r.condition, Category: r.category, Answered: r.answered, Correct: r.correct, Partly: r.partly, Wrong: r.wrong, 'Accuracy %': r.accuracy_pct })));

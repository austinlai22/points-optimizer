// Scores a filled results file: accuracy by assistant, condition and category.
// Correct counts 1, partly 0.5, wrong 0.

export interface ResultRow {
  assistant: string;
  condition: string;
  question_id: string;
  score: string;
}

export interface SummaryRow {
  assistant: string;
  condition: string;
  category: string;
  answered: number;
  correct: number;
  partly: number;
  wrong: number;
  accuracy_pct: number;
}

const POINTS: Record<string, number> = { correct: 1, partly: 0.5, wrong: 0 };

export function summarize(results: ResultRow[], categoryById: Record<string, string>): SummaryRow[] {
  const groups = new Map<string, SummaryRow>();
  const add = (assistant: string, condition: string, category: string, score: string) => {
    const key = `${assistant}|${condition}|${category}`;
    const row =
      groups.get(key) ??
      { assistant, condition, category, answered: 0, correct: 0, partly: 0, wrong: 0, accuracy_pct: 0 };
    row.answered += 1;
    if (score === 'correct') row.correct += 1;
    else if (score === 'partly') row.partly += 1;
    else row.wrong += 1;
    groups.set(key, row);
  };

  for (const r of results) {
    const score = r.score.toLowerCase();
    if (!(score in POINTS)) continue; // unscored rows are skipped
    const category = categoryById[r.question_id] ?? 'unknown';
    add(r.assistant, r.condition, category, score);
    add(r.assistant, r.condition, 'all', score);
  }

  return [...groups.values()]
    .map((row) => ({ ...row, accuracy_pct: Math.round(((row.correct + row.partly * 0.5) / row.answered) * 1000) / 10 }))
    .sort((a, b) =>
      a.assistant.localeCompare(b.assistant) ||
      a.condition.localeCompare(b.condition) ||
      (a.category === 'all' ? -1 : b.category === 'all' ? 1 : a.category.localeCompare(b.category)),
    );
}

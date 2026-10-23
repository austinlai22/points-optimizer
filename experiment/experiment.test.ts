import { describe, expect, it } from 'vitest';
import { parseCsv, toCsv } from './csv';
import { buildQuestions, CATEGORIES, QUESTION_COLUMNS } from './questions';
import { summarize } from './summary';

const TODAY = '2026-10-23';

describe('experiment kit', () => {
  const questions = buildQuestions(TODAY);

  it('has 15 questions split 4/4/4/3, each with an answer, a source and a date', () => {
    expect(questions).toHaveLength(15);
    const counts = Object.fromEntries(CATEGORIES.map((c) => [c, questions.filter((q) => q.category === c).length]));
    expect(counts).toEqual({ transfer_facts: 4, arithmetic: 4, points_boost_rules: 4, breakeven: 3 });
    expect(new Set(questions.map((q) => q.id)).size).toBe(15);
    for (const q of questions) {
      expect(q.correct_answer, q.id).not.toBe('');
      expect(q.source_url, q.id).toMatch(/^https:\/\//);
      expect(q.verified_date, q.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('takes answers from the data and engine', () => {
    const byId = Object.fromEntries(questions.map((q) => [q.id, q.correct_answer]));
    expect(byId.T1).toMatch(/^Yes, at 1:1/);
    expect(byId.T2).toMatch(/^Yes, at 5:4/);
    expect(byId.T3).toMatch(/^No\./);
    expect(byId.T4).toBe('Only Bilt, at 1:1.');
    expect(byId.A1).toMatch(/^1\.35¢/);
    expect(byId.A3).toMatch(/^5\.6¢/);
    expect(byId.B1).toMatch(/^Up to 2x/);
    expect(byId.B3).toMatch(/2027-10-26/);
    expect(byId.K1).toMatch(/^62,500 points/);
    expect(byId.K3).toMatch(/^86,666 points/);
  });

  it('round-trips through CSV, commas and quotes included', () => {
    const csv = toCsv(questions as unknown as Record<string, unknown>[], QUESTION_COLUMNS);
    expect(parseCsv(csv)).toEqual(questions);
  });

  it('scores correct as 1, partly as 0.5, by condition and category', () => {
    const categoryById = Object.fromEntries(questions.map((q) => [q.id, q.category]));
    const rows = summarize(
      [
        { assistant: 'A', condition: 'without_tool', question_id: 'T1', score: 'correct' },
        { assistant: 'A', condition: 'without_tool', question_id: 'T2', score: 'wrong' },
        { assistant: 'A', condition: 'without_tool', question_id: 'A1', score: 'partly' },
        { assistant: 'A', condition: 'with_tool', question_id: 'T2', score: 'correct' },
        { assistant: 'A', condition: 'with_tool', question_id: 'A1', score: '' },
      ],
      categoryById,
    );
    const find = (condition: string, category: string) => rows.find((r) => r.condition === condition && r.category === category)!;
    expect(find('without_tool', 'all')).toMatchObject({ answered: 3, accuracy_pct: 50 });
    expect(find('without_tool', 'transfer_facts')).toMatchObject({ answered: 2, accuracy_pct: 50 });
    expect(find('with_tool', 'all')).toMatchObject({ answered: 1, accuracy_pct: 100 });
  });
});

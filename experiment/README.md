# Do AI assistants get points facts right?

A hand-run test of consumer AI assistants on objective points questions, with and without PointCompass connected. It scores facts only: transfer partners and ratios, arithmetic, Chase's Points Boost rules, and breakeven prices. Opinions on what a point is "worth" are out of scope, because sources legitimately disagree.

## Files

| File | What it is |
|---|---|
| `questions.ts` | The 15 questions (4 transfer facts, 4 arithmetic, 4 Points Boost rules, 3 breakeven). Answers are computed from the app's data files and engine, not typed in. |
| `questions.csv` | Generated answer key. Not committed. |
| `results-template.csv` | Copy to `results.csv` and fill in one row per answer. |
| `summarize.ts` | Accuracy by assistant, condition and category. |

## Before each round

```bash
npm run experiment:generate   # writes experiment/questions.csv with today's answers
cp experiment/results-template.csv experiment/results.csv
```

Regenerate on the day you run a round: the answers come from the current data, which changes when banks change their terms. Keep `questions.csv` private. The public repo holds the generator but not the answer key, so an assistant that browses the web can't simply find the answers.

## Running it

For each assistant (for example Claude, ChatGPT, Gemini) and each condition:

- **`without_tool`**: the assistant as it comes, with PointCompass not connected.
- **`with_tool`**: PointCompass added as a connector (see pointcompass.vercel.app/agents). Only assistants that support custom connectors can run this condition.

Rules, so the rounds are comparable:

1. Start a **new chat for every question**. No earlier context.
2. **Paste the question exactly** as written in `questions.csv`. No rephrasing, no hints.
3. **No follow-ups.** Score the first answer only.
4. Record the **plan tier** (Free, Plus, Pro, ...) and the **model shown in the app**, if it shows one.
5. If the assistant searched the web, say so in `notes`, with the sites it cited if visible.
6. Record the date. Points facts change, so results are only comparable within a round.

## Scoring

Compare each answer with `correct_answer` and `acceptable_variants`:

- **correct**: states the right answer. Extra correct detail is fine.
- **partly**: right direction but incomplete or slightly off. For example, the right ratio but not the transfer direction, a cents-per-point figure off by more than 0.01¢ through rounding, or the right Boost maximum but the wrong card.
- **wrong**: incorrect, outdated (for example an ended partnership described as current), or no answer.

When unsure between two scores, take the lower one and explain in `notes`.

## Summarizing

```bash
npm run experiment:summarize -- experiment/results.csv
```

Accuracy counts correct as 1 and partly as 0.5. The table shows each assistant and condition overall (`all`) and by category.

## Out of scope

No automation of chat apps, no paid API calls, and no publishing. How results are presented is Austin's decision.

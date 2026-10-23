import reportConfig from '../../src/data/report-config.json';
import { validateReport } from '../../src/lib/reports/validate';
import { recordEvent, utcDate } from '../analytics';
import { allow } from '../ratelimit';
import { saveReport } from './save';
import type { Store } from '../store';

// POST /api/report: one opt-in Chase Travel price report. Stored exactly as
// validated (the fields in src/lib/reports/validate.ts), under a random key
// that links to nothing, and deleted automatically after the retention period.
// No IP, user agent, anonymous id or anything else about the sender is kept.

export interface ReportDeps {
  store: Store | null;
  // Salts the rate-limit key; any long secret already in the environment.
  secret: string;
  now?: () => Date;
}

const json = (status: number, body: unknown) => Response.json(body, { status });

export function createReportHandler(deps: ReportDeps) {
  return {
    async fetch(request: Request): Promise<Response> {
      if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      if (!deps.store) return json(503, { error: 'Sharing is not available right now.' });

      const now = deps.now?.() ?? new Date();
      const { reports_per_hour, window_seconds } = reportConfig.rate_limit;
      const permitted = await allow(deps.store, 'report', request, {
        limit: reports_per_hour,
        windowSeconds: window_seconds,
        secret: deps.secret,
        now,
      });
      if (!permitted) return json(429, { error: 'Too many reports from here. Please try again later.' });

      const raw = await request.text();
      if (raw.length > 2048) return json(413, { error: 'Report too large.' });
      let body: unknown;
      try {
        body = JSON.parse(raw);
      } catch {
        return json(400, { error: 'Report must be JSON.' });
      }

      const result = validateReport(body, utcDate(now));
      if (!result.ok) {
        // Out-of-range prices are counted so typos can be noticed, never stored.
        if (result.reason === 'out_of_range') {
          await recordEvent(deps.store, { name: 'price_report_rejected' }, null, now);
          return json(422, { error: result.errors[0] });
        }
        return json(400, { error: 'Report is not valid.', details: result.errors });
      }

      await saveReport(deps.store, result.report, now);
      await recordEvent(deps.store, { name: 'price_report' }, null, now);
      return json(201, { ok: true });
    },
  };
}

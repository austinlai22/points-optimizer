import { randomUUID } from 'node:crypto';
import reportConfig from '../../src/data/report-config.json';
import type { PriceReport } from '../../src/lib/reports/validate';
import type { Store } from '../store';

const DAY_MS = 24 * 60 * 60 * 1000;

// When a report should be deleted: the retention period after the day it was
// submitted. Counting from that day, not from when it was saved, means an
// older price imported today still leaves on time.
export function retentionEnd(submittedOn: string): Date {
  const end = new Date(`${submittedOn}T00:00:00Z`);
  end.setUTCMonth(end.getUTCMonth() + reportConfig.retention_months);
  return end;
}

// Stores one validated report under a random key that links to nothing.
// Returns false, storing nothing, if it's already past its retention period.
export async function saveReport(store: Store, report: PriceReport, now: Date = new Date()): Promise<boolean> {
  const ttlSeconds = Math.floor((retentionEnd(report.submitted_on).getTime() - now.getTime()) / 1000);
  if (ttlSeconds < DAY_MS / 1000) return false;
  await store.set(`report:${randomUUID()}`, JSON.stringify(report), { ttlSeconds });
  return true;
}

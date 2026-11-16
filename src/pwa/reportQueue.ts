import type { components } from '../shared/api/schema';

export interface NewReport {
  idempotencyKey: string;
  body: components['schemas']['ReportCreate'];
  label: { product: string; store: string };
}

export interface ReportQueue {
  name: string;
  add: (report: NewReport) => Promise<void>;
  list: () => Promise<unknown[]>;
}

export function openReportQueue(name: string): Promise<ReportQueue> {
  return Promise.resolve({ name, add: () => Promise.resolve(), list: () => Promise.resolve([]) });
}

/**
 * Types for the Dribba public API client.
 *
 * Hand-written rather than generated on purpose: the package has no build step,
 * so what ships is what you can read. The authoritative contract is
 * https://dribba.com/openapi.json — if the two ever disagree, the contract wins.
 */

export declare const PRODUCTION: "https://dribba.com";
export declare const SANDBOX: "https://dribba.com/sandbox";

/** A page of a collection. Omit `limit` and you get the whole set at once. */
export interface Page<T> {
  count: number;
  total: number;
  /** Opaque. Pass it back verbatim; never parse or construct it. */
  next_cursor: string | null;
  items: T[];
}

export interface PageQuery {
  /** 1-100. Omitted means "the whole collection". */
  limit?: number;
  cursor?: string;
}

export interface Service {
  slug: string;
  name: string;
  url: string;
  summary: string;
}

export interface CaseSummary {
  slug: string;
  title: string;
  url: string;
  industry: string;
  category: string[];
  client: string | null;
  year: number | null;
  tech: string[];
  headline: string | null;
}

export interface CaseStudy extends CaseSummary {
  description: string | null;
  duration: string | null;
  teamSize: number | null;
  services: string[];
  challenge: string | null;
  solution: string | null;
  outcome: string | null;
  tags: string[];
  metrics: { metric: string; value: string; description?: string }[];
}

export interface Article {
  slug: string;
  title: string;
  url: string;
  description: string;
  category: string;
  tags: string[];
  author: string;
  publishedAt: string | null;
  updatedAt: string | null;
  readTime: string;
  /** The same article as text/markdown. */
  markdown_url: string;
}

export interface Job {
  slug: string;
  title: string;
  url: string;
  area: string;
  type: string;
  location: string;
  description: string;
  requirements: string[];
  publishedAt: string | null;
  salary: { currency: string; min: number; max: number; period: "YEAR" };
}

export interface Comparison {
  topic: string;
  verdict: string;
}

export interface EstimateInput {
  platforms: ("ios" | "android" | "web" | "desktop")[];
  features?: string[];
  complexity?: "mvp" | "standard" | "complex";
  design?: "basic" | "custom" | "premium";
  timeline?: "rush" | "normal" | "relaxed";
}

export interface Estimate {
  currency: "EUR";
  min: number;
  max: number;
  mid: number;
  /** True when the raw maths landed under the published €30,000 floor. */
  below_floor: boolean;
  minimum_project_budget: number;
  input: EstimateInput;
  note: string;
  next_step: string;
}

export interface BatchOperation {
  id?: string;
  method?: "GET";
  /** A /api/v1 path, query string included. */
  path: string;
}

export interface BatchResult {
  id: string;
  status: number;
  body?: unknown;
  error?: { code: string; detail: string };
}

export interface ExportJob {
  id: string;
  status: "accepted" | "running" | "completed" | "failed";
  progress: { done: number; total: number };
  status_url: string;
  result_url: string | null;
  error: string | null;
  expires_at: string;
  /** Jobs live in one instance's memory. A 404 while polling means "other instance". */
  instance_scoped: boolean;
}

export interface AskResult {
  _meta: { response_type: "passages"; version: string; count: number; generative: false };
  query: string;
  results: {
    id: string;
    title: string;
    url: string;
    snippet: string;
    matched_terms: string[];
    score: number;
  }[];
}

/** Every 4xx/5xx. Branch on `code`; it is stable. */
export declare class DribbaError extends Error {
  status: number;
  code: string;
  resolution?: string;
  instance?: string;
  documentationUrl?: string;
  problem: unknown;
}

export interface DribbaOptions {
  baseUrl?: string;
  /** Shorthand for `baseUrl: SANDBOX` — frozen fixtures, production shapes. */
  sandbox?: boolean;
  fetch?: typeof fetch;
  userAgent?: string;
}

export declare class Dribba {
  constructor(options?: DribbaOptions);
  baseUrl: string;
  userAgent: string;
  /** Quota as advertised by the last response. */
  rateLimit: { limit: number | null; remaining: number | null; reset: number | null };

  request<T = unknown>(
    path: string,
    init?: {
      method?: string;
      body?: unknown;
      idempotencyKey?: string;
      query?: Record<string, string | number | undefined | null>;
    },
  ): Promise<T>;

  index(): Promise<Record<string, unknown>>;
  version(): Promise<Record<string, unknown>>;
  company(): Promise<Record<string, unknown>>;
  pricing(): Promise<Record<string, unknown>>;

  services(query?: PageQuery): Promise<Page<Service>>;
  service(slug: string): Promise<Service>;
  cases(query?: PageQuery): Promise<Page<CaseSummary>>;
  case(slug: string): Promise<CaseStudy>;
  articles(query?: PageQuery): Promise<Page<Article>>;
  jobs(query?: PageQuery): Promise<Page<Job>>;
  comparisons(query?: PageQuery): Promise<Page<Comparison>>;
  comparison(topic: string): Promise<Comparison>;

  paginate<T = unknown>(path: string, query?: PageQuery & Record<string, unknown>): AsyncGenerator<T>;

  estimate(input: EstimateInput, options?: { idempotencyKey?: string }): Promise<Estimate>;
  batch(
    operations: BatchOperation[],
    options?: { idempotencyKey?: string },
  ): Promise<{ count: number; results: BatchResult[] }>;
  ask(query: string): Promise<AskResult>;

  startExport(paths?: string[]): Promise<ExportJob>;
  exportStatus(id: string): Promise<ExportJob>;
  waitForExport(id: string, options?: { intervalMs?: number; timeoutMs?: number }): Promise<ExportJob>;
  exportResult(id: string): Promise<string>;

  markdown(path?: string): Promise<string>;
}

export default Dribba;

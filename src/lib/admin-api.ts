/**
 * Admin API client — typed fetch wrapper for /admin/* backend endpoints.
 * Automatically attaches admin_token as Authorization Bearer header.
 */

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

/** Read a cookie value by name (client-side only). */
function _getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()!.split(";").shift() ?? null;
  return null;
}

// ── Error types ────────────────────────────────────────────────────────────

export class AdminApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public detail?: unknown,
  ) {
    super(message);
    this.name = "AdminApiError";
  }
}

// ── Core fetch wrapper ─────────────────────────────────────────────────────

async function adminFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  // Remove leading slash from path if present to avoid double slashes
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  const url = `${API_URL}/admin/${cleanPath}`;

  // Attach the token as Authorization header so it works cross-origin
  // (dev: frontend :3001 → backend :8000).
  const token = _getCookie("admin_token");
  const authHeader: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {};

  const res = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...authHeader,
      ...(options.headers ?? {}),
    },
  });

  if (res.status === 401) {
    // Auth endpoints (login / totp-verify) return 401 for wrong credentials —
    // don't redirect, let the calling page handle the error.
    const isAuthEndpoint = path.startsWith("/auth/");
    if (!isAuthEndpoint && typeof window !== "undefined") {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
    }
    throw new AdminApiError(401, "Session expired");
  }

  if (res.status === 403) {
    throw new AdminApiError(403, "Insufficient permissions");
  }

  if (!res.ok) {
    let detail: unknown;
    try {
      detail = await res.json();
    } catch {
      detail = await res.text();
    }
    const message =
      typeof detail === "object" && detail !== null && "detail" in detail
        ? String((detail as { detail: unknown }).detail)
        : `Request failed: ${res.status}`;
    throw new AdminApiError(res.status, message, detail);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ── Convenience helpers ────────────────────────────────────────────────────

export const api = {
  get: <T>(path: string) => adminFetch<T>(path, { method: "GET" }),

  post: <T>(path: string, body?: unknown) =>
    adminFetch<T>(path, {
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  put: <T>(path: string, body?: unknown) =>
    adminFetch<T>(path, {
      method: "PUT",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(path: string, body?: unknown) =>
    adminFetch<T>(path, {
      method: "PATCH",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  del: <T>(path: string) => adminFetch<T>(path, { method: "DELETE" }),
};

// ── Auth endpoints ─────────────────────────────────────────────────────────

export interface LoginResponse {
  status: "totp_required";
  pending_token: string; // short-lived, no scope yet
}

export interface TotpVerifyResponse {
  access_token: string;
  expires_in: number;
}

export const authApi = {
  login: (email: string, password: string) =>
    api.post<LoginResponse>("auth/login", { email, password }),

  totpVerify: (pending_token: string, totp_code: string) =>
    api.post<TotpVerifyResponse>("auth/totp-verify", { pending_token, totp_code }),

  logout: () => api.post<void>("auth/logout"),

  refresh: () => api.post<TotpVerifyResponse>("auth/refresh"),
};

// ── Dashboard endpoints ────────────────────────────────────────────────────

export interface DashboardMetrics {
  analyses_today: number;
  analyses_change_pct: number;
  active_users_today: number;
  active_users_change_pct: number;
  llm_calls_today: number;
  llm_cost_today_usd: number;
  pattern_hits_today: number;
  pattern_hits_change_pct: number;
  success_rate_pct: number;
  success_rate_change_pct: number;
  open_prs: number;
  category_distribution: Record<string, number>;
  recent_activity: ActivityItem[];
}

export interface ActivityItem {
  timestamp: string;
  type: "analysis" | "contribution" | "llm_call" | "system";
  description: string;
  user_id?: string;
  pattern_id?: string;
}

export const dashboardApi = {
  getMetrics: () => api.get<DashboardMetrics>("dashboard/metrics"),
};

// ── Patterns endpoints ─────────────────────────────────────────────────────

export interface AdminPattern {
  pattern_id: string;
  name: string;
  category: string;
  subcategory?: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  source: "core" | "community" | "ai";
  version: string;
  status: "active" | "disabled" | "draft";
  metadata: {
    match_count_30d: number;
    success_rate: number;
    updated_at: string;
    author: string;
  };
}

export interface PatternListResponse {
  patterns: AdminPattern[];
  total: number;
  page: number;
  page_size: number;
}

export interface PatternFilters {
  category?: string;
  severity?: string;
  source?: string;
  min_success_rate?: number;
  page?: number;
  page_size?: number;
}

export const patternsApi = {
  list: (filters: PatternFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== "") params.set(k, String(v));
    });
    const queryString = params.toString();
    return api.get<PatternListResponse>(`patterns/${queryString ? `?${queryString}` : ""}`);
  },

  get: (id: string) => api.get<AdminPattern>(`patterns/${id}`),

  create: (data: Record<string, unknown>) =>
    api.post<AdminPattern>("patterns", data),

  update: (id: string, data: Record<string, unknown>, bump?: string) =>
    api.put(`patterns/${id}`, { pattern_data: data, bump: bump ?? "patch" }),

  disable: (id: string) => api.del(`patterns/${id}`),

  rollback: (id: string, version: string) =>
    api.post(`patterns/${id}/rollback/${version}`),

  getStats: (id: string, days = 30) =>
    api.get(`patterns/${id}/stats?days=${days}`),

  getHistory: (id: string) => api.get(`patterns/${id}/history`),

  test: (pattern_data: Record<string, unknown>, log_text: string) =>
    api.post<{ matched: boolean; confidence: number; extracted_vars: Record<string, string> }>(
      "patterns/test",
      { pattern_data, log_text },
    ),
};

// ── Users endpoints ────────────────────────────────────────────────────────

export interface AdminUser {
  user_id: string;
  email: string;
  github_login: string;
  tier: "free" | "pro" | "team" | "enterprise";
  status: "active" | "suspended";
  country?: string;
  created_at: string;
  last_active_at?: string;
  total_analyses: number;
  stripe_customer_id?: string;
}

export interface UserListResponse {
  users: AdminUser[];
  total: number;
  page: number;
  page_size: number;
}

export const usersApi = {
  list: (params: Record<string, string | number> = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
    );
    const queryString = qs.toString();
    return api.get<UserListResponse>(`users/${queryString ? `?${queryString}` : ""}`);
  },

  get: (userId: string) => api.get<AdminUser>(`users/${userId}`),

  changeTier: (userId: string, tier: string) =>
    api.patch(`users/${userId}/tier`, { tier }),

  suspend: (userId: string, reason: string) =>
    api.post(`users/${userId}/suspend`, { reason }),

  activate: (userId: string) => api.post(`users/${userId}/activate`),

  fetchEmail: (userId: string) =>
    api.post<{ message: string; email?: string; email_updated: boolean }>(
      `users/${userId}/fetch-email`
    ),

  exportGdpr: (userId: string) =>
    api.get<Record<string, unknown>>(`users/${userId}/export`),

  delete: (userId: string) => api.del(`users/${userId}`),

  setQuota: (userId: string, monthly_limit: number | null) =>
    api.patch<{ message: string }>(`users/${userId}/quota`, { monthly_limit }),
};

// ── Contributions endpoints ────────────────────────────────────────────────

export interface Contribution {
  id: string;                    // UUID — primary key for all contribution types
  type?: "form_submission" | "github_pr";
  pr_number?: number | null;     // GitHub PR number (null for form submissions)
  pr_url?: string | null;
  title: string;
  author_github: string;
  status: "pending_ci" | "pending_review" | "approved" | "rejected" | "changes_requested";
  created_at: string;
  updated_at: string;
  ci_passed?: boolean | null;
  quality_score?: number | null;
  author_previous_accepted: number;
  // Form submission fields
  category?: string;
  description?: string;
  suggested_fix?: string;
  regex_hint?: string | null;
  // Review feedback
  review_notes?: string | null;
  rejection_reason?: string | null;
  change_request_message?: string | null;
}

export interface ContributionListResponse {
  items: Contribution[];
  total: number;
  page: number;
  page_size: number;
}

export const contributionsApi = {
  list: (status?: string, page = 1, pageSize = 50) => {
    const qs = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
    if (status) qs.set("status", status);
    return api.get<ContributionListResponse>(`contributions/?${qs}`);
  },

  getStats: () => api.get<{ by_status: Record<string, number>; by_type: Record<string, number>; total: number }>("contributions/stats"),

  get: (id: string) => api.get<Contribution>(`contributions/${id}`),

  approve: (id: string, notes?: string) =>
    api.post<{ message: string }>(`contributions/${id}/approve`, { notes }),

  reject: (id: string, reason: string) =>
    api.post<{ message: string }>(`contributions/${id}/reject`, { reason }),

  requestChanges: (id: string, message: string) =>
    api.post<{ message: string }>(`contributions/${id}/request-changes`, { message }),

  promote: (id: string) =>
    api.post<{ message: string; patterns: string[]; promoted_by: string }>(`contributions/${id}/promote`),
};

// ── LLM / Groq endpoints ───────────────────────────────────────────────────

export interface LLMCosts {
  total_cost_usd: number;
  calls_total: number;
  avg_latency_ms: number;
  daily_budget_usd: number;
  monthly_budget_usd: number;
  daily_used_pct: number;
  monthly_used_pct: number;
  by_model: Record<string, { cost: number; calls: number }>;
  cost_trend: Array<{ date: string; cost: number }>;
}

export interface LLMConfig {
  llm_enabled: boolean;
  llm_primary_model: string;
  llm_fast_model: string;
  llm_long_context_model: string;
  llm_confidence_threshold: number;
  llm_daily_budget_usd: number;
  llm_monthly_budget_usd: number;
  llm_enabled_for_free: boolean;
  llm_enabled_for_pro: boolean;
  llm_enabled_for_team: boolean;
  llm_calls_per_day_pro: number;
  llm_calls_per_day_team: number;
  groq_api_key_set: boolean;
}

export const llmApi = {
  getCosts: (period: "today" | "7d" | "30d" = "30d") =>
    api.get<LLMCosts>(`groq/costs?period=${period}`),

  getConfig: () => api.get<LLMConfig>("groq/config"),

  updateConfig: (data: Partial<Omit<LLMConfig, "groq_api_key_set">>) =>
    api.put<{ message: string; updated: string[] }>("groq/config", data),

  updateApiKey: (api_key: string) =>
    api.put<{ message: string }>("groq/api-key", { api_key }),
};

// ── Audit log endpoints ────────────────────────────────────────────────────

export interface AuditLog {
  id: string;
  timestamp: string;
  admin_email: string;
  admin_ip: string;
  action: string;
  category: string;
  target_type?: string;
  target_id?: string;
  result: "success" | "failure";
  details?: Record<string, unknown>;
}

export interface AuditLogsResponse {
  logs: AuditLog[];
  total: number;
  page: number;
  page_size: number;
}

export const auditApi = {
  getLogs: (filters: Record<string, string | number> = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(filters).map(([k, v]) => [k, String(v)])),
    );
    const queryString = qs.toString();
    return api.get<AuditLogsResponse>(`audit/logs${queryString ? `?${queryString}` : ""}`);
  },

  getAlerts: () => api.get<unknown[]>("audit/alerts"),
};

// ── Config endpoints ───────────────────────────────────────────────────────

export interface ConfigEntry {
  key: string;
  value: unknown;
  category: string;
  description?: string;
  updated_at?: string;
  updated_by?: string;
}

export const configApi = {
  getAll: () => api.get<ConfigEntry[]>("config/"),
  get: (key: string) => api.get<ConfigEntry>(`config/${key}`),
  set: (key: string, value: unknown) => api.put(`config/${key}`, { value }),
  reload: () => api.post("config/reload"),
};

// ── Announcements endpoints ────────────────────────────────────────────────

export interface Announcement {
  id: string;
  type: "info" | "warning" | "maintenance" | "feature" | "billing";
  title: string;
  message: string;
  target_tiers: string[];
  dismissible: boolean;
  show_from: string;
  show_until?: string;
  cta_text?: string;
  cta_url?: string;
  active: boolean;
}

export const announcementsApi = {
  list: () => api.get<Announcement[]>("announcements/"),
  create: (data: Omit<Announcement, "id">) => api.post<Announcement>("announcements", data),
  update: (id: string, data: Partial<Announcement>) =>
    api.put<Announcement>(`announcements/${id}`, data),
  delete: (id: string) => api.del(`announcements/${id}`),
};

// ── Email endpoints ────────────────────────────────────────────────────────

export interface EmailTemplate {
  id: string;
  label: string;
  description: string;
  vars: string[];
}

export interface EmailSendRequest {
  to: string[];
  template: string;
  subject?: string;
  body?: string;
  username?: string;
}

export interface EmailSendResult {
  sent: number;
  failed: number;
  recipients: string[];
}

export interface EmailBroadcastRequest {
  segment: "all" | "free" | "pro" | "team";
  template: string;
  subject?: string;
  body?: string;
  dry_run?: boolean;
}

export interface EmailStats {
  sent_total: number;
  failed_total: number;
  success_rate: number | null;
}

export const emailApi = {
  getTemplates: () => api.get<EmailTemplate[]>("email/templates"),

  previewUrl: (
    template: string,
    params: { username?: string; subject?: string; body?: string; analyses_used?: number; limit?: number }
  ) => {
    const qs = new URLSearchParams({ username: "alex", ...Object.fromEntries(
      Object.entries(params).map(([k, v]) => [k, String(v)])
    )});
    return `${API_URL}/admin/email/preview/${template}?${qs}`;
  },

  send: (req: EmailSendRequest) =>
    api.post<EmailSendResult>("email/send", req),

  broadcast: (req: EmailBroadcastRequest) =>
    api.post<{ message: string; recipient_count: number; segment: string }>("email/broadcast", req),

  getStats: () => api.get<EmailStats>("email/stats"),
};

// ── Feedback Hub (admin) endpoints ────────────────────────────────────────────

export interface AdminFeedback {
  id: string;
  type: "feature_request" | "bug_report" | "improvement" | "other";
  title: string;
  description: string;
  status: "open" | "in_review" | "planned" | "done" | "declined";
  priority: string | null;
  author_github: string;
  author_tier: string;
  url_or_page: string | null;
  admin_reply: string | null;
  admin_replied_by: string | null;
  admin_replied_at: string | null;
  upvotes: number;
  created_at: string;
  updated_at: string;
}

export interface FeedbackListResponse {
  items: AdminFeedback[];
  total: number;
  page: number;
  per_page: number;
}

export interface FeedbackStats {
  total: number;
  open: number;
  by_status: Record<string, number>;
  by_type: Record<string, number>;
}

export const feedbackHubApi = {
  getStats: () => api.get<FeedbackStats>("feedback-hub/stats"),

  list: (params: Record<string, string | number> = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
    );
    const queryString = qs.toString();
    return api.get<FeedbackListResponse>(`feedback-hub/${queryString ? `?${queryString}` : ""}`);
  },

  get: (id: string) => api.get<AdminFeedback>(`feedback-hub/${id}`),

  update: (id: string, data: { status?: string; admin_reply?: string }) =>
    api.patch<{ message: string }>(`feedback-hub/${id}`, data),

  delete: (id: string) => api.del(`feedback-hub/${id}`),
};

// ── Billing endpoints ──────────────────────────────────────────────────────

export interface BillingRevenue {
  mrr_usd: number;
  arr_usd: number;
  mrr_change_pct: number;
  churn_rate_pct: number;
  by_plan: Record<string, { users: number; revenue: number }>;
  mobile_money: Record<string, { users: number; revenue: number }>;
}

export const billingApi = {
  getRevenue: (period?: string) =>
    api.get<BillingRevenue>(`billing/revenue${period ? `?period=${period}` : ""}`),

  getTransactions: () => api.get<unknown[]>("billing/transactions"),

  getFailedPayments: () => api.get<unknown[]>("billing/failed"),

  sendRecoveryEmails: () => api.post("billing/recovery-emails"),
};

// ── Notifications ──────────────────────────────────────────────────────────────

export interface NotificationStats {
  total_notifications: number;
  total_unread: number;
  by_type: Array<{
    _id: string;
    count: number;
    unread_count: number;
  }>;
  recent_notifications: Array<{
    user_id: string;
    type: string;
    title: string;
    created_at: string;
    read: boolean;
  }>;
}

export interface SystemNotificationRequest {
  title: string;
  message: string;
  type: string;
  target_tiers: string[];
  expires_hours?: number;
}

export async function getNotificationStats(): Promise<NotificationStats> {
  return adminFetch<NotificationStats>("notifications/stats");
}

export async function sendSystemNotification(data: SystemNotificationRequest): Promise<{
  ok: boolean;
  notifications_sent: number;
  target_users: number;
  message: string;
}> {
  return adminFetch("notifications/system", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ── Learning / Auto-promote endpoints ──────────────────────────────────────

export type CandidateStatus =
  | "pending"
  | "ready_for_review"
  | "approved"
  | "promoted"
  | "auto_promoted"
  | "rejected";

export interface LearningCandidate {
  id: string;
  llm_pattern_id: string;
  llm_error_type?: string;
  llm_category?: string;
  llm_confidence: number;
  llm_causal_hint?: string;
  unmatched_count: number;
  status: CandidateStatus;
  example_log_snippet?: string;
  suggested_regex?: string;
  extracted_keywords?: string[];
  pattern_data?: Record<string, unknown>;
  validation_errors?: string[];
  generation_model?: string;
  generation_latency_ms?: number;
  last_generation_at?: string;
  last_generation_triggered_by?: string;
  admin_notes?: string;
  promoted_pattern_id?: string;
  created_at?: string;
  last_seen_at?: string;
}

export interface LearningStats {
  by_status: Record<string, { count: number; avg_seen: number }>;
  top_pending_by_frequency: Pick<
    LearningCandidate,
    "id" | "llm_pattern_id" | "unmatched_count" | "llm_confidence" | "llm_category"
  >[];
  total: number;
}

export interface CandidateListResponse {
  items: LearningCandidate[];
  total: number;
  page: number;
  page_size: number;
}

export interface GeneratePatternResult {
  success: boolean;
  pattern_data?: Record<string, unknown>;
  validation_errors?: string[];
  is_valid?: boolean;
  model?: string;
  input_tokens?: number;
  output_tokens?: number;
  latency_ms?: number;
  error?: string;
}

export interface ValidateRegexResult {
  valid_regex: boolean;
  compile_error?: string;
  regex?: string;
  all_matched?: boolean;
  examples_tested?: number;
  results?: Array<{
    source: string;
    matched: boolean;
    snippet_preview: string;
  }>;
}

export interface LearningJob {
  type: string;
  triggered_by?: string;
  triggered_at?: string;
  status?: string;
  outcome?: string;
  summary?: Record<string, unknown>;
  details?: Record<string, unknown>;
  completed_at?: string;
  started_at?: string;
  error?: string;
  updated_at?: string;
  created_at?: string;
  candidate_id?: string;
}

export interface LearningJobsResponse {
  items: LearningJob[];
  total: number;
  page: number;
  page_size: number;
}

export const learningApi = {
  getStats: () =>
    api.get<LearningStats>("learning/stats"),

  listCandidates: (status?: string, page = 1, pageSize = 50) => {
    const qs = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
    if (status) qs.set("status", status);
    return api.get<CandidateListResponse>(`learning/candidates?${qs}`);
  },

  getCandidate: (id: string) =>
    api.get<LearningCandidate>(`learning/candidates/${id}`),

  updateCandidate: (id: string, data: { pattern_data?: Record<string, unknown>; notes?: string }) =>
    api.patch<{ message: string }>(`learning/candidates/${id}`, data),

  approve: (id: string) =>
    api.post<{ message: string }>(`learning/candidates/${id}/approve`),

  promote: (id: string) =>
    api.post<{ message: string; pattern_id: string; promoted_by: string }>(
      `learning/candidates/${id}/promote`,
    ),

  reject: (id: string) =>
    api.post<{ message: string }>(`learning/candidates/${id}/reject`),

  generatePattern: (id: string) =>
    api.post<GeneratePatternResult>(`learning/candidates/${id}/generate-pattern`),

  validateRegex: (id: string) =>
    api.get<ValidateRegexResult>(`learning/candidates/${id}/validate-regex`),

  listJobs: (jobType?: string, page = 1, pageSize = 30) => {
    const qs = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
    if (jobType) qs.set("type", jobType);
    return api.get<LearningJobsResponse>(`learning/jobs?${qs}`);
  },

  triggerAutoPromote: () =>
    api.post<{ message: string; job_id: string; triggered_by: string }>(
      "learning/trigger-auto-promote",
    ),

  triggerRerank: () =>
    api.post<{ message: string; triggered_by: string }>("learning/trigger-rerank"),

  triggerCluster: () =>
    api.post<{ message: string; triggered_by: string }>("learning/trigger-cluster"),
};

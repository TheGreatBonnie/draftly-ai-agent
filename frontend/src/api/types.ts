export interface Review {
  id: string;
  doc_id: string;
  reviewer_id: string;
  status: "pending" | "approved" | "rejected" | "needs_changes";
  reviewer_feedback: string | null;
  edits_made: unknown;
  confidence_before: number | null;
  confidence_after: number | null;
  thread_id: string | null;
  created_at: string;
  completed_at: string | null;
  title: string;
  content: string;
  doc_type: string;
  confidence_score: number;
}

export interface ReviewDecision {
  decision: "approve" | "reject" | "revise";
  feedback: string;
}

export interface Reviewer {
  id: string;
  org_id: string;
  org_name?: string;
  name: string;
  email: string | null;
  slack_user_id: string | null;
  discord_user_id: string | null;
  notify_slack: boolean;
  notify_discord: boolean;
  notify_email: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateReviewerPayload {
  org_id?: string;
  name: string;
  email?: string;
  slack_user_id?: string;
  discord_user_id?: string;
  notify_slack?: boolean;
  notify_discord?: boolean;
  notify_email?: boolean;
}

export interface UpdateReviewerPayload {
  name?: string;
  email?: string;
  slack_user_id?: string;
  discord_user_id?: string;
  notify_slack?: boolean;
  notify_discord?: boolean;
  notify_email?: boolean;
  is_active?: boolean;
}

export interface Doc {
  id: string;
  org_id: string;
  title: string;
  content: string;
  doc_type: string;
  version: number;
  status: string;
  source_thread_id: string | null;
  confidence_score: number;
  published_to: unknown;
  created_at: string;
  updated_at: string;
}

export interface MemoryStats {
  support_threads: number;
  documentation: number;
  embeddings: number;
  review_sessions: number;
  agent_memory: number;
  audit_logs: number;
}

export interface SearchResult {
  content_type: string;
  content_id: string;
  content_text: string;
  score: number;
  metadata: unknown;
}

export interface KnowledgeDoc {
  id: string;
  title: string;
  content: string;
  doc_type: string;
  version: number;
  status: string;
  confidence_score: number;
  created_at: string;
  updated_at: string;
}

export interface IngestKnowledgePayload {
  title: string;
  content: string;
  doc_type: string;
}

export interface GitHubInstallation {
  id: string;
  installation_id: number;
  github_org: string;
  repositories: { full_name: string; id: number }[];
  created_at: string;
  updated_at: string;
  org_name: string;
}

export interface GitHubInstallUrl {
  install_url: string;
}

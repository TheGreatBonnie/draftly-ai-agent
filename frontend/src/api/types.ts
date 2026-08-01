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
  original_question: string | null;
  platform: string | null;
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
  clerk_user_id: string | null;
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

export interface OrgMember {
  membership_id: string;
  user_id: string;
  email: string;
  role: string;
  role_name: string;
}

export interface AssignRolePayload {
  user_id: string;
  role: string;
}

export interface SelfRegisterPayload {
  slack_user_id?: string;
  discord_user_id?: string;
  notify_slack?: boolean;
  notify_discord?: boolean;
  notify_email?: boolean;
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
  workflow_id: string | null;
  confidence_score: number;
  published_to: unknown;
  created_at: string;
  updated_at: string;
  original_question: string | null;
  platform: string | null;
}

export interface MemoryStats {
  support_threads: number;
  documentation: number;
  embeddings: number;
  review_sessions: number;
  agent_memory: number;
  audit_logs: number;
  platform_counts?: PlatformCounts;
  active_workflows?: number;
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
  source_url?: string;
}

export interface FetchUrlResponse {
  url: string;
  title: string;
  content: string;
  source_type: string;
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

export interface SlackInstallation {
  id: string;
  team_id: string;
  team_name: string;
  bot_user_id: string;
  created_at: string;
  updated_at: string;
  org_name: string;
}

export interface DiscordStatus {
  connected: boolean;
  guild_id: string | null;
}

export interface DiscordInviteUrl {
  invite_url: string;
}

export interface DiscordChannel {
  id: string;
  name: string;
  type: number;
}

export interface DiscordTriggerChannels {
  channels: string[];
}

export interface ImprovementProposal {
  id: string;
  org_id: string;
  improvement_type: "prompt" | "rubric" | "tool";
  proposed_changes: Record<string, unknown>;
  rationale: string;
  status: "pending" | "approved" | "rejected" | "applied" | "failed";
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface PromptVersion {
  id: string;
  org_id: string;
  node_name: string;
  prompt_text: string;
  version: number;
  is_active: boolean;
}

export interface RubricVersion {
  id: string;
  org_id: string;
  criterion_name: string;
  criterion_text: string;
  version: number;
  is_active: boolean;
}

export interface ToolConfig {
  id: string;
  org_id: string;
  name: string;
  description: string;
  implementation_type: string;
  config: Record<string, unknown>;
  enabled: boolean;
  version: number;
}

export interface ActivityEvent {
  id: string;
  actor: "agent" | "human" | "system";
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  platform: string;
  channel: string | null;
  source: string;
  summary: string;
  details: Record<string, unknown>;
  created_at: string;
}

export interface PlatformCounts {
  slack?: number;
  discord?: number;
  github?: number;
  cli?: number;
  system?: number;
  [key: string]: number | undefined;
}

export type EventLevel = "info" | "warning" | "error";

export interface AgentEvent {
  event_type: string;
  level: EventLevel;
  workflow_id: string | null;
  details: Record<string, unknown>;
  created_at: string | null;
}

export interface EventSummary {
  last_1h: Partial<Record<EventLevel, number>>;
  last_24h: Partial<Record<EventLevel, number>>;
}

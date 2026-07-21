import { request } from "./client";
import type { GitHubInstallation, GitHubInstallUrl } from "./types";

export async function getInstallUrl(): Promise<GitHubInstallUrl> {
  return request<GitHubInstallUrl>("/github/install-url");
}

export async function listInstallations(): Promise<GitHubInstallation[]> {
  return request<GitHubInstallation[]>("/github/installations");
}

export async function linkGitHubInstallation(
  installationId: number,
): Promise<{ status: string; github_org: string }> {
  return request("/github/link", {
    method: "POST",
    body: JSON.stringify({ installation_id: installationId }),
  });
}

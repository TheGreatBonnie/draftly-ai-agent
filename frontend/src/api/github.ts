import { request } from "./client";
import type { GitHubInstallation, GitHubInstallUrl } from "./types";

export async function getInstallUrl(): Promise<GitHubInstallUrl> {
  return request<GitHubInstallUrl>("/github/install-url");
}

export async function listInstallations(): Promise<GitHubInstallation[]> {
  return request<GitHubInstallation[]>("/github/installations");
}

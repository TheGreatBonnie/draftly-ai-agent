import { request } from "./client";
import type { SlackInstallation } from "./types";

export async function getSlackInstallUrl(): Promise<{ install_url: string }> {
  return request("/slack/install-url");
}

export async function listSlackInstallations(): Promise<SlackInstallation[]> {
  return request<SlackInstallation[]>("/slack/installations");
}

export async function linkSlackInstallation(
  teamId: string,
): Promise<{ status: string; team_id: string }> {
  return request("/slack/link", {
    method: "POST",
    body: JSON.stringify({ team_id: teamId }),
  });
}

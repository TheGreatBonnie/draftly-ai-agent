import { request } from "./client";
import type { SlackInstallation } from "./types";

export async function listSlackInstallations(): Promise<SlackInstallation[]> {
  return request<SlackInstallation[]>("/slack/installations");
}

import { request } from "./client";
import type { DiscordInviteUrl, DiscordStatus } from "./types";

export async function getDiscordInviteUrl(): Promise<DiscordInviteUrl> {
  return request<DiscordInviteUrl>("/discord/invite-url");
}

export async function getDiscordStatus(): Promise<DiscordStatus> {
  return request<DiscordStatus>("/discord/status");
}

export async function linkDiscordGuild(
  guildId: string,
): Promise<{ status: string; guild_id: string }> {
  return request("/discord/link", {
    method: "POST",
    body: JSON.stringify({ guild_id: guildId }),
  });
}

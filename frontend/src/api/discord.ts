import { request } from "./client";
import type {
  DiscordChannel,
  DiscordInviteUrl,
  DiscordStatus,
  DiscordTriggerChannels,
} from "./types";

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

export async function getDiscordChannels(): Promise<{ channels: DiscordChannel[] }> {
  return request("/discord/channels");
}

export async function getTriggerChannels(): Promise<DiscordTriggerChannels> {
  return request<DiscordTriggerChannels>("/discord/trigger-channels");
}

export async function setTriggerChannels(
  channels: string[],
): Promise<DiscordTriggerChannels> {
  return request("/discord/trigger-channels", {
    method: "POST",
    body: JSON.stringify({ channels }),
  });
}

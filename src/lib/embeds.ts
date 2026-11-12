import { EmbedBuilder } from "discord.js";

export const COLORS = {
  success: 0x2ecc71,
  info: 0x3498db,
  warning: 0xe67e22,
  error: 0xe74c3c,
  neutral: 0x95a5a6,
} as const;

export function errorEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder().setColor(COLORS.error).setTitle(`❌ ${title}`).setDescription(description);
}

export function infoEmbed(title: string, description?: string): EmbedBuilder {
  const embed = new EmbedBuilder().setColor(COLORS.info).setTitle(title);
  if (description) embed.setDescription(description);
  return embed;
}

import {
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { deleteGame, getGame } from "../db/games";
import { COLORS, errorEmbed } from "../lib/embeds";
import { formatDateTime, formatScore, rankEmoji } from "../lib/format";
import { seatName } from "../lib/rules";
import type { Command } from "./types";

export const data = new SlashCommandBuilder()
  .setName("undo")
  .setDescription("記録した半荘を取り消します")
  .setContexts(InteractionContextType.Guild)
  .addIntegerOption((option) =>
    option
      .setName("game_id")
      .setDescription("取り消すゲームID（/record や /history に表示されます）")
      .setRequired(true)
      .setMinValue(1),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({
      embeds: [errorEmbed("エラー", "このコマンドはサーバー内でのみ利用できます。")],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const gameId = interaction.options.getInteger("game_id", true);
  const game = getGame(guild.id, gameId);

  if (!game) {
    await interaction.reply({
      embeds: [errorEmbed("ゲームが見つかりません", `ゲームID **${gameId}** はこのサーバーに存在しません。`)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const canManage = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ?? false;
  if (game.reporterId !== interaction.user.id && !canManage) {
    await interaction.reply({
      embeds: [
        errorEmbed(
          "権限がありません",
          "取り消せるのは記録した本人、または「サーバー管理」権限を持つユーザーだけです。",
        ),
      ],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const deleted = deleteGame(guild.id, gameId);
  if (!deleted) {
    await interaction.reply({
      embeds: [errorEmbed("エラー", "ゲームの削除に失敗しました。もう一度お試しください。")],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const sorted = [...deleted.players].sort((a, b) => a.rank - b.rank);
  const embed = new EmbedBuilder()
    .setColor(COLORS.warning)
    .setTitle(`🗑️ ゲーム #${deleted.id} を取り消しました`)
    .setDescription(`${formatDateTime(deleted.playedAt)} の半荘を削除しました。`)
    .addFields(
      sorted.map((player) => ({
        name: `${rankEmoji(player.rank)} ${player.displayName.slice(0, 80)}（${seatName(player.seat)}）`,
        value: `**${formatScore(player.score)}点**`,
        inline: true,
      })),
    );

  await interaction.reply({ embeds: [embed] });
}

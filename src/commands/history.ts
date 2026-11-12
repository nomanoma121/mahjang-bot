import {
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { getPlayerHistory } from "../db/games";
import { COLORS, infoEmbed } from "../lib/embeds";
import { formatDateTime, formatScore, rankEmoji } from "../lib/format";
import type { Command } from "./types";

export const data = new SlashCommandBuilder()
  .setName("history")
  .setDescription("直近の対戦履歴を表示します")
  .setContexts(InteractionContextType.Guild)
  .addUserOption((option) =>
    option.setName("user").setDescription("履歴を表示するプレイヤー（省略時は自分）"),
  )
  .addIntegerOption((option) =>
    option
      .setName("limit")
      .setDescription("表示件数（省略時は10件）")
      .addChoices(
        { name: "5件", value: 5 },
        { name: "10件", value: 10 },
        { name: "20件", value: 20 },
      ),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({
      embeds: [infoEmbed("エラー", "このコマンドはサーバー内でのみ利用できます。")],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const target = interaction.options.getUser("user") ?? interaction.user;
  const limit = interaction.options.getInteger("limit") ?? 10;
  const history = getPlayerHistory(guild.id, target.id, limit);

  if (history.length === 0) {
    await interaction.reply({
      embeds: [
        infoEmbed(
          "対戦履歴がありません",
          `${target.displayName} の戦績はまだ記録されていません。\n\`/record\` で半荘を記録できます。`,
        ),
      ],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(COLORS.info)
    .setTitle(`📜 ${target.displayName} の対戦履歴`)
    .setDescription(`直近 ${history.length} 半荘`)
    .addFields(
      history.map((entry) => ({
        name: `#${entry.gameId} ・ ${formatDateTime(entry.playedAt)} ・ ${rankEmoji(entry.rank)}${entry.rank}位`,
        value: `**${formatScore(entry.score)}点**\n卓: ${entry.opponents
          .map((opponent) => `${opponent.displayName}（${opponent.rank}位）`)
          .join(" / ")}`,
      })),
    )
    .setFooter({ text: "表示名は記録時点のものです" });

  await interaction.reply({ embeds: [embed] });
}

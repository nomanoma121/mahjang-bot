import {
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { getPlayerStats } from "../db/games";
import { COLORS, infoEmbed } from "../lib/embeds";
import {
  formatAverageScore,
  formatPercent,
  formatScore,
  percentBar,
  rankEmoji,
} from "../lib/format";
import { resolvePeriod, type Period } from "../lib/stats";
import type { Command } from "./types";

export const data = new SlashCommandBuilder()
  .setName("stats")
  .setDescription("個人の戦績を表示します")
  .setContexts(InteractionContextType.Guild)
  .addUserOption((option) =>
    option.setName("user").setDescription("集計するプレイヤー（省略時は自分）"),
  )
  .addStringOption((option) =>
    option
      .setName("period")
      .setDescription("集計期間（省略時は全期間）")
      .addChoices(
        { name: "全期間", value: "all" },
        { name: "今月", value: "month" },
        { name: "直近50半荘", value: "recent50" },
        { name: "直近100半荘", value: "recent100" },
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
  const period = (interaction.options.getString("period") ?? "all") as Period;
  const stats = getPlayerStats(guild.id, target.id, period);
  const periodQuery = resolvePeriod(period);
  const displayName = stats.displayName ?? target.displayName;

  if (stats.games === 0) {
    await interaction.reply({
      embeds: [
        infoEmbed(
          "戦績がありません",
          `${displayName} の戦績はまだ記録されていません。\n\`/record\` で半荘を記録できます。`,
        ),
      ],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const rankLines = stats.rankCounts
    .map((count, index) => {
      const ratio = count / stats.games;
      return `${rankEmoji(index + 1)} \`${percentBar(ratio)}\` ${formatPercent(ratio)} (${count})`;
    })
    .join("\n");

  const embed = new EmbedBuilder()
    .setColor(COLORS.info)
    .setTitle(`📊 ${displayName} の戦績`)
    .setDescription(`${periodQuery.label} の集計結果です。`)
    .addFields(
      {
        name: "対戦成績",
        value: `対戦数 **${stats.games}**\n平均順位 **${stats.avgRank.toFixed(2)}**`,
        inline: true,
      },
      {
        name: "スコア",
        value: `合計 **${formatScore(stats.totalScore)}点**\n平均 **${formatAverageScore(stats.avgScore)}点**`,
        inline: true,
      },
      {
        name: "順位率",
        value: rankLines,
      },
    )
    .setFooter({ text: "順位は点数順（同点は起家優先）" });

  await interaction.reply({ embeds: [embed] });
}

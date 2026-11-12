import {
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { getRanking, type RankingEntry, type RankingPeriod } from "../db/games";
import { COLORS, infoEmbed } from "../lib/embeds";
import { formatAverageScore, formatPercent, formatScore, rankEmoji } from "../lib/format";
import { PERIOD_LABELS } from "../lib/stats";
import type { Command } from "./types";

type RankingSort = "avg_rank" | "avg_score" | "total_score" | "first_rate" | "games";

const SORT_LABELS: Record<RankingSort, string> = {
  avg_rank: "平均順位",
  avg_score: "平均点数",
  total_score: "合計点数",
  first_rate: "1位率",
  games: "対戦数",
};

function firstRate(entry: RankingEntry): number {
  return entry.games > 0 ? entry.rankCounts[0] / entry.games : 0;
}

const SORTERS: Record<RankingSort, (a: RankingEntry, b: RankingEntry) => number> = {
  avg_rank: (a, b) => a.avgRank - b.avgRank || b.games - a.games,
  avg_score: (a, b) => b.avgScore - a.avgScore || b.games - a.games,
  total_score: (a, b) => b.totalScore - a.totalScore || b.games - a.games,
  first_rate: (a, b) => firstRate(b) - firstRate(a) || b.games - a.games,
  games: (a, b) => b.games - a.games || a.avgRank - b.avgRank,
};

export const data = new SlashCommandBuilder()
  .setName("ranking")
  .setDescription("サーバー内のランキングを表示します")
  .setContexts(InteractionContextType.Guild)
  .addStringOption((option) =>
    option
      .setName("sort")
      .setDescription("並び順（省略時は平均順位）")
      .addChoices(
        { name: "平均順位", value: "avg_rank" },
        { name: "平均点数", value: "avg_score" },
        { name: "合計点数", value: "total_score" },
        { name: "1位率", value: "first_rate" },
        { name: "対戦数", value: "games" },
      ),
  )
  .addStringOption((option) =>
    option
      .setName("period")
      .setDescription("集計期間（省略時は全期間）")
      .addChoices(
        { name: "全期間", value: "all" },
        { name: "今月", value: "month" },
      ),
  )
  .addIntegerOption((option) =>
    option
      .setName("min_games")
      .setDescription("ランキングに含める最低対戦数（省略時は1）")
      .setMinValue(1)
      .setMaxValue(100),
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

  const sort = (interaction.options.getString("sort") ?? "avg_rank") as RankingSort;
  const period = (interaction.options.getString("period") ?? "all") as RankingPeriod;
  const minGames = interaction.options.getInteger("min_games") ?? 1;

  const allEntries = getRanking(guild.id, period, minGames).sort(SORTERS[sort]);
  const entries = allEntries.slice(0, 15);

  if (entries.length === 0) {
    await interaction.reply({
      embeds: [
        infoEmbed(
          "ランキングがありません",
          `条件に合うプレイヤーがいません。\`min_games\` を下げるか、\`/record\` で半荘を記録してください。`,
        ),
      ],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const lines = entries.map((entry, index) => {
    const prefix = index < 3 ? rankEmoji(index + 1) : `${index + 1}.`;
    return `${prefix} **${entry.displayName}** — 平均${entry.avgRank.toFixed(2)} / ${formatAverageScore(entry.avgScore)}点/戦 / 合計${formatScore(entry.totalScore)}点 / ${entry.games}戦 / 1位${formatPercent(firstRate(entry))}`;
  });

  const embed = new EmbedBuilder()
    .setColor(COLORS.info)
    .setTitle(`🏆 ${guild.name} ランキング`)
    .setDescription(
      `並び順: **${SORT_LABELS[sort]}** ・ 期間: **${PERIOD_LABELS[period]}** ・ 最低${minGames}戦\n\n${lines.join("\n")}`,
    )
    .setFooter({ text: `対象 ${allEntries.length}人 ・ 上位${entries.length}人を表示` });

  await interaction.reply({ embeds: [embed] });
}

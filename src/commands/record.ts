import {
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type User,
} from "discord.js";
import { recordGame } from "../db/games";
import { COLORS, errorEmbed } from "../lib/embeds";
import { formatDateTime, formatScore, rankEmoji } from "../lib/format";
import { PLAYER_COUNT, seatName, validateScores } from "../lib/rules";
import type { Command } from "./types";

function resolveDisplayName(
  interaction: ChatInputCommandInteraction,
  user: User,
  index: number,
): string {
  const member = interaction.options.getMember(`player${index + 1}`);
  if (member && "displayName" in member && member.displayName) {
    return member.displayName;
  }
  return user.displayName;
}

export const data = new SlashCommandBuilder()
  .setName("record")
  .setDescription("半荘の戦績を4人分まとめて記録します")
  .setContexts(InteractionContextType.Guild)
  .addUserOption((option) =>
    option.setName("player1").setDescription("起家のプレイヤー").setRequired(true),
  )
  .addIntegerOption((option) =>
    option
      .setName("score1")
      .setDescription("player1の最終持ち点")
      .setRequired(true)
      .setMinValue(-100_000)
      .setMaxValue(200_000),
  )
  .addUserOption((option) =>
    option.setName("player2").setDescription("南家のプレイヤー").setRequired(true),
  )
  .addIntegerOption((option) =>
    option
      .setName("score2")
      .setDescription("player2の最終持ち点")
      .setRequired(true)
      .setMinValue(-100_000)
      .setMaxValue(200_000),
  )
  .addUserOption((option) =>
    option.setName("player3").setDescription("西家のプレイヤー").setRequired(true),
  )
  .addIntegerOption((option) =>
    option
      .setName("score3")
      .setDescription("player3の最終持ち点")
      .setRequired(true)
      .setMinValue(-100_000)
      .setMaxValue(200_000),
  )
  .addUserOption((option) =>
    option.setName("player4").setDescription("北家のプレイヤー").setRequired(true),
  )
  .addIntegerOption((option) =>
    option
      .setName("score4")
      .setDescription("player4の最終持ち点")
      .setRequired(true)
      .setMinValue(-100_000)
      .setMaxValue(200_000),
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

  const users: User[] = [];
  const scores: number[] = [];
  const displayNames: string[] = [];

  for (let index = 0; index < PLAYER_COUNT; index++) {
    const user = interaction.options.getUser(`player${index + 1}`, true);
    users.push(user);
    scores.push(interaction.options.getInteger(`score${index + 1}`, true));
    displayNames.push(resolveDisplayName(interaction, user, index));
  }

  if (new Set(users.map((user) => user.id)).size !== PLAYER_COUNT) {
    await interaction.reply({
      embeds: [errorEmbed("入力エラー", "同じプレイヤーを複数回指定することはできません。")],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (users.some((user) => user.bot)) {
    await interaction.reply({
      embeds: [errorEmbed("入力エラー", "Botをプレイヤーとして登録することはできません。")],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const scoreError = validateScores(scores);
  if (scoreError) {
    await interaction.reply({
      embeds: [errorEmbed("点数の合計が合いません", scoreError)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const result = recordGame({
    guildId: guild.id,
    channelId: interaction.channelId,
    reporterId: interaction.user.id,
    playedAt: interaction.createdAt.toISOString(),
    players: users.map((user, index) => ({
      userId: user.id,
      displayName: displayNames[index] ?? user.displayName,
      score: scores[index] ?? 0,
    })),
  });

  const sorted = [...result.players].sort((a, b) => a.rank - b.rank);
  const embed = new EmbedBuilder()
    .setColor(COLORS.success)
    .setTitle("🀄 半荘を記録しました")
    .setDescription(
      `ゲームID: **${result.gameId}** ・ ${formatDateTime(interaction.createdAt.toISOString())}`,
    )
    .addFields(
      sorted.map((player) => ({
        name: `${rankEmoji(player.rank)} ${player.displayName.slice(0, 80)}（${seatName(player.seat)}）`,
        value: `**${formatScore(player.score)}点**`,
        inline: true,
      })),
    )
    .setFooter({
      text: `入力ミスの場合は /undo game_id:${result.gameId} で取り消せます`,
    });

  await interaction.reply({ embeds: [embed] });
}

import {
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { COLORS } from "../lib/embeds";
import type { Command } from "./types";

export const data = new SlashCommandBuilder()
  .setName("help")
  .setDescription("このBotの使い方を表示します")
  .setContexts(InteractionContextType.Guild);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const embed = new EmbedBuilder()
    .setColor(COLORS.info)
    .setTitle("🀄 麻雀戦績Bot の使い方")
    .setDescription(
      "現在は**順位と素点**のみ集計しています。ウマ・オカ・レーティング・詳細スタッツは未実装です。",
    )
    .addFields(
      {
        name: "/record",
        value:
          "半荘の戦績を4人分まとめて記録します。\n```\n/record player1:@A score1:45000 player2:@B score2:30000 player3:@C score3:25000 player4:@D score4:0\n```\n・`player1` が起家です。\n・点数の合計は 100,000点 にしてください。\n・順位は点数順、同点は起家に近い席が上位です。",
      },
      {
        name: "/stats [user] [period]",
        value:
          "個人の戦績を表示します。期間は全期間 / 今月 / 直近50・100半荘から選べます。",
      },
      {
        name: "/ranking [sort] [period] [min_games]",
        value:
          "サーバー内ランキングを表示します。平均順位・平均点数・合計点数・1位率・対戦数で並べ替えられます。",
      },
      {
        name: "/history [user] [limit]",
        value: "直近の対戦履歴を表示します。",
      },
      {
        name: "/undo game_id:<id>",
        value:
          "記録した半荘を取り消します。実行できるのは記録した本人、または「サーバー管理」権限を持つユーザーだけです。",
      },
    )
    .setFooter({ text: "ゲームIDは /record や /history の表示で確認できます" });

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

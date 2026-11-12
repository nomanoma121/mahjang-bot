import { REST, Routes } from "discord.js";
import { commands } from "./commands";

const token = Bun.env.DISCORD_TOKEN;
const clientId = Bun.env.DISCORD_CLIENT_ID;
const guildId = Bun.env.GUILD_ID;

if (!token || !clientId || !guildId) {
  console.error("DISCORD_TOKEN, DISCORD_CLIENT_ID, GUILD_ID を設定してください。");
  process.exit(1);
}

const body = commands.map((command) => command.data.toJSON());
const rest = new REST().setToken(token);

try {
  const data = await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body });
  const count = Array.isArray(data) ? data.length : 0;
  console.log(`${count}個のコマンドをサーバー ${guildId} に登録しました。`);
} catch (error) {
  console.error("コマンド登録に失敗しました:", error);
  process.exit(1);
}

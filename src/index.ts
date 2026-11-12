import {
  Client,
  Events,
  GatewayIntentBits,
  MessageFlags,
  type InteractionReplyOptions,
} from "discord.js";
import { commandMap } from "./commands";
import { db, migrate } from "./db";
import { errorEmbed } from "./lib/embeds";

const token = Bun.env.DISCORD_TOKEN;
if (!token) {
  console.error("DISCORD_TOKEN が設定されていません。.env を確認してください。");
  process.exit(1);
}

migrate();

let ready = false;
const port = Number(Bun.env.PORT ?? "3000");

const server = Bun.serve({
  hostname: "0.0.0.0",
  port,
  fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/healthz") {
      return new Response("ok", { headers: { "content-type": "text/plain" } });
    }
    if (url.pathname === "/readyz") {
      return new Response(ready ? "ready" : "starting", {
        status: ready ? 200 : 503,
        headers: { "content-type": "text/plain" },
      });
    }
    return new Response("not found", { status: 404 });
  },
});

console.log(`Health server listening on 0.0.0.0:${port}`);

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, (readyClient) => {
  ready = true;
  console.log(`Logged in as ${readyClient.user.tag}`);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (!interaction.guildId) {
    await interaction
      .reply({
        content: "このBotはサーバー内でのみ利用できます。",
        flags: MessageFlags.Ephemeral,
      })
      .catch(() => {});
    return;
  }

  const command = commandMap.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`[command:${interaction.commandName}]`, error);

    const payload: InteractionReplyOptions = {
      embeds: [
        errorEmbed("エラー", "処理中にエラーが発生しました。時間をおいてもう一度お試しください。"),
      ],
      flags: MessageFlags.Ephemeral,
    };

    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(payload).catch(() => {});
    } else {
      await interaction.reply(payload).catch(() => {});
    }
  }
});

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} を受信しました。終了します。`);

  ready = false;
  server.stop();
  await client.destroy();
  db.close();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

await client.login(token);

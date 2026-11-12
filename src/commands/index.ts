import * as help from "./help";
import * as history from "./history";
import * as ranking from "./ranking";
import * as record from "./record";
import * as stats from "./stats";
import type { Command } from "./types";
import * as undo from "./undo";

export const commands: readonly Command[] = [record, stats, ranking, history, undo, help];

export const commandMap = new Map(commands.map((command) => [command.data.name, command]));

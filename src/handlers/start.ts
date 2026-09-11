import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { mainMenuKeyboard } from "../toolkit/index.js";
import { adminChatId, isOwner } from "../toolkit/index.js";
import { dataFor, recordUser } from "../persona-state.js";

// The /start handler renders the bot's MAIN MENU — the primary way users operate
// a button-first bot. A feature adds its own button by calling
// `registerMainMenuItem(...)` in its own `src/handlers/<slug>.ts`; this handler
// renders whatever is registered (plus a Help button), so you do NOT edit this
// file to add a feature. Send ONE message — no placeholder line above the menu.
const composer = new Composer<Ctx>();

function welcome(sample: string): string {
  return `أهلًا بك. اكتب ما يدور في بالك وسأرد بالعربية باختصار.\nمثال: ${sample}\n\nهذه المحادثة ليست بديلًا عن المختص عند الحاجة.`;
}

composer.command("start", async (ctx) => {
  const { data, isNew } = recordUser(ctx, isOwner(ctx));
  await ctx.reply(welcome(data.persona.sampleReply), { reply_markup: mainMenuKeyboard() });
  // Notifications are opt-in and contain no conversation content. A blocked
  // owner must never prevent the new user from receiving their welcome.
  const owner = adminChatId(ctx as unknown as { env?: Record<string, unknown> });
  if (isNew && data.settings.notifyAdminOnNewChat && owner && owner !== String(ctx.chat?.id)) {
    try {
      await ctx.api.sendMessage(owner, "بدأت محادثة جديدة مع البوت.");
    } catch {
      // Telegram returns 403 when the target has not started or blocked the bot.
    }
  }
});

// "Back to menu" — re-render the main menu in place from any sub-view.
composer.callbackQuery("menu:main", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(welcome(dataFor(ctx).persona.sampleReply), { reply_markup: mainMenuKeyboard() });
});

export default composer;

import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, isOwner, registerMainMenuItem } from "../toolkit/index.js";
import { dataFor, personaCard } from "../persona-state.js";

registerMainMenuItem({ label: "عرض الشخصية", data: "persona:show", order: 10 });
const composer = new Composer<Ctx>();

composer.callbackQuery("persona:show", async (ctx) => {
  await ctx.answerCallbackQuery();
  const data = dataFor(ctx);
  const rows = isOwner(ctx)
    ? [[inlineButton("تعديل الشخصية", "persona:edit")], [inlineButton("إعدادات المالك", "persona:settings")], [inlineButton("العودة للقائمة", "menu:main")]]
    : [[inlineButton("العودة للقائمة", "menu:main")]];
  await ctx.editMessageText(personaCard(data), { reply_markup: inlineKeyboard(rows) });
});

export default composer;

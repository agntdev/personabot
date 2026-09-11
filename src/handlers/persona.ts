import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, isOwner, requireOwner } from "../toolkit/index.js";
import { clearHistory, dataFor, now, personaCard, updatePersona } from "../persona-state.js";

const composer = new Composer<Ctx>();
const ownerMessages = { unset: "إعداد وصول المالك غير جاهز بعد.", denied: "هذا الخيار متاح للمالك فقط." };

function cardKeyboard(ctx: Ctx) {
  return inlineKeyboard(isOwner(ctx)
    ? [[inlineButton("تعديل الشخصية", "persona:edit")], [inlineButton("إعدادات المالك", "persona:settings")], [inlineButton("العودة للقائمة", "menu:main")]]
    : [[inlineButton("العودة للقائمة", "menu:main")]]);
}

composer.command("persona", async (ctx) => {
  await ctx.reply(personaCard(dataFor(ctx)), { reply_markup: cardKeyboard(ctx) });
});

composer.callbackQuery("persona:edit", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!(await requireOwner(ctx, ownerMessages, false))) return;
  ctx.session.step = "awaiting_persona";
  ctx.session.flowExpiresAt = now() + 5 * 60 * 1000;
  await ctx.reply("أرسل نص الشخصية الجديد. اجعله واضحًا ولطيفًا، من 10 إلى 500 حرف.", {
    reply_markup: { force_reply: true, input_field_placeholder: "اكتب وصف الشخصية…" },
  });
});

composer.callbackQuery("persona:settings", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!(await requireOwner(ctx, ownerMessages, false))) return;
  const settings = dataFor(ctx).settings;
  await ctx.editMessageText(`احتفظ بآخر ${settings.retentionLimit} رسالة.\nتنبيهات المحادثات الجديدة: ${settings.notifyAdminOnNewChat ? "مفعّلة" : "متوقفة"}.`, {
    reply_markup: inlineKeyboard([
      [inlineButton("الاحتفاظ بـ10", "persona:keep:10"), inlineButton("الاحتفاظ بـ20", "persona:keep:20")],
      [inlineButton("مسح سجل هذه الدردشة", "persona:clear")],
      [inlineButton(settings.notifyAdminOnNewChat ? "إيقاف التنبيهات" : "تفعيل التنبيهات", "persona:notify")],
      [inlineButton("عرض الشخصية", "persona:show")],
    ]),
  });
});

composer.callbackQuery(/^persona:keep:(10|20)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!(await requireOwner(ctx, ownerMessages, false))) return;
  const data = dataFor(ctx);
  data.settings.retentionLimit = Number(ctx.match[1]);
  if (data.conversation.length > data.settings.retentionLimit) data.conversation.splice(0, data.conversation.length - data.settings.retentionLimit);
  await ctx.editMessageText(`سأحتفظ بآخر ${data.settings.retentionLimit} رسالة في هذه الدردشة.`, { reply_markup: inlineKeyboard([[inlineButton("إعدادات المالك", "persona:settings")]]) });
});

composer.callbackQuery("persona:clear", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!(await requireOwner(ctx, ownerMessages, false))) return;
  await ctx.editMessageText("سيُحذف سجل هذه الدردشة نهائيًا. هل تريد المتابعة؟", { reply_markup: inlineKeyboard([[inlineButton("مسح السجل", "persona:clear:yes"), inlineButton("رجوع", "persona:settings")]]) });
});

composer.callbackQuery("persona:clear:yes", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!(await requireOwner(ctx, ownerMessages, false))) return;
  clearHistory(dataFor(ctx));
  await ctx.editMessageText("تم مسح سجل هذه الدردشة.", { reply_markup: inlineKeyboard([[inlineButton("إعدادات المالك", "persona:settings")]]) });
});

composer.callbackQuery("persona:notify", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!(await requireOwner(ctx, ownerMessages, false))) return;
  const settings = dataFor(ctx).settings;
  settings.notifyAdminOnNewChat = !settings.notifyAdminOnNewChat;
  await ctx.editMessageText(settings.notifyAdminOnNewChat ? "فُعّلت تنبيهات المحادثات الجديدة." : "أُوقفت تنبيهات المحادثات الجديدة.", { reply_markup: inlineKeyboard([[inlineButton("إعدادات المالك", "persona:settings")]]) });
});

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step !== "awaiting_persona") return next();
  if (ctx.session.flowExpiresAt !== undefined && now() > ctx.session.flowExpiresAt) {
    ctx.session.step = "idle";
    ctx.session.flowExpiresAt = undefined;
    await ctx.reply("انتهت مهلة التعديل. افتح الشخصية وابدأ من جديد.");
    return;
  }
  if (!isOwner(ctx)) { ctx.session.step = "idle"; await ctx.reply("يمكن للمالك فقط تعديل الشخصية."); return; }
  const profile = ctx.message.text.trim();
  if (profile.length < 10 || profile.length > 500 || /(?:كراهية|تحريض|إيذاء)/.test(profile)) {
    await ctx.reply("لم أحفظ هذا النص. استخدم وصفًا لطيفًا بين 10 و500 حرف.");
    return;
  }
  updatePersona(dataFor(ctx), profile, ctx.from?.id);
  ctx.session.step = "idle";
  ctx.session.flowExpiresAt = undefined;
  await ctx.reply("تم حفظ الشخصية الجديدة. سأستخدمها في الردود القادمة.", { reply_markup: cardKeyboard(ctx) });
});

export default composer;

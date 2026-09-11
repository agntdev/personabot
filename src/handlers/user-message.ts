import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { isOwner } from "../toolkit/index.js";
import { addHistory, clipped, dataFor, generateReply, mayReply, now, recordUser } from "../persona-state.js";

const composer = new Composer<Ctx>();

composer.on("message:text", async (ctx) => {
  const text = ctx.message.text.trim();
  if (text.startsWith("/")) {
    await ctx.reply("لا أعرف هذا الأمر. اكتب رسالتك مباشرة أو استخدم /help.");
    return;
  }
  if (ctx.chat?.type !== "private") {
    const username = ctx.me.username;
    const mentionsBot = username ? text.toLowerCase().includes(`@${username.toLowerCase()}`) : false;
    if (!mentionsBot && !ctx.message.reply_to_message?.from?.is_bot) return;
  }
  const { data } = recordUser(ctx, isOwner(ctx));
  if (!mayReply(data)) { await ctx.reply("الرسائل كثيرة قليلًا. انتظر لحظة ثم أرسل رسالتك التالية."); return; }
  const userText = clipped(text);
  addHistory(data, { messageId: ctx.message.message_id, senderRole: "user", text: userText, timestamp: now() });
  const reply = generateReply(data, userText);
  await ctx.reply(reply, { message_thread_id: ctx.message.message_thread_id });
  addHistory(data, { messageId: 0, senderRole: "bot", text: reply, timestamp: now() });
});

export default composer;

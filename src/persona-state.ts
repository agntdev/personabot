import type { Ctx } from "./bot.js";

declare module "./bot.js" {
  interface Session {
    step?: "idle" | "awaiting_persona" | "awaiting_retention";
    flowExpiresAt?: number;
    /** Durable application records, written through the toolkit storage adapter. */
    personaData?: ChatData;
  }
}

export type Role = "user" | "bot";

export interface ConversationItem {
  messageId: number;
  senderRole: Role;
  text: string;
  timestamp: number;
}

export interface PersonaProfile {
  personaId: "default";
  ownerId?: number;
  language: "ar";
  tone: string;
  sampleReply: string;
  rawProfileText: string;
  lastUpdated: number;
}

export interface OwnerSettings {
  ownerChatId?: string;
  retentionLimit: number;
  notifyAdminOnNewChat: boolean;
  dailySummaryEnabled: boolean;
}

export interface ChatData {
  user?: { chatId: number; displayName: string; isOwnerFlag: boolean; lastActiveAt: number };
  conversation: ConversationItem[];
  persona: PersonaProfile;
  settings: OwnerSettings;
  rate?: { startedAt: number; count: number };
  started?: boolean;
}

const DEFAULT_PROFILE = "رفيق عربي دافئ ومختصر. استمع جيدًا، ورد بجملة أو جملتين مفيدتين وبالعربية دائمًا.";
const DEFAULT_SAMPLE = "أهلًا بك، أنا هنا لأساعدك بهدوء وبكلمات واضحة.";
const MAX_CONTEXT_TEXT = 600;

/** A single injectable clock seam for expiry, history, and rate decisions. */
export function now(): number {
  const injected = (globalThis as typeof globalThis & { __agntdevNow?: () => number }).__agntdevNow;
  return typeof injected === "function" ? injected() : Date.now();
}

function initialData(): ChatData {
  return {
    conversation: [],
    persona: {
      personaId: "default",
      language: "ar",
      tone: "دافئ ومختصر",
      sampleReply: DEFAULT_SAMPLE,
      rawProfileText: DEFAULT_PROFILE,
      lastUpdated: now(),
    },
    settings: { retentionLimit: 20, notifyAdminOnNewChat: false, dailySummaryEnabled: false },
  };
}

export function dataFor(ctx: Ctx): ChatData {
  return (ctx.session.personaData ??= initialData());
}

export function recordUser(ctx: Ctx, isOwner: boolean): { data: ChatData; isNew: boolean } {
  const data = dataFor(ctx);
  const chatId = ctx.chat?.id ?? 0;
  const isNew = !data.started;
  data.started = true;
  data.user = {
    chatId,
    displayName: ctx.from?.first_name?.trim() || "صديق",
    isOwnerFlag: isOwner,
    lastActiveAt: now(),
  };
  return { data, isNew };
}

export function clipped(text: string): string {
  const normal = text.trim().replace(/\s+/g, " ");
  return normal.length > MAX_CONTEXT_TEXT ? `${normal.slice(0, MAX_CONTEXT_TEXT)}…` : normal;
}

export function addHistory(data: ChatData, item: ConversationItem): void {
  data.conversation.push(item);
  const limit = Math.min(50, Math.max(1, data.settings.retentionLimit));
  if (data.conversation.length > limit) data.conversation.splice(0, data.conversation.length - limit);
}

export function clearHistory(data: ChatData): void {
  data.conversation = [];
}

export function mayReply(data: ChatData): boolean {
  const current = now();
  const windowMs = 10_000;
  if (!data.rate || current - data.rate.startedAt >= windowMs) {
    data.rate = { startedAt: current, count: 1 };
    return true;
  }
  data.rate.count += 1;
  return data.rate.count <= 8;
}

function excerpt(text: string): string {
  const clean = clipped(text);
  return clean.length > 80 ? `${clean.slice(0, 80)}…` : clean;
}

/** Local, deterministic generation: Arabic, concise, and anchored to the latest turn. */
export function generateReply(data: ChatData, incoming: string): string {
  const profile = data.persona.rawProfileText;
  const latestEarlier = [...data.conversation]
    .reverse()
    .find((entry) => entry.senderRole === "user" && entry.text !== incoming);
  const style = profile.includes("مرح") ? "بسرور" : profile.includes("رسمي") ? "بكل وضوح" : "بكل ود";
  const context = latestEarlier ? ` وتابعتُ حديثك عن «${excerpt(latestEarlier.text)}»` : "";
  return `${style}، فهمتُ أنك تقول: «${excerpt(incoming)}»${context}. كيف تحب أن نتابع؟`;
}

export function personaCard(data: ChatData): string {
  const updated = data.persona.lastUpdated === 0 ? "لم تُحدَّث بعد" : "محدَّثة";
  return `هذه شخصيتي الآن:\n${data.persona.rawProfileText}\n\nاللغة: العربية\nالنبرة: ${data.persona.tone}\nمثال: ${data.persona.sampleReply}\nالحالة: ${updated}.`;
}

export function updatePersona(data: ChatData, raw: string, ownerId?: number): void {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  data.persona = {
    personaId: "default",
    ownerId,
    language: "ar",
    tone: trimmed.length > 80 ? "مخصصة ودافئة" : "مخصصة ومختصرة",
    sampleReply: `بكل ود، سأرد وفق هذه الشخصية: ${excerpt(trimmed)}`,
    rawProfileText: trimmed,
    lastUpdated: now(),
  };
}

# Arabic Persona Chat — Bot specification

**Archetype:** content

**Voice:** warm and concise — write every user-facing message, button label, error, and empty state in this voice.

A lightweight Telegram chat bot that replies in concise, friendly Arabic using a short persona/profile per chat. It preserves recent message context, supports owner-editable persona text, offers simple commands (/start, /help, /persona) and inline buttons for discovery, and requires no external APIs by default.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- Arabic-speaking Telegram users seeking quick persona-driven conversational replies
- Bot owners who want a simple persona-based chat companion without external AI keys

## Success criteria

- Bot replies to an incoming user message in Arabic within an observable time window (e.g., < 3s) using the active persona/tone
- Per-chat conversation history retains the most recent ~20 messages and is used to produce context-aware replies
- Owner can view and update the persona via /persona and changes persist for future replies
- All discoverable navigation is reachable through inline buttons or the /start menu; /help displays commands

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Open the main menu, show welcome text and the current persona sample
  - outputs: welcome message (Arabic), inline keyboard: [Show persona, Help]
- **/help** (command, actor: user, command: /help) — Show available commands and quick usage tips
  - outputs: list of commands and short examples
- **/persona** (command, actor: user, command: /persona) — View (and for owner: edit) the active persona profile that defines reply tone and a sample reply
  - outputs: persona description card, Edit button for owner
- **Show persona** (button, actor: user, callback: persona:show) — Inline button to fetch and display the current persona sample and tone
  - outputs: persona card (sample reply in Arabic)
- **User message** (message, actor: user) — Any free-form user message in chat triggers a persona-styled Arabic reply
  - inputs: message text
  - outputs: bot reply in Arabic using persona and recent context

## Flows

### Welcome flow
_Trigger:_ /start

1. Send a short welcome message in Arabic that uses the persona voice
2. Show a sample persona reply and brief instructions
3. Display inline buttons: Show persona, Help

_Data touched:_ Persona profile, Conversation (no change)

### Chat reply flow
_Trigger:_ new_message

1. Receive incoming user message
2. Append message to per-chat conversation history (enforce last-20 limit)
3. Generate reply text using persona profile + recent conversation context (local generation/default algorithm)
4. Send reply in the same chat in Arabic
5. Log reply to conversation history

_Data touched:_ Conversation, Persona profile

### Persona view & edit (owner)
_Trigger:_ /persona or callback persona:show

1. Show persona card including short description, sample reply, language, and last-updated
2. If actor is owner, show Edit persona button
3. Owner taps Edit -> bot prompts ForceReply for new persona text
4. Owner submits new persona text -> validate length -> persist new persona and confirm

_Data touched:_ Persona profile, Conversation (owner confirmation message)

### Help & fallback flow
_Trigger:_ /help or unknown command

1. Return short help text in Arabic with list of supported commands and pointers
2. If unrecognized text command, suggest using plain message or /help

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

- **User** _(retention: persistent)_ — Telegram chat participant metadata used for routing and access control
  - fields: chat_id, display_name, is_owner_flag, last_active_at
- **Conversation** _(retention: persistent)_ — Per-chat recent message history used to provide conversational context
  - fields: message_id, sender_role (user|bot), text, timestamp
- **Persona profile** _(retention: persistent)_ — Short prompt-like profile that defines reply language, tone, and a sample reply
  - fields: persona_id, owner_id, language (default: ar), tone, sample_reply, raw_profile_text, last_updated
- **Owner settings (optional)** _(retention: persistent)_ — Owner-configurable settings such as conversation retention size and admin notifications
  - fields: owner_chat_id, retention_limit, notify_admin_on_new_chat (bool)

## Integrations

- **Telegram** (required) — Bot API messaging and callbacks
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- Edit persona/profile via /persona (owner only) using ForceReply
- Clear per-chat conversation history (owner command or button)
- Set conversation retention limit (default 20 messages) in owner settings
- Enable or disable admin notifications and set admin target (if desired)

## Notifications

- Optional admin notification when a new chat starts (owner can enable and supply admin chat id)
- Optional daily summary to owner (if enabled)

## Permissions & privacy

- Per-chat messages and persona profile are stored persistently only to provide context and persona behavior
- Stored conversation history is limited by retention policy (default: last 20 messages) and can be cleared by the owner
- Bot does not forward conversation content to external services by default
- Not a substitute for professional advice; bot will include a short disclaimer on /start or when flagged content appears

## Edge cases

- Very long incoming messages: truncate to a safe token/character length before adding to conversation context
- Non-Arabic input: reply in Arabic persona by default; if owner allows multilingual mode that's a future setting
- High message volume: enforce rate limits and queue replies; surface a polite rate-limit message in Arabic
- Group chat behavior: decide owner policy (should bot respond in groups? default: respond when directly mentioned or in private chats) — not yet configured
- Owner edits persona to empty or abusive text: validate and reject by default
- Message edits and deletes: edited messages may not be retroactively updated in stored context unless explicit handling is added

## Required tests

- Dialog-level acceptance test: send a sequence of user messages and assert replies use persona style and reference recent context (window ~20 messages)
- Persona edit test: owner updates persona text and subsequent replies reflect the new persona
- Retention test: ensure conversation history caps at configured limit and older messages are dropped
- Language enforcement test: verify replies are in Arabic for Arabic persona and sample reply tone matches
- Permission test: only owner may edit persona and change owner-only settings
- Button/navigation test: /start shows buttons and Show persona callback returns persona card

## Assumptions

- Built-in response generation (no external AI/LLM keys) is acceptable for initial behaviour
- Default language is Arabic and replies should be concise and friendly matching the provided sample tone
- Per-chat persona is shared across the chat (not per-user within group) unless owner requests per-user personas later
- Admin notifications are optional and disabled by default
- The platform provides bot token, storage, and webhook infrastructure; no extra API keys required

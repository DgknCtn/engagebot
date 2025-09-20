PRD — Discord Engagement & On-chain Roles Bot (English Commands)

Author: ProductPRD
Date: 2025-09-20 (Europe/Istanbul)
Target Environment: Single Discord server (~250 active members)
Bot Language: English (slash commands & messages)

------------------------------------------------------------
1) Vision & Product Goals
------------------------------------------------------------
Create a Discord bot that (a) awards points for verified engagement on X (Twitter) and Discord reactions, (b) lets users redeem points for rewards (e.g., roles), and (c) auto-assigns roles based on Solana wallet NFT/Token holdings. The system must be configurable (per-channel/role weights), operate via slash commands (no web panel for MVP), and run reliably on a single server.

Key goals:
- Increase member participation and retention with verifiable, low-friction actions.
- Motivate with quests, leaderboards, and a transparent points economy.
- Recognize verified holders via automated Solana-based roles.

Out of scope (MVP): inflation mechanics, web admin panel, multi-server tenancy.

------------------------------------------------------------
2) Success Metrics (MVP)
------------------------------------------------------------
North-star: Weekly Active Engagers (WAE) = distinct users with ≥1 validated action (X or Discord) per week.

Supporting metrics:
- Daily quests started/completed; quest completion rate (%).
- # of verified X accounts; # of linked Sol wallets.
- # of automated role grants (redeem-based and NFT-based).
- Reaction events captured vs. rewarded (spam filter pass rate).
- Leaderboard participation (# users with >N points).
- System health: job success rate, API error rate, P95 command latency < 2s.

------------------------------------------------------------
3) Primary Personas & User Stories
------------------------------------------------------------
A) Community Member
- As a member, I want to link my X account so that my likes/retweets/comments earn points automatically.
- As a member, I want to link my Solana wallet (Phantom) so that holder roles are assigned to me if I qualify.
- As a member, I want to see my points, quests, and the leaderboard to track progress.
- As a member, I want to redeem points for rewards (e.g., roles) instantly.

B) Moderator
- As a mod, I want to configure point values per action/channel and set role multipliers (e.g., OG +20%).
- As a mod, I want to define daily/weekly quests with caps and cooldowns.
- As a mod, I want to inspect logs and revoke rewards in edge cases.

C) Admin/Owner
- As an admin, I want safe Discord permissions, least-privilege tokens, and reliable scheduled syncs for X and Solana.
- As an admin, I want anti-cheat controls to reduce reaction farming and low-quality X interactions.

------------------------------------------------------------
4) Scope & Functional Requirements (MVP)
------------------------------------------------------------
4.1 Account Linking
- X (Twitter) via OAuth 2.0 (official API). Store encrypted access tokens per user.
- Solana wallet linking by user-provided address (NO signature verification for MVP).
- Commands:
  - /link-twitter
  - /unlink-twitter
  - /wallet set <address>
  - /wallet show

4.2 Verified Actions & Points Engine
- Supported actions:
  - X: like, retweet, reply (comment) on configured accounts/URLs/hashtags (scope configurable).
  - Discord: add emoji reaction in allowed channels (optionally restrict by message).
- Idempotent awarding: each verified action yields points once per configured unit (e.g., per tweet, per day).
- Role-based multiplier support (e.g., OG role +20%): points_awarded = base_points × (1 + Σmultipliers).
- Per-channel/per-action weights configurable by slash commands.
- Transparent transaction log per user.

4.3 Quests (Tasks)
- Quest types:
  - Daily: e.g., “Like 5 tweets today” (+20 points).
  - Server action: “React with any emoji in #announcements” (+5 points).
- Quest attributes: title, description, type, start/end window, target criteria, reward points, daily caps, cooldown, eligible channels.
- Autosettlement: system verifies completion via ingested events; user can also /quest claim (if we want explicit claim).
- Commands:
  - /quest create|list|delete|template
  - /quest assign (optional; if personalized quests later)
  - /quest claim (optional; MVP can auto-claim)

4.4 Rewards & Redeem
- Reward catalog (MVP focus: role grants). Future extensible (allowlist, raffle ticket).
- Threshold model: “Redeem 150 points → Role X” (Immediate grant; check if member already has role).
- Commands:
  - /rewards list
  - /rewards add-role <role> <cost>
  - /rewards remove <reward_id>
  - /redeem <reward_id>

4.5 Leaderboard
- Server-wide leaderboard with top N by time window (all-time, 7d, 24h).
- Commands:
  - /leaderboard [window={24h|7d|all}] [limit]
  - /points (shows user’s own totals, last 5 transactions)

4.6 Solana Holder Roles
- Daily sync job:
  - For each linked wallet, check NFT/Token holdings against configured allowlists/criteria.
  - Assign/remove mapped roles accordingly.
- Commands:
  - /nft-role add <role> <collection_id|mint_addresses|token_rules>
  - /nft-role list|remove
  - /sync holders (manual trigger with cooldown)

------------------------------------------------------------
5) Non-Functional Requirements
------------------------------------------------------------
Security & Privacy
- Encrypt X OAuth tokens (at rest with KMS; in transit TLS).
- Store least data necessary: Discord IDs, X IDs, wallet addresses, point transactions, quest state.
- No private keys. No wallet signatures (per requirement). ASSUMED risk: impersonation of wallet by entering someone else’s address—mitigated via policy (see Anti-Cheat).

Performance & Reliability
- Slash command P95 < 2s.
- X verification jobs resilient with exponential backoff; rate-limit aware.
- Persistence: managed DB with daily backups; 30-day retention on detailed logs (configurable).

Compliance & Permissions
- Discord intents: GUILD_MEMBERS (for roles), GUILD_MESSAGE_REACTIONS, GUILDS, optional MESSAGE_CONTENT not required for reactions-only.
- Secure bot token storage; rotate quarterly.

Localization & Timezone
- Bot messages: English.
- Scheduling & daily resets: Europe/Istanbul.

------------------------------------------------------------
6) Detailed Flows
------------------------------------------------------------
6.1 X Account Linking & Verification
- /link-twitter → OAuth login URL (DM or ephemeral message).
- On callback: store (user_id, x_user_id, access_token, scopes). Confirm link in Discord.
- Verification loop (scheduled & event-queued):
  1) Pull recent user interactions (likes/retweets/replies) constrained by: followed accounts, tweet IDs, hashtags (configurable scope).
  2) De-dupe by (x_user_id, tweet_id, action_type).
  3) Award base points per rule; apply role multipliers; persist PointsTransaction.
  4) Emit summary to user (optional rate-limited DM).

6.2 Discord Reaction Tracking
- On MESSAGE_REACTION_ADD:
  - Validate channel allowlist.
  - Check per-message/per-day caps to deter spam.
  - Award points idempotently (user_id, message_id, day_bucket).
- On reaction removal: no negative points (MVP) unless configured; log for audit.

6.3 Wallet Linking & Holder Sync (NO signature)
- /wallet set <address> → basic format validation; store mapping.
- Daily job:
  - Fetch holdings via Solana indexer (provider TBD).
  - Evaluate NFT/Token rules; grant/revoke roles accordingly.
  - Log changes and DM summary (optional).

6.4 Redeem Role
- /rewards list → show reward_id, cost.
- /redeem <reward_id>:
  - Check balance and role eligibility.
  - Deduct points atomically; grant Discord role; record Redemption.

6.5 Leaderboard & Points
- /leaderboard → compute via materialized view or cached aggregate (24h / 7d / all).
- /points → show total, recent transactions, active quests.

------------------------------------------------------------
7) Anti-Cheat & Abuse Mitigations
------------------------------------------------------------
X Integrity
- Only count actions fetched via official API per linked account.
- Optional minimum account age & follower threshold gates (configurable).
- Per-tweet caps (e.g., first valid like per user counts once).
- Blacklist known spam tweets/accounts; ignore protected tweets.

Discord Integrity
- Per-message and per-day caps for reactions (e.g., first 1–3 reactions count).
- Channel allowlist to avoid farm zones; ignore self-reacts if desired.
- Cooldowns: user-level cool-down on repeated identical actions.

Wallet Integrity (no signature)
- Policy: “One wallet per Discord user”; changing wallet allowed with cooldown (e.g., 7 days).
- Manual mod override (/wallet reset) for disputes.
- Optional cross-check: when user changes wallet, pause holder-role for 24h (cooldown).

System
- Idempotent transactions; audit logs (who/what/when).
- Anomaly flags: sudden spikes → mod review list.

------------------------------------------------------------
8) Configuration (Slash-only, no web panel)
------------------------------------------------------------
Global
- Base points per action:
  - x_like, x_retweet, x_reply
  - discord_reaction (by channel)
- Multipliers: role → % bonus (e.g., OG → +20%).
- Leaderboard windows; daily reset hour (Istanbul).
- Quest templates & limits; cooldowns.

X Scope
- Tracklist: accounts, hashtags, or explicit tweet IDs.
- Rate-limit budget per hour.

Solana Holder Rules
- NFT collections (by verified collection ID or mint list).
- Token rules: min balance thresholds.

Examples (editable at runtime)
- “x_like=+5, x_retweet=+8, x_reply=+10”
- “#announcements reaction = +5”
- “OG role multiplier = +20%”
- “Reward: Role ‘Contributor’ = 150 points”

------------------------------------------------------------
9) Data Model (high-level)
------------------------------------------------------------
Users(id, discord_user_id, joined_at)
TwitterAccounts(id, user_id, x_user_id, access_token_enc, linked_at)
Wallets(id, user_id, chain='solana', address, linked_at, last_changed_at)
PointsTransactions(id, user_id, source={x|discord|quest|redeem}, action_type, ref_id, base_points, multiplier_applied, total_points, created_at)
Balances(user_id, total_points, updated_at)  // could be derived
Quests(id, type, title, config_json, active_from, active_to, points, caps, cooldown)
QuestProgress(id, quest_id, user_id, state, progress_json, last_update)
Rewards(id, type={role}, payload_json, cost, active)
Redemptions(id, user_id, reward_id, cost, granted_at, status)
RoleMultipliers(role_id, percent)
NftRoleRules(id, role_id, rule_json, active)
XEvents(id, x_user_id, tweet_id, action_type, occurred_at, awarded_tx_id)
DiscordEvents(id, discord_user_id, message_id, channel_id, emoji, occurred_at, awarded_tx_id)
AuditLog(id, actor_user_id|null, action, details_json, created_at)
Jobs(id, type, status, started_at, finished_at, metrics_json)

Indexes: by user_id, action dedup (unique (x_user_id,tweet_id,action_type)), (discord_user_id,message_id,day_bucket,action_type).

------------------------------------------------------------
10) Internal Services & Scheduling
------------------------------------------------------------
- Command Handler (Discord): slash commands, permission checks, ephemeral responses.
- Points Engine: idempotent awarder, multiplier resolver, transaction store.
- X Ingestor: OAuth token broker, poller for recent interactions per linked user; backoff and per-user rate caps.
- Discord Event Listener: reaction add/remove; per-channel rules.
- Solana Holder Sync: daily job calling indexer provider; role delta applier.
- Leaderboard Aggregator: periodic recompute & cache.

Job cadence (MVP defaults):
- X ingest: every 5–10 minutes per user (adjust to API limits).
- Holder sync: daily at 04:00 Europe/Istanbul.
- Leaderboard cache: every 5 minutes.

------------------------------------------------------------
11) Tech Stack & Architecture (MVP)
------------------------------------------------------------
Runtime: Node.js + TypeScript
Discord SDK: discord.js v14
X (Twitter) API: v2 OAuth 2.0 (user auth), endpoints for likes/retweets/tweets/replies
Solana data: indexer API (provider TBD: e.g., Helius/Alchemy/QuickNode) — read-only
DB: PostgreSQL (transactions & aggregates)
Cache/Queue: Redis (dedupe, rate-limit tokens, job queues)
Container: Docker; deploy to a managed VM or container service
Secrets: dotenv in dev; cloud secret manager in prod
Observability: structured logs, error tracker, basic metrics dashboard

High-level diagram (text):
[Discord Slash] → Command Handler → Points Engine → Postgres
[Discord Reactions] → Event Listener → Points Engine → Postgres
[X OAuth] → Token Store (KMS) → X Ingestor (poll) → Points Engine → Postgres
[Holder Sync] → Solana Indexer → Role Applier (Discord API)
[Cache] Redis for idempotency & rate limiting
[Admin Slash] → Config Service (persist rules) → Postgres

------------------------------------------------------------
12) Slash Command Catalog (English)
------------------------------------------------------------
User
- /link-twitter
- /unlink-twitter
- /wallet set <address>
- /wallet show
- /points
- /leaderboard [window] [limit]
- /redeem <reward_id>

Moderator/Admin
- /config set points x_like|x_retweet|x_reply|discord_reaction <value> [channel]
- /config get points
- /multiplier set <@role> <percent>
- /multiplier remove <@role>
- /rewards add-role <@role> <cost>
- /rewards list|remove <reward_id>
- /quest create <template_id|custom> [params]
- /quest list|delete <quest_id>
- /nft-role add <@role> <rule>
- /nft-role list|remove <rule_id>
- /sync holders (manual; cooldown)
- /log show [filter] (basic audit view, optional MVP)

Permissions
- Admin-only: config, multipliers, nft-role, rewards add/remove, sync.
- Everyone: link accounts, wallet, points, leaderboard, redeem.

------------------------------------------------------------
13) Example Rules & Scoring (Editable)
------------------------------------------------------------
- X like = +5; retweet = +8; reply = +10.
- Discord reaction in #announcements = +5 (cap 1/day).
- Daily quest: “Like 5 tweets” = +20 bonus.
- Role multiplier: OG = +20% (stacking disabled in MVP; highest only).
- Reward: “Contributor” role = 150 points.

------------------------------------------------------------
14) Edge Cases & Error Handling
------------------------------------------------------------
- X token revoked → mark account unlinked; notify user; retry link.
- Protected tweets/unavailable content → skip & log.
- Reaction spam (rapid toggling) → debounce; count once per message per day.
- Wallet changed → enforce cooldown (e.g., 7 days) before holder-role eligibility.
- Role grant failures (missing permissions) → rollback points or place in “pending grant” with mod alert.
- API rate limit → pause user ingestion; resume automatically.

------------------------------------------------------------
15) Risks, Assumptions, and Mitigations
------------------------------------------------------------
ASSUMED: No wallet signature for ownership → risk of address hijack. Mitigation: cooldowns, moderator override, visible wallet in /wallet show.
ASSUMED: X API paid access tier may be required for interaction reads. Mitigation: scope to target accounts/hashtags; batch polling; backoff.
ASSUMED: Single server; per-guild config stored under that guild_id.

Open decisions:
- Solana indexer provider (cost/limits/SLA).
- Minimum X account age thresholds?
- Whether /quest claim is manual or auto-claim only (MVP suggests auto).
- Whether reaction removal should reverse points (default: no).

------------------------------------------------------------
16) MVP Rollout Plan
------------------------------------------------------------
Phase 0 — Setup
- Register Discord app/bot; enable required intents; permission scopes.
- Provision DB/Redis/secrets; pick Solana indexer; set X API credentials.

Phase 1 — Core
- Slash commands, points engine, Discord reaction ingestion with caps.
- X OAuth + ingestion for likes/retweets/replies; awarding logic; logs.
- Rewards: role redeem; leaderboard; /points.

Phase 2 — Quests & Holder Roles
- Quest engine (daily task types, templates, caps).
- Solana holder sync + role mapping; daily scheduler.

Phase 3 — Hardening
- Anti-cheat gates & cooldowns; audit views; metrics dashboard.
- Config polish; backups; on-call alerts.

------------------------------------------------------------
17) Minimal API/Schema Sketches (for dev handoff)
------------------------------------------------------------
Points awarding (internal)
- awardPoints(userId, {source, actionType, refId, basePoints}) → {txId, totalAwarded}
- applyMultipliers(userId, basePoints) → totalPoints

X ingestion
- listRecentInteractions(xUserToken, scope) → [{tweetId, type, at}]
- deDupeAndAward(...)

Solana indexer (abstract)
- getHoldings(address) → {nfts: [...], tokens: [{mint, amount}]}
- evaluateRules(holdings, rules) → {grantRoles: [...], revokeRoles: [...]}

------------------------------------------------------------
18) QA & Acceptance Criteria
------------------------------------------------------------
- A user links X, likes a tracked tweet, and receives points within 15 minutes.
- A user reacts in #announcements and receives configured points once per day.
- A user with linked wallet holding a whitelisted NFT is granted the holder role after the daily sync.
- /leaderboard shows correct ordering for 24h/7d/all-time.
- /redeem deducts points and grants role atomically; handles failure paths.

------------------------------------------------------------
19) What’s Next / Feedback Hooks
------------------------------------------------------------
- Confirm Solana indexer provider preference and any initial NFT collections.
- Provide initial default scoring table & reward catalog to pre-seed the bot.
- Choose account age thresholds for X anti-cheat (e.g., ≥30 days).
- Decide on /quest claim behavior (auto vs manual).
- Any additional quest templates you want on day one?

(End of PRD)

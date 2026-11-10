# DATA INVENTORY: WHAT THE APP STORES ABOUT A MEMBER

10 November 2026. Factual, read from the schema in supabase/migrations and supabase/migrations/pending. Pending tables are marked (pending): they exist in the repository and are not necessarily applied to the live database. Periods are those in the privacy notice section 7 and the draft docs/RETENTION_SCHEDULE.md (draft, not approved). Database and files are hosted in Ireland (EU).

| Data type | What is stored | Where | Linked to the member by | Removed on account deletion |
|---|---|---|---|---|
| Sign-in identity | email or phone, password hash, sessions | auth.users (Supabase Auth) | id | Stripped to a tombstone (no address, phone, name or password) after the 30 day window |
| Profile | display name, avatar URL, phone, language | public.profiles | id (cascade from auth.users) | Yes |
| Roles | role per member | public.user_roles | user_id | Yes |
| Social profile and posts | handle, bio, posts, stories, comments, reactions, story and post views | public.social_profiles, posts, stories, post_views and related; storage bucket avatars | author_id, user_id | Purged or anonymised; views 90 days |
| Circle communities | memberships, role, posts (including a Roommates card: id, title or first name, area, one line) | circle_memberships, posts (roommate_card pending) | user_id, author_id | Purged or anonymised |
| Agent application and KYC | full name, phone, email, residential address, ID type and number, business name and RC number, bank name, account number and name, submitted and reviewed times | public.agent_applications | user_id | Approved agents: identification kept 5 years then destroyed (kyc_retain_until); rejected: draft schedule proposes 30 days after appeal window |
| KYC documents | ID document, NIN slip, business registration, selfie, selfie holding ID | storage bucket agent-documents; public.agent_documents | user_id folder | Same as above; opening is logged |
| Verification requests | reviewer's message asking for another photo, status, document link | public.verification_requests | subject_id | Cascade on delete |
| KYC consents | which agreements the person accepted for verification, when | public.kyc_consents | user_id | Per the purge |
| Payout accounts | bank, account number, account name | public.payout_accounts | user_id | Money records kept at least 5 years after a closed request, then destroyed through the retention desk |
| Bookings and payments | stay dates, amounts, state events, transactions, ledger entries, refunds | public.bookings, booking_state_events, transactions, ledger_entries, booking_refunds | renter, agent ids | Record kept, subject redacted (draft schedule: 6 years) |
| Listings | title, description, price, photos, videos, address, latitude and longitude (hidden from signed-out visitors; map shows an approximate point) | public.listings and related; listing media buckets | owner id | Per the purge and listing rules |
| Messages | sender, body, read time, attachments | public.messages, conversations, message_attachments; bucket message-attachments | sender_id | Draft schedule: 3 years after the last message; a message pinned to a tenancy is kept |
| Saved items and searches | saved places and collections, saved searches | public.saved_items, saved_places, saved_collections, saved_searches | user_id | Yes |
| Notifications | title, body, link, read time | public.notifications | user_id | Draft: 12 months |
| Push tokens | platform, push token or web endpoint, a short device name | public.push_tokens, push_queue, push_deliveries, push_enrol_log | user_id | Cascade on delete |
| Known devices | a digest of the browser and device, device words, first and last seen | public.known_devices | user_id | Cascade on delete |
| Location | no continuous device location is stored. Price check stores a five character area code (geohash), property kind and progress step, with the member's account; the map sends the visible map area to a tile service that keeps no IP address (privacy section 5) | public.price_check_events (24 months in draft) | user_id | Cascade |
| Support | tickets, replies, attachments, escalations | public.support_tickets, support_ticket_messages, support_ticket_attachments | user_id | Draft: 3 years after closure |
| AI assistant | what the member types, recent turns, listing lookups; sent to Anthropic (US) to write the answer | public.ai_conversations, ai_messages | user_id | Draft: 12 months |
| Audit log | actor, action, entity type and id, metadata (for deletion, only the reason code) | public.audit_log | actor_id (nullable, set null) | Kept (draft: 6 years) |
| Reports and moderation | reports, cases, notes, evidence, restrictions, appeals | public.reports, moderation_cases and related (pending), member_restrictions (pending) | reporter, subject | Draft: 3 years after resolution |
| Roommate profile (pending) | intents, intro, life stage, school, course, study level, workplace (hidden unless shown), NYSC state, state, city, areas, budget range, move-in date, lifestyle answers, gender (hidden unless shown), gender preference, last active | public.roommate_profiles | user_id (cascade) | Yes; the member can also delete only the roommate profile |
| Roommate posts and activity (pending) | room posts, interests, groups, shortlists, votes, group posts, expenses, viewings, saved searches | public.roommate_listings, roommate_interests, roommate_groups and related | owner_id, user_id | Per the purge |
| Roommate verifications (pending) | email code checks for school email | public.roommate_verifications, roommate_email_codes | user_id | Per the purge |
| Sign-up step counts | step, language, website or app, a random visit id; account only on later steps | public.funnel_events | visit id; account after sign-up | Counts deleted after 90 days |
| Email delivery records | one record per email sent | email log tables | user_id or address | 90 days after delivery; failures until handled |
| Rate limits and idempotency | counters and request keys | public.rate_limits, idempotency_records | user_id or IP | 30 and 90 days (draft) |
| Copilot single use record (pending) | nonce, staff user, tool name, action kind, times; no arguments | public.copilot_proposals | user_id (nullable, set null) | Staff data; rows older than 7 days may be deleted |

Not covered here: sanctions screening, PEP, EDD and suspicious transaction records, which are anti money laundering records kept at least five years and described in docs/RETENTION_SCHEDULE.md sections 3.1a, 3.3a and 3.5. Column lists above are summaries; the migrations are the source.

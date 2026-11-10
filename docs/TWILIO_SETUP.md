# Twilio for codes outside Nigeria: what is built and what to set up

Built 2 November 2026. Nigerian numbers (+234) still go through Termii. Every other number goes through Twilio. Code: `apps/web/src/lib/phone-otp/twilio.ts`, routing in `transport.ts`, number reading in `apps/web/src/lib/phone-intl.ts`, screen `apps/web/src/components/app/PhoneNumberInput.tsx`.

## What it does
- The confirm-your-number screen (Settings, Phone) has a country chooser and the number beside it. It starts on the country the browser's language hints at (en-GB starts on the United Kingdom), otherwise Nigeria. A number typed with a `+` is read as written.
- The server reads the number with Google's number rules (libphonenumber), accepts mobile ranges only, makes the six-digit code itself, stores its hash (`phone_otp_issue`), and sends the text through the right vendor.
- Twilio is used for delivery only. Twilio Verify is not used, so there is no per-verification fee on top of the message cost.
- The database now accepts any E.164 number in `confirmed_phones` and `private.phone_otps` (migrations `20261102101527` to `20261102101554`).

## Environment variables (Vercel, server side; never in chat)
`TWILIO_ACCOUNT_SID` (starts AC), `TWILIO_AUTH_TOKEN`, and ONE of `TWILIO_MESSAGING_SERVICE_SID` (starts MG, preferred) or `TWILIO_FROM_NUMBER`. Optional WhatsApp first: `TWILIO_WHATSAPP_FROM` and `TWILIO_WHATSAPP_CONTENT_SID` (an approved authentication template). Documented in `docs/ENVIRONMENT.md` and `apps/web/.env.example`. Nothing is sent until the first three are set and `phone_confirmation` is on.

## What to do in the Twilio console
1. Upgrade the account and add the $50. A trial account can only text numbers you have verified yourself.
2. Create a **Messaging Service** (Messaging, Services) and add a sender to it. Put its SID in `TWILIO_MESSAGING_SERVICE_SID`.
3. **Geo permissions** (Messaging, Settings, Geo permissions): tick every country you want to text. Twilio blocks SMS to a country until it is enabled.
4. **Sender rules differ by country.** Check each one before you promise it:
   - United Kingdom and most of Europe: a registered alphanumeric sender ID or a sender number works for codes; some countries want the sender ID registered.
   - United States and Canada: a normal number needs A2P 10DLC registration, or use a verified toll-free number, or messages are filtered.
   - India, UAE, Saudi Arabia and some others: sender IDs or templates must be registered with local regulators.
   - Some countries cannot be texted at all.
   Twilio's "SMS guidelines by country" pages list each one.
5. WhatsApp (optional): needs a WhatsApp sender approved by Meta and an approved authentication template.

## Cost (estimates, check Twilio's rate card)
Delivery only is about $0.04 per UK SMS. So $50 is about 1,250 messages, or about 1,000 people allowing for resends.

## Every phone field, every country (updated 2 November 2026)
One field everywhere (`components/app/PhoneField.tsx`): Nigeria first, the flag and calling code as a button, a searchable list of every country. It is on sign-up (optional), confirming a number, the profile and wallet number, phone sign-in, booking contacts, agent and owner registration, the agent application and listing mandates. The database checks on those tables accept any E.164 mobile (migrations `20261102104659` to `20261102104703`). The wallet opens on a foreign number only when the retired provider's id for that country is set (`PROVIDER_COUNTRY_IDS`); see `docs/payments/DIASPORA_PAYMENTS.md`. The agent-lookup door and the landlord SMS line stay Nigerian by design.

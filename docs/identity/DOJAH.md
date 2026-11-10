# Dojah on Vallo

> **STATUS: BUILT AND PARKED (founder decision, 2 November 2026).** Verification
> is manual for now (`docs/identity/MANUAL_VERIFICATION.md`). Everything below
> is in the repository and switched off; nothing is billed. To add Dojah later,
> follow section 5. Do not remove it.

Written 2 November 2026. Dojah's own pages are saved word for word in
`docs/identity/dojah-source/` (from docs.dojah.io, as `.txt`).

## 1. What Dojah does for us

Dojah is a licensed Nigerian identity aggregator. It sits between Vallo and
NIMC (NIN), NIBSS (BVN), CAC (companies) and global watchlists. We pay per
check from a prepaid Dojah wallet. The sandbox is free and returns test data.

The products we use:

| Dojah product | What it answers | Where Vallo uses it |
| - | - | - |
| EasyOnboard (hosted flow) | Is this a live person, and is it the person on this NIN or BVN? (government lookup, selfie liveness, face match) | `/verification`, for everyone who lists or gets paid |
| vNIN lookup | Who holds this virtual NIN? | The existing V-49 route on `/verification` |
| CAC advance lookup | Is this company real, active, and who are its directors? | Firms, hosts and businesses (client ready, desk button next) |
| AML screening | Is this name on a PEP, sanctions or adverse-media list? | Every completed selfie check when `DOJAH_AML=on` |
| Resolve NUBAN | Whose name is on this bank account? | Payout accounts (client ready, next) |
| Webhooks (`kyc_widget`) | The signed, authoritative result of a hosted flow | `/api/dojah/webhook` |

## 2. The architecture

```
 Member's phone / browser                 Vallo server (Vercel)                   Dojah
 ─────────────────────────                ─────────────────────                   ─────
 /verification
  "Start the check"  ──startDojahCheck──▶  open_identity_check()  (row = check id)
                     ◀── hosted link ────  identity.dojah.io/?widget_id=..&metadata[vallo_ref]=<check id>
  full-page sheet, iframe ─────────────────────────────────────────────────────▶  NIN/BVN + selfie + liveness
                                                                                   checks NIMC / NIBSS
                                           /api/dojah/webhook  ◀── signed POST ──  kyc_widget result
                                            1. HMAC-SHA256 of raw body (DOJAH_WEBHOOK_SECRET)
                                            2. redacted copy into provider_webhook_events (idempotent)
                                            3. find the check by metadata.vallo_ref
                                            4. decide: pass a clean result, else send to a person
                                            5. AML screen (optional) ───────────────▶ /api/v2/aml/screening
                                            6. copy selfie / ID / report into the private
                                               identity-checks bucket (links die in 1 hour)
                                            7. HMAC the NIN or BVN, drop the number
                                            8. record_dojah_check()
  polls dojahCheckStatus() every 4 s ───▶  my_identity_check()  (status only, never scores)
  "Your identity is confirmed"

 Admin console /admin/kyc
  "Selfie checks waiting"  ◀──────────────  identity_checks in review (service role, kyc_review staff)
  selfie beside ID, both names, scores,     /api/identity-checks/<id>/<file> streams the images
  AML, Dojah reasons                        (audit row per view, no signed URLs)
  Approve / Refuse  ──decideIdentityCheck─▶ decide_identity_check()  (actor = auth.uid())
```

### The rules it keeps

1. **The webhook is the result, never the browser.** The member's screen only
   waits for the row the signed webhook writes. Dojah's docs say the same.
2. **A machine may pass, never refuse.** A clean result (session succeeded,
   government record returned, selfie passed, face score at least 80, no proxy,
   the NIMC/BVN name matches the name given to Vallo by the Nigerian-name rule,
   AML clear) confirms the person at once. Anything else goes to the KYC desk
   with the reasons written out. Only a person refuses, with a sentence the
   member is sent word for word. Same rule as the vNIN and payout checks.
3. **No NIN or BVN is ever stored.** Each is turned into an HMAC under
   `VALLO_NIN_HMAC_KEY` the moment it arrives and dropped. The raw event log
   has every government number, phone number and file link redacted.
4. **One NIN or BVN, one account.** A number already matched to another
   account never passes; it waits for a person, who sees both accounts.
5. **Files leave Dojah within the hour.** Dojah's links expire, so the selfie,
   ID images and report PDF are copied into the private `identity-checks`
   bucket immediately. Staff see them streamed from our own origin.
6. **Sandbox and live never mix.** Each check row records its environment; the
   desk marks sandbox checks in red as test data.

### What a confirmed identity unlocks across the platform

A passed or approved check writes one matched row to
`identity_verifications` (method `dojah`) and, for agents, passes the
identity rung. Everything that already reads those picks it up with no
further change:

- the agent ladder, tier and the Verified badge (tier 1 = identity passed);
- the Vallo Passport verification line and "Identity matched" in threads;
- `lister_verified_names` (the payout bank-name match now includes the NIMC name);
- the payment rail gate and the crypto pay gate, which read the legal name;
- briefs and pitches that require a verified lister.

## 3. Database (applied 2 November 2026)

- `public.identity_checks`: one row per Dojah session. Status `opened`,
  `waiting`, `passed`, `review`, `retry`, `abandoned`, `approved`, `refused`.
  RLS on, no grants: read by the service role and through the RPCs only.
- `identity_verifications`: method `dojah` allowed, new `bvn_hmac` column,
  unique per matched BVN.
- `provider_webhook_events`: provider `dojah` allowed.
- RPCs: `open_identity_check` (member, three a day), `my_identity_check`
  (member, status only), `record_dojah_check` (service role),
  `decide_identity_check` (staff with `kyc_review`, never their own),
  `private.dojah_match_identity` (the one place a match is written).
- Flag `dojah_identity` (off). Bucket `identity-checks` (private).

## 4. Code

| File | Job |
| - | - |
| `apps/web/src/lib/identity/dojah/config.ts` | env, sandbox or live |
| `apps/web/src/lib/identity/dojah/client.ts` | REST client: verification, vNIN, CAC, AML, NUBAN |
| `apps/web/src/lib/identity/dojah/result.ts` | reads a result, decides pass or review |
| `apps/web/src/lib/identity/dojah/webhook.ts` | signature check, redaction |
| `apps/web/src/lib/identity/dojah/process.ts` | one result from payload to recorded decision |
| `apps/web/src/lib/identity/dojah/wiring.ts` | the real effects (service role, storage) |
| `apps/web/src/app/api/dojah/webhook/route.ts` | the webhook |
| `apps/web/src/lib/identity/dojah-actions.ts` | start a check, read its status |
| `apps/web/src/components/verification/DojahPanel.tsx` | the member's panel and frame |
| `apps/web/src/lib/identity/provider.ts` | vNIN now through Dojah when configured |
| `apps/web/src/app/admin/kyc/IdentityChecksPanel.tsx` | the desk |
| `apps/web/src/lib/admin/identity-check-actions.ts` | approve or refuse |
| `apps/web/src/app/api/identity-checks/[id]/[file]/route.ts` | staff file stream |

Security headers: `frame-src` allows `https://identity.dojah.io` and
Permissions-Policy delegates camera and geolocation to it alone. The site's
script policy is untouched: no Dojah script is loaded on our pages.

## 5. Going live, in order

1. **Sandbox first (today, no approval needed).** In the Dojah dashboard
   (sandbox): EasyOnboard, Workflows, new flow "Vallo identity":
   - Country: Nigeria. Steps: User data, Government data (NIN and BVN),
     Selfie with liveness. Optional: ID document (passport, driver's licence,
     voter's card) for people abroad.
   - Branding: Vallo logo and colours.
   - Publish. Copy the widget id.
2. Developers, Configuration: copy the App ID and the secret key.
3. Developers, Webhooks: add `https://www.vallospaces.com/api/dojah/webhook`
   for the `kyc_widget` service. Copy that subscription's Secret.
4. Vercel env (Production): `DOJAH_ENV=sandbox`, `DOJAH_APP_ID`,
   `DOJAH_SECRET_KEY`, `DOJAH_WIDGET_ID`, `DOJAH_WEBHOOK_SECRET`, and
   `VALLO_NIN_HMAC_KEY` (at least 32 random characters, set once, never
   rotated casually).
5. Turn the flag on for testing:
   `update public.feature_flags set enabled = true where key = 'dojah_identity';`
   Run a check with the sandbox NIN `70123456789` or BVN `22222222222`.
   Watch it land on `/admin/kyc`. Turn the flag off again if you like.
6. **After Dojah approves compliance:** fund the wallet, switch the dashboard
   to Live, repeat steps 1 to 3 in Live (live keys, live widget, live webhook
   secret), set `DOJAH_ENV=live`, redeploy, turn the flag on.
7. Optional: `DOJAH_AML=on` once the AML price is agreed.
8. Optional: to use Dojah for the vNIN route as well, set
   `VALLO_NIMC_MERCHANT_CODE` (from Dojah) and turn on `vnin_identity`.

## 6. Next pieces (designed, not built yet)

- **Businesses, firms and hosts:** a "Check with CAC" button on
  `/admin/businesses` and on agent applications with an RC number: the
  registered name, status and directors beside what was declared, as a
  suggestion to the reviewer, never a decision (`client.cacAdvance` is ready).
- **Payout accounts:** Dojah NUBAN as a second resolver beside Paystack, and
  the NIMC legal name (not the display name) passed to the payout name match.
- **Mandates and beneficial ownership:** send the property owner their own
  Dojah link so `principal_verified_how` can be a real identity check.
- **the retired provider wallet tiers:** a BVN-plus-selfie check is what a higher wallet
  tier will ask for; the result is already recorded.
- **Sensitive actions** (changing a payout account, a large withdrawal):
  Dojah EasyAuthentication, a fresh liveness against the enrolled face.
- **Raw ID numbers:** `agent_applications.id_number` still stores what people
  type in the old form; once Dojah is live that field should go.
- **iOS camera wording:** the next native build should name the identity
  selfie in `NSCameraUsageDescription` so App Review sees it described.

## 7. The Dojah compliance form (the answers)

Step 1, Business Details:

| Field | Answer |
| - | - |
| RC Number | 9870413 (press Verify; Dojah fills the name and type from CAC) |
| Company Name | VALLO SPACES LTD |
| Company Type | Private company limited by shares (as Dojah resolves it) |
| Industry | Real Estate or PropTech; if neither is listed, Technology |
| Building / House Number | 5 |
| Building / Estate | leave empty |
| Street Name | Zone 6 |
| Address Line | 5, Zone 6, Dutse Alhaji |
| Area / District | Dutse Alhaji |
| City / Town | Abuja |
| LGA | Bwari |
| State | Federal Capital Territory |
| Postal Code | 901101 |
| Website | https://www.vallospaces.com |
| Business Description | below |

Business description:

> Vallo Spaces Ltd runs Vallo (vallospaces.com and the Vallo apps on iOS and
> Android), a Nigerian property marketplace where people find homes to rent or
> buy, short stays and spaces, and where landlords, owners, agents, hosts and
> property firms list them. We will use Dojah to verify the people who list
> and get paid on Vallo: NIN or BVN with a selfie liveness check and face match
> through EasyOnboard, CAC lookups for property businesses, AML and PEP
> screening, and bank account name checks before payouts.

Step 2, Business Documents (PDF, JPG or PNG, 5 MB each): CAC Certificate,
MEMART, CAC Status Report, and a utility bill for 5, Zone 6, Dutse Alhaji dated
in the last three months.

Step 3, Directors' Details: one director is enough. Job title "Director".
Enter that director's own 11-digit BVN and press Verify, then upload their
government ID. The name on the ID must match the name on the BVN exactly.

Step 4, MSA: download `Dojah_MSA_v2.1.pdf`, read it, sign, Submit for Review.
It is a contract for the company, so share it with the other two directors
first.

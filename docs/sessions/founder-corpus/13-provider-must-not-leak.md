# The provider must never leak into the Vallo experience

Source: the founder's message of 6 October 2026.

This file is the founder's own words. It is not a summary and it has not been
edited for content. The only change made to it is mechanical: the em dash is
forbidden everywhere under `docs/` by `apps/web/scripts/check-no-em-dash.mjs`,
so every em dash has been replaced with a hyphen. Nothing was cut, softened,
reordered or paraphrased.

---

Make it know that vallo don’t hold money it’s through escrow and it’s hold by our provider etc check this out and add it to handsoff more detailed more area the chat gpt prompt didn’t cover you feel me ? More and deep areas it didn’t do you feel me ? And also make it more deep the tools and features too you get me all areas more deep and make the prompt I’m sending to them cover mthings more and make the expertise upgrade session do all things rightly like all those things he missed and all new ones etc should be done clean make the prompt so fucking detailed and hands off espprcily and send all the 3 session prompt again covering all new things make it so fucking detailed like conveying all areas deep deep!

Here is it  “ iYes bro, I fully get what you mean.

You don’t want EscrowPay, Yellow Card, Paystack, or any other provider leaking into the Vallo experience and making Vallo look like a wrapper around other companies.

The user should experience:

Vallo → Vallo checkout → Vallo transaction → Vallo receipt → Vallo wallet → Vallo escrow → Vallo status

while the provider infrastructure operates underneath.

There is one important distinction: don’t conceal legally required provider disclosures. The normal product UI can be Vallo-native, while Terms, payment disclosures, transaction details, and required compliance screens can identify the relevant provider where legally/contractually required.


The clean public wording


My preferred wording is:

Vallo uses regulated financial infrastructure partners to process and protect eligible transactions. Vallo does not hold customer funds.

For a shorter UI version:

Funds are processed through Vallo’s regulated financial infrastructure partners.

For escrow:

Protected by Vallo’s secure transaction infrastructure.

And in a more detailed legal/FAQ context:

Vallo does not custody customer funds. Eligible payments are processed through regulated financial infrastructure partners, with funds handled according to the applicable transaction and provider terms.

I would not publicly say:

“Our escrow provider is EscrowPay.”

unless there is a specific reason to disclose the name.

And I would not say:

“Vallo holds your money in escrow.”

because Vallo itself isn’t supposed to represent that it is the regulated holder of the funds.




COPY THIS INTO CLAUDE CODE



VALLO NATIVE FINANCIAL EXPERIENCE + PROVIDER ABSTRACTION MASTER PROMPT


You are responsible for taking the existing Vallo financial/payment experience and making it feel like a fully native Vallo product, while keeping all underlying payment, escrow, wallet, settlement, banking and stablecoin infrastructure correctly powered by external providers.

This is NOT about hiding information improperly.

This is about proper product abstraction.

The customer should experience Vallo.

External providers should power the infrastructure underneath Vallo.

The final product must feel like Vallo designed and owns the entire experience.




1. CORE PRINCIPLE


The user should never feel like they have suddenly left Vallo because a payment provider’s interface appeared.

The experience should feel like:
VALLO
   ↓
Vallo Payment Experience
   ↓
Vallo Checkout
   ↓
Vallo Transaction
   ↓
Vallo Protection / Escrow
   ↓
Vallo Receipt
   ↓
Vallo Transaction History
Underneath:
Vallo Payment Engine
        ↓
Provider Adapter
        ↓
EscrowPay / Paystack / Yellow Card / future provider
The provider is infrastructure.

Vallo is the product.




2. PUBLIC POSITIONING


Where appropriate, use language such as:

Vallo uses regulated financial infrastructure partners to process eligible transactions. Vallo does not hold customer funds.

Alternative shorter wording:

Payments are processed through Vallo’s financial infrastructure partners.

For protected transactions:

Your payment is protected through Vallo’s transaction infrastructure.

Do not expose internal provider architecture unnecessarily.

Do not place provider branding on primary Vallo surfaces merely because an API provider powers the backend.

However:


IMPORTANT


Do not conceal legally required disclosures.

If regulations, provider agreements, card-network requirements, banking requirements, KYC requirements, payment rules, receipts, Terms, or transaction disclosures require a provider name or external-provider disclosure, display it appropriately.

The goal is:

clean abstraction, not deceptive concealment.




3. NO THIRD-PARTY LOOKING CHECKOUT


Audit every current payment flow.

Search for:

* EscrowPay checkout
* Paystack checkout
* Yellow Card checkout
* provider logos
* provider colors
* provider terminology
* hosted payment pages
* provider buttons
* external-looking payment forms
* external redirects
* external wallet interfaces
* raw API status
* provider IDs exposed unnecessarily
* provider-specific error messages
* provider-specific terminology



Where technically and contractually possible, make the experience Vallo-native.

Instead of:

Pay with EscrowPay

the primary UI should say:

Continue securely

or:

Protect payment

or:

Add money

or:

Withdraw

or:

Send money

depending on the workflow.

Provider information belongs in appropriate transaction/legal detail areas, not as the dominant product identity.




4. VALLO CHECKOUT


Build a proper Vallo checkout system.

It should look and feel like a Vallo screen.

Example:
VALLO

Review & Pay

Lekki 2-Bedroom Apartment

Monthly rent
₦1,800,000

Service / applicable fees
₦XX,XXX

Total
₦X,XXX,XXX

Payment protection
Your payment is processed through Vallo's
financial infrastructure and handled according
to the transaction terms.

Agreement
#AGR-001284

Space
VSP-LAG-000184

[ Continue Securely ]
Do not expose raw provider terminology unless necessary.




5. CHECKOUT MUST UNDERSTAND THE TRANSACTION


Vallo checkout must not be a generic payment screen.

It should understand:

* Space
* Agreement
* Buyer
* Seller
* Transaction
* Payment
* Escrow
* Conditions
* Inspection
* Fees
* Total cost
* Currency
* Payment method
* Timing
* Release conditions



For example:
You're paying for

Space
VSP-LAG-000184

Agreement
Rental Agreement

Amount
₦1,800,000

Protection
Protected transaction

Release condition
Move-in inspection + confirmation
This makes Vallo fundamentally different from a payment gateway.




6. PROVIDER ABSTRACTION


The frontend must never depend directly on EscrowPay/Paystack/Yellow Card implementation details.

Use:
Vallo UI
    ↓
Vallo Payment Service
    ↓
Payment Router
    ↓
Provider Adapter
    ↓
External Provider
Example:
/payments
  /core
  /services
  /providers
    /escrowpay
    /paystack
    /yellowcard
  /webhooks
  /reconciliation
  /ledger
  /receipts
Follow the existing Vallo architecture if it has a better equivalent.




7. FRONTEND PROVIDER AGNOSTICISM


The frontend should consume Vallo concepts.

For example:
Payment
Escrow
Withdrawal
Transfer
Receipt
Transaction
Protected
Pending
Completed
Failed
Not:
EscrowPayPayment
EscrowPayEscrow
EscrowPayWallet
PaystackCheckout
YellowCardTransaction
Provider-specific concepts should remain inside provider adapters.




8. PROVIDER STATUS MAPPING


Create a Vallo status normalization layer.

For example:
Vallo:

Preparing
Pending
Processing
Protected
Awaiting Confirmation
Completed
Failed
Cancelled
Disputed
Refunded
Partially Refunded
Map provider statuses internally.

Do not expose raw provider statuses unless necessary for support/debugging.




9. VAllO TRANSACTION TIMELINE


Create a beautiful Vallo transaction timeline.

Example:
Payment created
      ↓
Payment confirmed
      ↓
Funds protected
      ↓
Space condition pending
      ↓
Inspection completed
      ↓
Confirmation received
      ↓
Funds released
      ↓
Transaction completed
The timeline should explain what happened in human language.

Not:
ESCROW_STATUS = OPENED
PAYMENT_INTENT = VERIFIED
Those are backend concepts.




10. VAllO MONEY CENTER


Build a unified Vallo financial center.

Possible navigation:
Money

Overview
Transactions
Protected Payments
Withdrawals
Transfers
Receipts
Payment Methods
Financial Activity
Depending on the user’s role.

Do not call it “EscrowPay Wallet.”

Call it something like:

Vallo Money

or:

Money

if that fits the existing brand.




11. AVAILABLE VS PROTECTED MONEY


Make the distinction extremely clear.

Example:
Available
₦2,450,000

Protected
₦850,000

Pending
₦50,000
Explain:

Protected
Money committed to active Vallo transactions and not yet released.

Do not imply Vallo itself legally holds the funds.




12. WITHDRAWAL EXPERIENCE


The withdrawal flow must feel entirely Vallo-native.
Withdraw

Available
₦2,450,000

Amount
₦500,000

To
GTBank
•••• 4821

Account name
EBENEZER XXXXX

Processing fee
₦X,XXX

You'll receive
₦XXX,XXX

[ Confirm Withdrawal ]
Behind the scenes:
Vallo
→ provider withdrawal intent
→ provider verification
→ provider execution
→ webhook
→ Vallo state
Never show raw provider API screens.




13. BANK ACCOUNT MANAGEMENT


Create a Vallo-native:

Payment & Bank Accounts

area.

Features:

* add bank account
* verify account
* account name confirmation
* default withdrawal account
* remove account
* re-verify
* verification status
* last used
* security confirmation



Do not unnecessarily expose which API verified the account.




14. TRANSFERS


Create:

Send Money

instead of exposing “wallet transfer.”

Flow:
Recipient
Amount
Reason
Review
Confirm
Processing
Completed
Receipt
Show the Vallo transaction reference.

Provider reference can exist in transaction details where appropriate.




15. RECEIPTS


Every meaningful financial event should generate a Vallo receipt.

Examples:

* payment
* escrow funding
* release
* withdrawal
* transfer
* refund
* service payment
* booking payment
* transaction completion



Receipt branding:
VALLO

PAYMENT RECEIPT

Receipt
VRC-2026-000184

Transaction
VTX-2026-000912

Space
VSP-LAG-000184

Agreement
AGR-000184

Amount
₦1,800,000

Status
Completed

Date
...

Payment protection
Protected transaction

[ Download Receipt ]
[ Share ]
Provider details should only appear where appropriate or required.




16. TRANSACTION REFERENCES


Create a strong Vallo reference system.

Examples:
VTX-2026-000184
VRC-2026-000184
AGR-2026-000184
VSP-LAG-000184
Differentiate:

* Vallo transaction ID
* Vallo receipt number
* Agreement ID
* Space ID
* provider reference
* blockchain transaction hash



Never confuse them.




17. BLOCKCHAIN HASHES


If a transaction genuinely uses a blockchain rail:

Show:
Transaction hash
Network
Asset
Wallet address
Confirmation status
Provide an appropriate explorer link only where available.

If the transaction is fiat:

DO NOT manufacture a blockchain hash.

DO NOT label a provider reference as a transaction hash.

The UI should intelligently show only the information relevant to that transaction.




18. PAYMENT METHODS


Create a Vallo-native payment method selector.

Example:
Choose payment method

○ Bank / Account
○ Card
○ Stablecoin
○ Available Vallo funds
The actual provider is selected by the backend.

The user should not need to understand provider routing.

For example:
User selects:
USDC

Vallo backend:
Yellow Card adapter

User sees:
Pay with USDC
not:

Pay through Yellow Card.

Where provider disclosure is required, show it appropriately.




19. SMART PAYMENT ROUTING


Create a payment router capable of selecting the appropriate provider based on:

* country
* currency
* payment method
* transaction type
* escrow requirement
* transaction amount
* provider availability
* provider health
* supported rails
* compliance requirements



Example:
Nigeria
NGN
Escrow required
        ↓
EscrowPay
International
Stablecoin
        ↓
Yellow Card
Vallo premium feature
Direct commercial payment
        ↓
Paystack
Do not expose this complexity to the customer.




20. PROVIDER FAILOVER


Build provider health awareness.

If a provider becomes unavailable:
Provider unavailable
        ↓
Payment Router
        ↓
Alternative supported provider
Only fail over where the transaction type and compliance requirements allow it.

Never automatically duplicate or reroute a money-moving transaction in a way that can charge the customer twice.




21. “PROCESSING” MUST BE REAL


Do not fake successful payment states.

If the provider has not confirmed the transaction:

Show:

Payment processing

not:

Payment successful

Then reconcile provider state.




22. EXTERNAL REDIRECTS


Where an external provider redirect is technically unavoidable:

Make it feel like part of a Vallo workflow.

Example:
Secure payment
Preparing your payment...
Then return immediately to Vallo.

After return:
Payment confirmation
Never leave the user wondering whether they are still inside Vallo.

Handle:

* return URL
* cancelled payment
* failed payment
* successful payment
* timeout
* app background
* deep link
* browser return
* mobile return






23. HOSTED CHECKOUT


If a provider forces a hosted checkout that cannot be embedded:

Do NOT pretend Vallo owns the external page.

Instead:

1. Prepare transaction in Vallo.
2. Clearly explain the next step.
3. Open provider checkout only when necessary.
4. Return user to Vallo.
5. Verify server-side.
6. Display Vallo-native confirmation.
7. Create Vallo receipt.



The provider page is an infrastructure boundary, not the product experience.




24. KYC / VERIFICATION


If provider KYC is required:

Create a Vallo-native explanation screen first.

Example:

Verify your identity

A quick identity check is required before you can access this financial feature.

Your information is used for required financial verification.

Then launch the required provider/compliance flow.

After returning:
Verification
✓ Complete
Do not dump the user into a mysterious third-party screen without context.




25. ERROR ABSTRACTION


Never expose raw provider errors like:
ESCROWPAY_ERR_4827
CUSTOMER_ID_INVALID
PAYMENT_INTENT_STATUS_INVALID
Translate them into Vallo language.

Example:

We couldn’t complete that payment

Your bank/payment provider didn’t confirm the transaction.

No successful payment was recorded.

You can try again.

Keep raw provider errors in logs/admin debugging.




26. SUPPORT VIEW


Create a support-friendly transaction view.

When a user contacts Vallo:

Support should see:
Transaction
VTX-2026-000184

User
...

Space
...

Agreement
...

Amount
...

Vallo status
...

Provider status
...

Provider reference
...

Webhook status
...

Timeline
...

Reconciliation
...

Dispute
...

Receipt
...
This should dramatically reduce support resolution time.




27. ADMIN PROVIDER VISIBILITY


Important:

The provider should be hidden from normal customer UX, not from Vallo operations.

Admin/finance users with permission should be able to see:

* provider
* provider transaction ID
* provider status
* raw event reference
* webhook history
* reconciliation state
* settlement
* fees
* failure reason
* provider response metadata



This is critical for operations.




28. FINANCIAL AUDIT MODE


Add an internal:

Financial Audit

view.

Allow authorized staff to reconstruct:
What did the customer request?
What did Vallo create?
What did the provider receive?
What did the provider return?
What webhook arrived?
What did Vallo record?
What happened to the funds?
What receipt was issued?
This should be one of the strongest internal tools in the platform.




29. DISPUTE CENTER


Create Vallo-native dispute management.

User sees:
Transaction issue?

Open a dispute
Then:
What happened?
Evidence
Inspection
Messages
Review
Resolution
Not:

EscrowPay Dispute Center.

Internally it maps to the provider dispute system.




30. ESCROW EXPERIENCE


Use a simple Vallo concept:

Protected Payment

rather than constantly exposing the word “escrow” to consumers.

Example:


Protected


Your payment is currently protected while the required transaction conditions are completed.


Ready for release


Everything required for this transaction has been completed.


Released


The protected payment has been released.

You can still use “escrow” in legal, technical, educational and appropriate detailed contexts.




31. SPACE + MONEY


This is one of Vallo’s biggest differentiators.

Money should always understand the space.

For every relevant transaction show:
Space
Agreement
Parties
Amount
Protection
Conditions
Inspection
Documents
Timeline
Receipt
This creates the Vallo Space Operating System experience.




32. AGREEMENT + PAYMENT


A payment should be connected to an agreement whenever applicable.

Example:
Rental Agreement
      ↓
Payment obligation
      ↓
Vallo transaction
      ↓
Protected payment
      ↓
Inspection
      ↓
Release
Do not create disconnected payment records.




33. INSPECTION + PAYMENT


Allow transaction conditions to reference inspections.

Example:
Move-in inspection
✓ Completed

Required condition
✓ Satisfied

Protected payment
Ready for release
This should feel like one unified workflow.




34. DOCUMENT VAULT


Connect:

* agreement
* receipt
* inspection
* verification evidence
* payment evidence
* dispute evidence



into Vallo’s document system.

A user should be able to open:

Transaction Documents

and see everything relevant.




35. PAYMENT ACTIVITY CENTER


Create a unified financial activity feed.

Filters:
All
Payments
Protected
Withdrawals
Transfers
Refunds
Fees
Each item should be deeply linked.




36. SECURITY CENTER


Add a user-facing financial security area.

Features:

* recent financial activity
* active sessions where applicable
* payment methods
* bank accounts
* security notifications
* suspicious activity reporting
* transaction dispute
* account protection






37. TRANSACTION SEARCH


Users and authorized admins should be able to search by:

* Vallo transaction ID
* receipt number
* space ID
* agreement ID
* amount
* date
* participant



This is extremely useful operationally.




38. FINANCIAL NOTIFICATIONS


Create Vallo-native notifications:

Payment protected

Withdrawal processing

Withdrawal completed

Transfer received

Transaction ready for confirmation

Inspection completed

Payment released

Refund initiated

Refund completed

Dispute opened

Action required

Every notification should deep-link into the exact Vallo object.




39. FINANCIAL SHARING


Allow users to share appropriate receipts and transaction confirmations.

Example:

Share receipt

But never expose:

* secret keys
* sensitive bank information
* internal provider IDs unnecessarily
* private personal information
* internal risk data



Use privacy-safe receipt views.




40. PAYMENT LINKS


Consider adding a Vallo-native:

Request Payment

feature.

A Vallo user/business could create:
Payment Request

Amount
₦250,000

For
Office service

Space
VSP-LAG-000284

Description
...

Expires
...

[ Create Payment Request ]
Generate a Vallo payment link.

Example:
vallo.com/pay/VTX-...
The customer sees Vallo.

The provider operates underneath.




41. PAYMENT REQUESTS


Support:

* send request
* open request
* pay
* decline
* expire
* cancel
* reminder
* receipt
* transaction tracking



Useful for:

* agents
* landlords
* hotels
* restaurants
* service providers
* property managers
* businesses






42. SPLIT / MILESTONE PAYMENTS


Where supported by the underlying transaction model, build:

Payment milestones

Example:
₦10m project

25% Initial
✓

25% Foundation
✓

25% Structure
Pending

25% Completion
Locked
This becomes a powerful Vallo operating feature.




43. PAYMENT SCHEDULES


Add a payment schedule layer for applicable agreements.

Examples:
Rent
Deposit
Agency fee
Service charge
Installment
Milestone
Booking
Maintenance
Show:
Paid
Due
Upcoming
Overdue
Do not automatically debit unless explicitly authorized and supported.




44. TRUE COST


Integrate payments with Vallo’s True Cost Engine.

Instead of:

Rent: ₦2m

show where applicable:
Rent
₦2,000,000

Deposit
₦500,000

Agency
₦200,000

Legal
₦50,000

Service charge
₦150,000

Estimated utilities
₦...

Total move-in cost
₦...
Then clearly distinguish:

Amount due now

from:

Estimated total cost




45. TRANSACTION INTELLIGENCE


Add useful intelligence to transactions.

Examples:

Your payment is protected.

This agreement has 2 remaining conditions.

Your inspection is the final required step.

Your withdrawal is currently processing.

This transaction has been completed.

Do not create meaningless AI text.

Only show actionable information.




46. FRAUD / RISK SIGNALS


Financial risk detection should remain backend/admin controlled.

Potential signals:

* repeated failed payments
* rapid account creation
* suspicious referral relationship
* repeated withdrawals
* account mismatch
* abnormal transaction velocity
* unusual provider behavior
* repeated disputes



Do not expose sensitive internal risk scoring to ordinary users.

Instead show safe messages:

Additional verification required

or:

This transaction is temporarily under review.




47. FINANCIAL HEALTH


Admin dashboard should show:
Gross transaction volume
Protected funds
Completed volume
Withdrawals
Refunds
Disputes
Failed payments
Provider fees
Vallo revenue
Pending settlement
Reconciliation exceptions
Do not call internal balances “revenue” unless they actually represent revenue.




48. REVENUE SEPARATION


Clearly separate:
Customer funds
Provider-held/protected funds
Vallo revenue
Provider fees
Refunds
Payouts
Vallo revenue must never be confused with customer money.

This distinction must exist in the database, APIs, admin, reports and accounting logic.




49. MULTI-CURRENCY


Build currency-aware architecture.

Do not assume:
currency = NGN
everywhere.

Model:
amount
currency
minor/major unit rules
exchange rate
rate source
rate timestamp
settlement currency
Where conversion exists, clearly show:
Amount
Exchange rate
Converted amount
Fees
Final amount
Do not fabricate exchange rates.




50. DIASPORA


Vallo’s future diaspora experience should feel native.

Potential flow:
User in UK
      ↓
Selects space in Nigeria
      ↓
Sees NGN amount
      ↓
Sees estimated GBP equivalent
      ↓
Chooses supported payment method
      ↓
Vallo handles provider routing
      ↓
Protected transaction
      ↓
Vallo receipt
Do not make the user understand the underlying provider architecture.




51. PROVIDER TRANSPARENCY PAGE


Create an appropriate public/legal information page:

How Vallo Payments Work

Explain:

1. Vallo creates the transaction.
2. Financial infrastructure partners process applicable payments.
3. Vallo does not hold customer funds.
4. Protected transactions follow their applicable conditions.
5. Vallo records the transaction and workflow.
6. Users receive receipts and transaction history.
7. Provider/legal disclosures apply where required.



This builds trust without turning the homepage into a provider advertisement.




52. TRUST LANGUAGE


Never say:

Your money is 100% safe.

Never guarantee outcomes you cannot guarantee.

Prefer:

Protected transaction

Processed through regulated financial infrastructure partners

Vallo does not hold customer funds

Transaction conditions are recorded and tracked in Vallo

Disputes are handled according to the applicable transaction and provider terms




53. GLOBAL PROVIDER ABSTRACTION AUDIT


Search the entire application for provider leakage.

Check:

* frontend
* backend
* emails
* notifications
* receipts
* PDFs
* dashboards
* mobile
* landing pages
* docs
* help center
* error messages
* loading screens
* checkout
* transaction details
* payment methods
* support
* admin



Classify every occurrence:
KEEP
HIDE
REWRITE
LEGAL DISCLOSURE
ADMIN ONLY
TECHNICAL ONLY
Do not blindly remove provider names from areas where disclosure is legally or contractually required.




54. EXTRA FEATURE: VAllO TRANSACTION PASSPORT


Create a permanent transaction record.

Example:
Vallo Transaction Passport

VTX-2026-000184

Space
Agreement
Parties
Payment
Protection
Conditions
Inspection
Release
Receipt
Timeline
Documents
This becomes the complete history of the transaction.




55. EXTRA FEATURE: SPACE FINANCIAL HISTORY


For authorized users, a Space can eventually have:
Financial history
Rental payments
Booking transactions
Maintenance payments
Service payments
Deposits
Refunds
Never expose private financial information publicly.

This becomes part of the Space Passport.




56. EXTRA FEATURE: PAYMENT HEALTH


For landlords/businesses/hotels/agents:
Payment Health

Collected
Pending
Overdue
Failed
Refunded
Protected
This becomes part of their operating dashboard.




57. EXTRA FEATURE: SMART RECEIPT VAULT


Create:

Receipts

with:

* search
* filters
* categories
* download
* share
* transaction link
* agreement link
* space link



Receipts should remain available after the transaction.




58. EXTRA FEATURE: PAYMENT REMINDERS


For applicable recurring obligations:
Upcoming payment
Due in 3 days
₦250,000
Actions:

Pay now

View agreement

Contact recipient

Do not automatically charge unless an explicit supported authorization exists.




59. EXTRA FEATURE: TRANSACTION WATCH


Allow users to:

Watch transaction

Receive updates when:

* payment confirmed
* condition changes
* inspection completed
* dispute opened
* release occurs
* refund occurs






60. EXTRA FEATURE: FINANCIAL SEARCH


Natural language search could eventually support:

“Show my payments for apartments in Lagos this year.”

or:

“How much have I paid for this property?”

Only use data the user is authorized to access.




61. FINAL VISUAL STANDARD


The payment system should look like it was designed by the same team that designed the rest of Vallo.

Not:

Vallo + EscrowPay + Paystack + Yellow Card glued together.

Instead:

One Vallo product powered by sophisticated infrastructure underneath.

The user should experience:

one brand

one design language

one navigation system

one transaction model

one receipt system

one notification system

one support experience

one financial history

one Space Operating System.




62. FINAL ARCHITECTURE


The target architecture should conceptually be:
                         VALLO
                           │
                 ┌─────────┴─────────┐
                 │                   │
           Vallo Product       Vallo Admin
                 │                   │
                 └─────────┬─────────┘
                           │
                  Vallo Payment Engine
                           │
       ┌───────────────────┼───────────────────┐
       │                   │                   │
   EscrowPay Adapter     Paystack Adapter    Yellow Card Adapter
       │                   │                   │
    Escrow             Commercial         Stablecoin /
    Wallet             Payments           Cross-border
    Transfers                              Infrastructure
    Withdrawals
    Disputes
       │
       └──────────── Provider Infrastructure
Above all providers:
SPACE
AGREEMENT
PARTIES
TRANSACTION
PAYMENT
PROTECTION
CONDITIONS
INSPECTION
RELEASE
RECEIPT
DOCUMENTS
AUDIT
This is the Vallo layer.




63. FINAL MISSION


Do not merely integrate payment providers.

Build Vallo’s financial operating layer.

The customer should not need to understand:

* which API processed the payment
* which provider created the escrow
* which API verified the bank
* which provider routed the stablecoin
* which webhook updated the status



They should understand:

I am using Vallo.

They should see:

My payment is protected.

My transaction is being tracked.

My agreement is connected.

My inspection is connected.

My receipt is here.

My money status is clear.

My transaction history is permanent.

I know what happens next.

That is the experience we are building.

Vallo owns the experience. Providers power the infrastructure.

Do not sacrifice security, compliance, legal disclosure, or technical correctness in pursuit of visual abstraction.

Make the underlying architecture sophisticated.

Make the frontend feel simple.

Make the entire experience unmistakably Vallo.

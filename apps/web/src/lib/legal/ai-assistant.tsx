import type { ReactNode } from "react";
import { AI_PRIVACY_VERSION, AI_TERMS_VERSION } from "@/lib/assistant/permissions";

/**
 * THE FOUR VALLO AI ASSISTANT DOCUMENTS.
 *
 * Plain-language, versioned, and written to describe what the assistant
 * actually does and refuses to do (`lib/assistant/*`, the `ai_assistant_*`
 * database functions). The versions here are the ones a member accepts: the
 * database refuses an activation that names a different version, so a change
 * to a document is a new version string in `lib/assistant/permissions.ts`.
 *
 * COUNSEL SHOULD READ THESE BEFORE THEY ARE RELIED ON (docs/AI-ASSISTANT.md).
 * They state product behaviour; they are not a substitute for legal review.
 */

export type AiDocSection = { title: string; body: ReactNode };
export type AiDoc = {
  slug: "terms" | "privacy" | "permissions" | "security";
  title: string;
  lede: string;
  version: string;
  updated: string;
  sections: AiDocSection[];
};

const UPDATED = "1 November 2026";

export const AI_TERMS: AiDoc = {
  slug: "terms",
  title: "AI Assistant Terms of Service",
  lede: "The rules for VALLO AI, the personal assistant you can switch on in Settings.",
  version: AI_TERMS_VERSION,
  updated: UPDATED,
  sections: [
    {
      title: "1. What this is",
      body: (
        <>
          <p>
            VALLO AI is an assistant inside Vallo. It can search listings and stays, compare them, explain what a page says, and, if you allow it, look at your bookings and payments and prepare a viewing or a payment for you to approve. It is a tool that helps you do things on Vallo. It is not a person, not an agent, not a lawyer and not a financial adviser.
          </p>
          <p>
            These terms sit alongside the Vallo Terms of Service. If they disagree about the assistant, these terms decide.
          </p>
        </>
      ),
    },
    {
      title: "2. It is off until you turn it on",
      body: (
        <>
          <p>
            The assistant is off for every account. To turn it on you read this page and the AI Privacy Policy, tick two boxes and one agreement, and press Activate. Turning it on gives it public listings only. Everything about your account, bookings or money is a separate permission that you switch on yourself, one at a time.
          </p>
          <p>You can turn the assistant off, or take back any single permission, whenever you like.</p>
        </>
      ),
    },
    {
      title: "3. It can be wrong",
      body: (
        <>
          <p>
            The assistant writes its answers with an AI model. It can misread a question, miss something, or state a thing with more confidence than it has earned. Listing details come from the listing itself; check them on the listing page before you rely on them. What it says about prices, areas, fees, contracts or the law is information, not advice. Do not pay, sign or move in because the assistant said so. Visit, ask the lister, and read the agreement.
          </p>
        </>
      ),
    },
    {
      title: "4. You stay in control",
      body: (
        <>
          <p>The assistant proposes. You decide. In particular:</p>
          <ul>
            <li>It never books, pays, cancels or changes anything until you press the button that says so.</li>
            <li>It never says a viewing is confirmed until Vallo&rsquo;s booking system confirms it.</li>
            <li>A payment is made only after you review the summary, press Confirm, and pass the security check Vallo asks for at that moment.</li>
            <li>It cannot move money by itself, transfer money to anyone, or store your card details.</li>
          </ul>
        </>
      ),
    },
    {
      title: "5. What you must not do",
      body: (
        <>
          <p>
            Do not use the assistant to harm anyone, to break the law, to get around Vallo&rsquo;s rules, to harvest other people&rsquo;s information, or to try to make it reveal how it is protected. Do not paste passwords, card numbers or one-time codes into it. If it appears to be acting against your wishes, turn it off and tell us.
          </p>
          <p>
            If the assistant is asked, again and again in a short time, for things you have not allowed, it switches itself off for your account and our team may look at what happened.
          </p>
        </>
      ),
    },
    {
      title: "6. Limits and our responsibility",
      body: (
        <>
          <p>
            We work to make the assistant accurate, available and safe, but we do not promise it will be uninterrupted or error free. We are responsible for what Vallo itself does with your money and records, as set out in the Vallo Terms. We are not responsible for a decision you make only because the assistant suggested it, or for a listing, lister or host, who remain responsible for what they publish and do. Nothing here limits a right you have under Nigerian consumer or data protection law.
          </p>
        </>
      ),
    },
    {
      title: "7. Changes and ending",
      body: (
        <>
          <p>
            When we change these terms we publish a new version and ask you to read it. The assistant keeps working under the version you accepted until you accept the new one or turn it off. We may pause or withdraw the assistant, or switch it off for an account, to protect people or the platform. Turning it off never closes your account or deletes your bookings, payments or history.
          </p>
        </>
      ),
    },
    {
      title: "8. Law and contact",
      body: (
        <>
          <p>
            These terms are governed by the laws of the Federal Republic of Nigeria. For questions, problems or a person to talk to, use Help and Support inside Vallo. A human reads those messages, with no AI involved.
          </p>
        </>
      ),
    },
  ],
};

export const AI_PRIVACY: AiDoc = {
  slug: "privacy",
  title: "AI Privacy Policy",
  lede: "What the assistant sees, what is stored, who processes it and what you can do about it.",
  version: AI_PRIVACY_VERSION,
  updated: UPDATED,
  sections: [
    {
      title: "1. How this fits with the Vallo Privacy Policy",
      body: (
        <>
          <p>
            This page adds to the Vallo Privacy Policy. Vallo Spaces Ltd is the controller of your information under the Nigeria Data Protection Act 2023, for the assistant as for the rest of Vallo. Where the two differ about the assistant, this page decides.
          </p>
        </>
      ),
    },
    {
      title: "2. What the assistant can see",
      body: (
        <>
          <p>
            With the assistant off, nothing about your account is available to it. With it on, it can see only what you have allowed in Settings, and only the part needed to answer the question you asked:
          </p>
          <ul>
            <li>Public listings and stays, always, once it is on.</li>
            <li>What you saved and viewed, and the tastes you tell it, if you allow that.</li>
            <li>Your bookings and viewing requests, if you allow that.</li>
            <li>Your name and area, if you allow account details.</li>
            <li>Your payments, refunds and spending, and your Vallo balance, only if you allow each of those separately.</li>
          </ul>
          <p>
            It never receives your password, your passcode, sign-in codes, security keys, card numbers or card security codes. Those are not available to it at all.
          </p>
        </>
      ),
    },
    {
      title: "3. How it is retrieved",
      body: (
        <>
          <p>
            Vallo&rsquo;s own servers fetch the information. The assistant does not connect to your account. Each fetch is made as you, checks that you have allowed it at that moment, and returns only the fields needed. The model sees a small summary for that one answer, not your records.
          </p>
        </>
      ),
    },
    {
      title: "4. Who processes it",
      body: (
        <>
          <p>
            Questions and the summaries sent with them are processed by our AI model provider, Anthropic, a company in the United States, to write the answer. Under the commercial terms we use, what we send is not used to train its models, and it is kept only for a limited period for safety and abuse monitoring. Payments, where you ask for help with one, go through Vallo&rsquo;s existing payment systems and our licensed provider, never through the assistant or the model.
          </p>
        </>
      ),
    },
    {
      title: "5. What we keep, and for how long",
      body: (
        <>
          <ul>
            <li>
              <strong>Your settings and permissions:</strong> while the assistant is on. Turning it off removes every permission.
            </li>
            <li>
              <strong>What it learned about your tastes:</strong> until you clear it. You can review, change and clear it in Settings.
            </li>
            <li>
              <strong>A security record</strong> of sensitive things the assistant did or was refused (the time, the permission and the outcome, never secrets). It is kept after you turn the assistant off, for as long as needed to investigate problems and meet legal duties.
            </li>
            <li>
              <strong>Conversations:</strong> on your device, and for signed-in members on our servers under your account, as described in the Vallo Privacy Policy. Deleting your account deletes them.
            </li>
          </ul>
        </>
      ),
    },
    {
      title: "6. Your choices",
      body: (
        <>
          <p>
            You can turn the assistant off, take back any permission, see its recent activity, clear what it learned, and delete a conversation, all from Settings. You can ask for a copy of your information, correct it, or complain to us or to the Nigeria Data Protection Commission, using the routes in the Vallo Privacy Policy. Turning the assistant off does not delete your account or your records.
          </p>
        </>
      ),
    },
    {
      title: "7. Children",
      body: (
        <>
          <p>The assistant is for people aged 18 and over, as Vallo is.</p>
        </>
      ),
    },
    {
      title: "8. Contact",
      body: (
        <>
          <p>Use Help and Support inside Vallo for any question about this policy. A person reads it.</p>
        </>
      ),
    },
  ],
};

export const AI_PERMISSIONS_DOC: AiDoc = {
  slug: "permissions",
  title: "AI Permissions and Data Access",
  lede: "Each thing the assistant can read or do, what it needs from you, and what turning it off changes.",
  version: AI_PRIVACY_VERSION,
  updated: UPDATED,
  sections: [
    {
      title: "1. Reading is not doing",
      body: (
        <>
          <p>
            Permissions come in two kinds. <strong>Reads</strong> let the assistant look at information so it can answer you. <strong>Acts</strong> let it start something, such as a viewing request or a payment summary, and every act waits for your own confirmation. Allowing it to read your transactions does not let it pay for anything.
          </p>
        </>
      ),
    },
    {
      title: "2. The eight permissions",
      body: (
        <>
          <ul>
            <li>
              <strong>Property and stay discovery (reads).</strong> Searching and comparing public listings and stays. This is the floor: it is on whenever the assistant is on.
            </li>
            <li>
              <strong>Saved properties and what you like (reads).</strong> What you saved and viewed, and the tastes you tell it, so it can pick for you. You can review and clear them.
            </li>
            <li>
              <strong>Bookings and viewings (acts, with your approval).</strong> Your bookings and viewing requests, real viewing times, and proposing a viewing or a change for you to approve.
            </li>
            <li>
              <strong>Your account details (reads).</strong> Your name, area and settings so answers fit you. Never your password, passcode or codes.
            </li>
            <li>
              <strong>Transaction history (reads, sensitive).</strong> Payments, receipts, refunds and what you spent. Read only.
            </li>
            <li>
              <strong>Wallet balance (reads, sensitive).</strong> Your Vallo balance and what is pending. Read only.
            </li>
            <li>
              <strong>Payment help (acts, sensitive).</strong> Preparing a payment summary for something you owe. It needs access to your transactions or your bookings first. Nothing is paid until you confirm.
            </li>
            <li>
              <strong>Reminders and updates (acts).</strong> Reminders about viewings and bookings through your normal Vallo notifications.
            </li>
          </ul>
        </>
      ),
    },
    {
      title: "3. Sensitive permissions",
      body: (
        <>
          <p>
            Transactions, balance and payment help are never switched on when you activate the assistant. You switch each on yourself, afterwards, and Vallo asks you to unlock your session with your passcode first. A locked session shares no money information.
          </p>
        </>
      ),
    },
    {
      title: "4. Taking permissions back",
      body: (
        <>
          <p>
            You can take back one permission without turning the assistant off. It takes effect on the very next request, anything the assistant was preparing is cancelled, and if you take back the last permission payment help rests on, payment help goes too. Taking back discovery turns the assistant off.
          </p>
        </>
      ),
    },
    {
      title: "5. What turning the assistant off does",
      body: (
        <>
          <ul>
            <li>Every permission is revoked at once and its access is invalidated.</li>
            <li>It can no longer read anything private, and anything it was preparing is cancelled.</li>
            <li>Your account, bookings, payments, balance and history are untouched.</li>
            <li>A security record of what it did is kept.</li>
          </ul>
        </>
      ),
    },
    {
      title: "6. Where to manage it",
      body: (
        <>
          <p>Settings, then VALLO AI Assistant. You can see your permissions, what it learned, and its recent activity there.</p>
        </>
      ),
    },
  ],
};

export const AI_SECURITY: AiDoc = {
  slug: "security",
  title: "AI Security and User Protection",
  lede: "How Vallo keeps the assistant from seeing, or doing, anything you have not allowed.",
  version: AI_PRIVACY_VERSION,
  updated: UPDATED,
  sections: [
    {
      title: "1. The assistant is never the lock",
      body: (
        <>
          <p>
            We do not rely on the AI model to follow rules. Permissions are enforced by Vallo&rsquo;s servers and database, which check who you are and what you allowed on every request, and again before every action. If the model is tricked, confused or wrong, the lock still holds.
          </p>
        </>
      ),
    },
    {
      title: "2. Your data stays yours",
      body: (
        <>
          <ul>
            <li>Every lookup runs as you, under the database&rsquo;s row level security, so it cannot reach another person&rsquo;s records.</li>
            <li>The assistant receives only the smallest piece of information needed for one answer.</li>
            <li>Passwords, passcodes, sign-in codes, security keys, card numbers and card security codes are never given to the model.</li>
            <li>Communication is encrypted in transit, and sensitive stored information is protected as the rest of Vallo is.</li>
          </ul>
        </>
      ),
    },
    {
      title: "3. Payments",
      body: (
        <>
          <p>
            The assistant cannot pay. It can prepare a summary showing the service, the recipient, the amount and any fees. A payment starts only when you press Confirm, and Vallo then asks for the security check it uses for all money, with your session unlocked. The result you see is the result our licensed provider returns. If a payment fails you are told, and you can retry safely. The assistant never stores card details and never makes a hidden transaction.
          </p>
        </>
      ),
    },
    {
      title: "4. Protection against manipulation",
      body: (
        <>
          <p>
            Listings, messages and posts are written by other people, and someone could try to hide instructions in them. Everything the assistant reads is treated as data, marked as such to the model, and cannot grant itself a permission or start an action. Only the buttons you press can do that. Inputs are validated and outputs are cleaned before they are shown.
          </p>
        </>
      ),
    },
    {
      title: "5. Limits, logs and monitoring",
      body: (
        <>
          <ul>
            <li>Requests are rate limited for each account.</li>
            <li>Sensitive actions and refused requests are written to a security record that you can see in Settings.</li>
            <li>If the assistant is asked eight times in ten minutes for things you have not allowed, it switches itself off for your account and our team is alerted.</li>
            <li>Confirmations expire after a short time and cannot be reused.</li>
          </ul>
        </>
      ),
    },
    {
      title: "6. If something looks wrong",
      body: (
        <>
          <p>
            Turn the assistant off in Settings, then tell us through Help and Support. A person reads it. Turning it off revokes every permission immediately and does not touch your records.
          </p>
        </>
      ),
    },
  ],
};

export const AI_DOCS: Record<AiDoc["slug"], AiDoc> = {
  terms: AI_TERMS,
  privacy: AI_PRIVACY,
  permissions: AI_PERMISSIONS_DOC,
  security: AI_SECURITY,
};

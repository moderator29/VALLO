"use client";

import { useState } from "react";

import { CodeInput } from "@/components/auth/CodeInput";
import { TextField } from "@/components/ui/Field";
import { NairaField } from "@/components/ui/NairaField";

/**
 * The fields that paste and the keyboard pass changed, on one page: the code
 * cells with their Paste button, a code in the shared field, and a phone
 * number, an email and an amount that clean what is pasted into them.
 */
/** The code cells, inside the auth frame they are drawn for. */
export function CodeDeck() {
  const [code, setCode] = useState("");
  return (
    <div className="nf-auth__form nf-auth__form--fields" data-testid="code-deck">
      <CodeInput id="deck-code" name="code" label="The code from your email" length={6} value={code} onChange={setCode} wrongCount={0} placeholder="000000" cellsLabel="Six digit code" />
    </div>
  );
}

export function FieldsDeck() {
  const [otp, setOtp] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  return (
    <div className="flex flex-col gap-md" data-testid="fields-deck">
      <header className="flex flex-col gap-2xs">
        <h1 className="nf-h2">Fields</h1>
        <p className="nf-body-sm text-[var(--nf-content-secondary)]">
          Paste a code in one tap. A pasted phone number, email or amount is cleaned as it lands. Each field asks the
          phone for the keyboard that fits it.
        </p>
      </header>
      <section className="nf-glass nf-glass--card flex flex-col gap-sm p-md" aria-label="A one-time code">
        <h2 className="nf-h4">A one-time code</h2>
        <TextField
          label="Withdrawal code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={8}
          value={otp}
          onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
          data-testid="deck-otp"
        />
      </section>
      <section className="nf-glass nf-glass--card flex flex-col gap-sm p-md" aria-label="A short form">
        <h2 className="nf-h4">A short form</h2>
        <TextField label="Full name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} data-testid="deck-name" />
        <TextField label="Phone number" type="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} data-testid="deck-phone" />
        <TextField label="Email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} data-testid="deck-email" />
        <NairaField label="Yearly rent" value={amount} onValueChange={setAmount} data-testid="deck-amount" />
      </section>
    </div>
  );
}

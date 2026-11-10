"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { banner } from "@/lib/ui/toast";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { addProspect } from "@/lib/admin/business-development/actions";
import { BD_CATEGORIES, BD_CATEGORY_LABEL } from "@/lib/admin/business-development/types";

/**
 * Add a prospect: one plain, fast form, not a page of fields nobody fills
 * in. Contact route (email or phone), business name, category and who to
 * talk to are the whole of it; everything else is edited from the pipeline.
 */
export function AddProspectForm() {
  const [contactName, setContactName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [category, setCategory] = useState<string>(BD_CATEGORIES[0]);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [pending, start] = useSafeTransition();
  const router = useRouter();

  function submit() {
    start(async () => {
      const result = await addProspect({ contactName, businessName, category, email, phone, location });
      if (!result.ok) {
        banner.error(result.error);
        return;
      }
      banner.success("Added to your pipeline.");
      setContactName("");
      setBusinessName("");
      setEmail("");
      setPhone("");
      setLocation("");
      router.refresh();
    });
  }

  return (
    <form
      className="grid gap-xs"
      data-testid="add-prospect-form"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="grid gap-xs sm:grid-cols-2">
        <label className="grid gap-2xs nf-body">
          <span>Business name</span>
          <input className="nf-field" required value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
        </label>
        <label className="grid gap-2xs nf-body">
          <span>Who you are talking to</span>
          <input className="nf-field" required value={contactName} onChange={(e) => setContactName(e.target.value)} />
        </label>
      </div>
      <div className="grid gap-xs sm:grid-cols-3">
        <label className="grid gap-2xs nf-body">
          <span>Category</span>
          <select className="nf-field" value={category} onChange={(e) => setCategory(e.target.value)}>
            {BD_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {BD_CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2xs nf-body">
          <span>Email</span>
          <input className="nf-field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="grid gap-2xs nf-body">
          <span>Phone</span>
          <input className="nf-field" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
      </div>
      <label className="grid gap-2xs nf-body">
        <span>Location</span>
        <input className="nf-field" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Lekki, Lagos" />
      </label>
      <Button type="submit" variant="primary" loading={pending} data-testid="add-prospect-submit">
        Add to pipeline
      </Button>
    </form>
  );
}

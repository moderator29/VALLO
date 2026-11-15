"use client";

import { useId, useRef, useState } from "react";
import type {
  CSSProperties,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { counterFor } from "@/lib/ui/small-rules";
import { FieldProblem } from "@/components/ui/FieldProblem";
import { PasteCodeButton } from "@/components/ui/PasteCodeButton";
import { cleanKindFor, cleanOnPaste, setFieldValue } from "@/lib/paste/field-paste";
import { PROSE_KEYBOARD, keyboardFor } from "@/lib/ui/field-keyboard";

/**
 * Form fields.
 *
 * The bug this is shaped around: `.nf-field` paints its border with a
 * `border-box` gradient over a `1px solid transparent` border. The error rule
 * beside it, `.nf-field[aria-invalid="true"] { border-color: … }`, therefore has
 * NO VISIBLE EFFECT - the gradient layer covers the border box, so setting the
 * border's colour changes a surface nobody can see. Validation errors were being
 * computed, `aria-invalid` was being set, and the field looked exactly as it did
 * a moment earlier. A screen reader knew; nobody else did.
 *
 * The fix is not a stronger border colour. It is to stop depending on the border
 * at all: an invalid field replaces the gradient's OWN border-box layer and adds
 * a ring. Written inline here rather than as a rule, so it lands over the
 * gradient without a specificity argument and without this primitive editing
 * globals.css. The keyboard focus ring is an `outline` and so survives the
 * override untouched, which matters - an invalid field is the one a user is most
 * likely to be tabbing back into.
 *
 * What else it owns, because 0 call sites had all of it: the label/control id
 * pairing, `aria-describedby` across hint AND error, `aria-invalid`, the clear
 * affordance (which existed nowhere), a leading icon slot (hand-rolled four
 * different ways across four search bars at three type sizes), and the 16px
 * floor on coarse pointers.
 */

/* ------------------------------------------------------------------ Field */

/**
 * The props a control must spread to be wired to its label, hint and error.
 * Handed to the child rather than cloned onto it: cloning guesses at the
 * element's shape, and every field on this platform that is not an input -
 * a date range, a phone entry, a map picker - would have to be guessed at too.
 */
export type FieldControlProps = {
  id: string;
  "aria-describedby": string | undefined;
  "aria-invalid": true | undefined;
  "aria-required": true | undefined;
};

export type FieldProps = {
  label: string;
  /** Steady guidance shown before anything goes wrong. */
  hint?: string;
  /** The message. Its presence is what puts the field in the error state. */
  error?: string;
  required?: boolean;
  /**
   * The localised word for "optional", rendered beside the label.
   *
   * A string rather than a boolean because this platform ships four locales,
   * and a hardcoded "Optional" here would be the one untranslated word in an
   * otherwise translated form. Omit it and no marker is drawn.
   */
  optionalText?: string;
  /** Visually hides the label while keeping it as the control's name. */
  hideLabel?: boolean;
  /**
   * Pins the control's id. Omit unless something outside this component
   * addresses the field by id - a spec, an external label, a deep link.
   */
  id?: string;
  className?: string;
  /** A quiet line under the control, at the end: the character counter. */
  counter?: ReactNode;
  children(control: FieldControlProps): ReactNode;
};

export function Field({
  label,
  hint,
  error,
  required = false,
  optionalText,
  hideLabel = false,
  id: fixedId,
  className,
  counter,
  children,
}: FieldProps) {
  /*
   * A caller-supplied id wins over the generated one.
   *
   * `useId` is the right default - it is what stopped the wallet drawers from
   * rendering three controls all called `nf-wallet-amount` - but it makes the
   * id unpredictable, and some controls are addressed from outside the
   * component: a Playwright spec, an external `<label for>`, an anchor that
   * deep-links to a field. Migrating SupportChat's escalation fields onto this
   * primitive silently renamed `#support-escalation-email` and broke the spec
   * that fills it, which is exactly the failure this prop prevents.
   */
  const base = useId();
  const id = fixedId ?? `${base}-control`;
  const hintId = `${base}-hint`;
  const errorId = `${base}-error`;
  const invalid = Boolean(error);

  /*
   * Both, in reading order, not one or the other. A field commonly needs its
   * hint AND its error - "we never share this" plus "that is not a valid
   * number" - and describing only the error loses the guidance exactly when the
   * user is trying to comply with it.
   */
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className={["w-full", className ?? ""].filter(Boolean).join(" ")}>
      <label htmlFor={id} className={hideLabel ? "sr-only" : "nf-label flex items-center gap-inline-tight"}>
        <span>{label}</span>
        {required ? (
          /* A glyph, not a word, so it needs no translation. The real
             requirement is announced by `aria-required` on the control. */
          <span aria-hidden="true" className="text-[var(--nf-state-error)]">
            *
          </span>
        ) : null}
        {optionalText ? (
          <span className="font-normal text-[var(--nf-content-muted)]">{optionalText}</span>
        ) : null}
      </label>

      {children({
        id,
        "aria-describedby": describedBy,
        "aria-invalid": invalid || undefined,
        "aria-required": required || undefined,
      })}

      {counter}
      {hint ? (
        <p id={hintId} className="mt-xs text-[length:var(--nf-text-caption)] text-[var(--nf-content-muted)]">
          {hint}
        </p>
      ) : null}
      {/*
       * THE WORDS GO TO THE BANNER (founder, 7 November 2026, "THE BANNER
       * EVERYWHERE"). The field keeps its red ring (`aria-invalid`, above);
       * the message is said once at the top of the screen and stays here,
       * visually hidden, as the note `aria-describedby` names, so a screen
       * reader still hears it on the control. It used to be a red caption
       * under the field with `role="alert"`.
       */}
      <FieldProblem id={errorId} message={error} />

    </div>
  );
}

/* ------------------------------------------------------- shared internals */

/**
 * VALIDATION ON BLUR, NOT ON EVERY KEY (details pass, 30 September 2026).
 *
 * A field that turns red on the first keystroke of an email address is
 * scolding somebody for not having finished. `validate` runs when the reader
 * LEAVES the field; once it has shown a message, it re-runs as they type, so
 * the message goes the moment the value is right ("late to scold, quick to
 * forgive"). An `error` from the caller (a server refusal) always wins.
 */
function useBlurValidation(
  validate: ((value: string) => string | null | undefined) | undefined,
  external: string | undefined,
) {
  const [touched, setTouched] = useState(false);
  const [own, setOwn] = useState<string | null>(null);
  return {
    error: external ?? (touched && own ? own : undefined),
    onBlurValue(value: string) {
      if (!validate) return;
      setTouched(true);
      setOwn(validate(value) ?? null);
    },
    onChangeValue(value: string) {
      if (validate && touched) setOwn(validate(value) ?? null);
    },
  };
}

function Counter({ length, max }: { length: number; max: number | undefined }) {
  const { show, over } = counterFor(length, max);
  if (!show) return null;
  return (
    <p className="nf-field-count" data-over={over || undefined} aria-live="polite">
      {length} / {max}
    </p>
  );
}

/** 48 / 56px. The same two rungs the buttons use, so a field and the button
 *  beside it agree on height without either being nudged. */
type ControlSize = "md" | "lg";

const HEIGHT: Record<ControlSize, string> = { md: "h-12", lg: "h-14" };

/**
 * `default` is the form input on a card. `glass` is the renders' search well:
 * dark glass, the soft brand hairline, the rim along its top, a glyph inside.
 * The height is the caller's `size`; the render's search field is `lg`.
 */
export type FieldMaterial = "default" | "glass";
/** The amended radius law (ledger section 8): the landing's search pill is a capsule. */
export type FieldShape = "control" | "pill";

/**
 * `pointer-coarse` is the whole point: mobile Safari zooms the viewport whenever
 * a focused control's font-size is under 16px, and the platform's body size is
 * 14px. Scoped to coarse pointers so the desktop type scale is untouched. This
 * duplicates a global rule deliberately - a primitive that silently depends on a
 * rule it does not own breaks the day that rule is refactored.
 *
 * AND IT IS `px`, NOT `rem`, AND NOT `--nf-text-body`, WHICH IS ALSO 16.
 *
 * This is the one site in the tree that `nf/no-arbitrary-font-size` reports and
 * should not fix, so it is worth writing down why rather than leaving the next
 * person to re-derive it from a disable comment.
 *
 * `--nf-text-body` is `1rem`, and `1rem` is 16 pixels only while the root font
 * size is 16 pixels. A reader who has set their browser's default text to 12px
 * gets a 12px field and Safari hijacks the viewport on every tap into it -
 * which is precisely the reader most likely to have changed that setting. The
 * threshold is stated by the platform in absolute pixels, so it is answered in
 * absolute pixels. The scale is not involved; this is hardware, in the same
 * category as the `env()` and `calc()` values `nf/no-raw-spacing` lets through.
 */
// eslint-disable-next-line nf/no-arbitrary-font-size -- 16px is Safari's zoom threshold in absolute pixels, not a rung: see above.
const FIELD_TYPE = "text-[length:var(--nf-text-body)] pointer-coarse:text-[16px]";

/**
 * The invalid override.
 *
 * Both layers of the background have to be restated: the padding-box fill keeps
 * the field's material, and the border-box layer is what replaces the brand
 * gradient with the error colour. Restating only the border-box half would
 * blank the fill.
 */
/*
 * Exported because a control that cannot be a real `<input>` still has to show
 * the same error. `ChoicePicker`'s control is a `<button>` wearing `.nf-field`,
 * so it cannot go through `Field` - and it was forced to restate this recipe
 * locally, which is exactly how the two drift apart. One definition, both
 * callers.
 */
export const INVALID_STYLE: CSSProperties = {
  background:
    "linear-gradient(var(--nf-surface-inset), var(--nf-surface-inset)) padding-box, linear-gradient(var(--nf-state-error), var(--nf-state-error)) border-box",
  boxShadow: "0 0 0 3px color-mix(in oklab, var(--nf-state-error) 26%, transparent)",
};

function controlClass({
  size,
  leading,
  trailing,
  material = "default",
  shape = "control",
  className,
}: {
  size: ControlSize;
  leading: boolean;
  trailing: boolean;
  material?: FieldMaterial;
  shape?: FieldShape;
  className?: string;
}) {
  return [
    "nf-field block",
    material === "glass" ? "nf-field--glass" : "",
    shape === "pill" ? "nf-field--pill" : "",
    HEIGHT[size],
    FIELD_TYPE,
    "py-0",
    /* `affordance` is a padding ROLE, not a rung: it is the inset a field
       needs when an icon or a clear button is sitting inside it, and it has to
       clear a 44px tap target rather than land on the content ladder. See the
       note beside --nf-pad-field-affordance. */
    leading ? "pl-affordance" : "pl-md",
    trailing ? "pr-affordance" : "pr-md",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** Slots sit above the control and must not eat its clicks; the clear button
 *  re-enables its own pointer events. */
const SLOT = "pointer-events-none absolute top-1/2 -translate-y-1/2 text-[var(--nf-content-muted)]";

/* -------------------------------------------------------------- TextField */

export type TextFieldProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "size" | "className" | "id"
> &
  Omit<FieldProps, "children"> & {
    /**
     * Tells the mobile keyboard what the enter key should say.
     *
     * Already part of `InputHTMLAttributes`, surfaced here so callers see it
     * beside `inputMode` and `autoComplete` without digging into the HTML
     * attribute spread. Passed straight through to the `<input>`.
     */
    enterKeyHint?: "enter" | "done" | "go" | "next" | "previous" | "search" | "send";
    leadingIcon?: UiIconName;
    /**
     * A leading glyph that is not a `UiIcon`: a glass `BrandIcon` in the well,
     * the way the renders draw the search and the pin. `leadingIcon` wins when
     * both are given, because it is the older contract.
     */
    glyph?: ReactNode;
    material?: FieldMaterial;
    shape?: FieldShape;
    /** An eye toggle, a unit, a filter opener. Sits where the clear button would. */
    trailing?: ReactNode;
    /**
     * The clear affordance's ACCESSIBLE LABEL, and its on switch.
     *
     * A string rather than a boolean because an unlabelled × is invisible to a
     * screen reader, and a boolean leaves nowhere to put the localised word. If
     * you have no label to give, you are not ready to ship the button.
     */
    clearable?: string;
    /** Clears the caller's state. Required for a controlled field to stay clear. */
    onClear?(): void;
    size?: ControlSize;
    inputClassName?: string;
    /** Checked when the reader leaves the field; see `useBlurValidation`. */
    validate?: (value: string) => string | null | undefined;
    /** Shows the counter near `maxLength`. Off for fields whose limit is a format (a phone, a code). */
    showCount?: boolean;
  };

export function TextField({
  label,
  hint,
  error,
  required,
  optionalText,
  hideLabel,
  className,
  leadingIcon,
  glyph,
  material,
  shape,
  trailing,
  clearable,
  onClear,
  size = "md",
  inputClassName,
  onChange,
  onBlur,
  validate,
  showCount = false,
  ...rest
}: TextFieldProps) {
  const ref = useRef<HTMLInputElement | null>(null);
  const checked = useBlurValidation(validate, error);
  const [typedLength, setTypedLength] = useState(String(rest.defaultValue ?? "").length);
  /*
   * Uncontrolled fields have no `value` prop to read, so emptiness is tracked
   * here. Controlled ones ignore this entirely - their prop is the truth.
   */
  const [typedInto, setTypedInto] = useState(
    String(rest.defaultValue ?? "").length > 0,
  );
  const controlled = rest.value !== undefined;
  const filled = controlled ? String(rest.value ?? "").length > 0 : typedInto;
  /*
   * THE PHONE KEYBOARD, SET FOR WHAT IS TYPED (13 November 2026; the whole
   * table on 14 November, `lib/ui/field-keyboard.ts`). An email is never
   * capitalised, corrected or spell-checked and gets the @ keyboard; a phone
   * number the phone pad; a code the number pad; a name a capital on each
   * word; a search field a Search key. Read from what the field already says
   * (its type, its autocomplete token, its keyboard). Defaults only: anything
   * the call site passes wins, because it is spread after.
   */
  const keyboard = keyboardFor({ type: rest.type, autoComplete: rest.autoComplete, inputMode: rest.inputMode, name: rest.name });
  const showClear = Boolean(clearable) && filled && !rest.disabled && !rest.readOnly;
  /*
   * PASTE (14 November 2026). A phone or email field cleans what is pasted
   * into it ("+234 (803) 123-4567" lands as +2348031234567); a one-time code
   * field gets a Paste button that fills it from the clipboard in one tap.
   * Typing is never touched, and a call site's own `onPaste` still runs.
   */
  const cleanKind = cleanKindFor(rest);
  const isCode = rest.autoComplete === "one-time-code" && !rest.disabled && !rest.readOnly;

  const clear = () => {
    /*
     * Two steps because the two modes clear differently: the DOM write is what
     * empties an uncontrolled input, and `onClear` is what empties a controlled
     * one. Focus returns to the field either way - a user who cleared a search
     * is about to type another one, and sending them back to the top of the
     * document to find the box again is the failure this affordance exists to
     * avoid.
     */
    if (ref.current && !controlled) ref.current.value = "";
    setTypedInto(false);
    onClear?.();
    ref.current?.focus();
  };

  return (
    <Field
      label={label}
      hint={hint}
      error={checked.error}
      counter={showCount ? <Counter length={rest.value !== undefined ? String(rest.value ?? "").length : typedLength} max={rest.maxLength} /> : undefined}
      required={required}
      optionalText={optionalText}
      hideLabel={hideLabel}
      /* Down to Field, not onto the control: {...control} is spread after
         {...rest}, so an id set there is immediately overwritten by the
         generated one. Field is the single owner of the id. */
      id={rest.id}
      className={className}
    >
      {(control) => (
        <>
        <div className="relative">
          {leadingIcon ? (
            <span className={`${SLOT} left-3.5`}>
              <UiIcon name={leadingIcon} size={20} />
            </span>
          ) : glyph ? (
            <span className="nf-field__glyph" aria-hidden="true">
              {glyph}
            </span>
          ) : null}

          <input
            {...keyboard}
            {...rest}
            {...control}
            ref={ref}
            className={controlClass({
              size,
              leading: Boolean(leadingIcon) || Boolean(glyph),
              trailing: showClear || Boolean(trailing),
              material,
              shape,
              className: inputClassName,
            })}
            style={checked.error ? INVALID_STYLE : undefined}
            onChange={(event) => {
              if (!controlled) setTypedInto(event.target.value.length > 0);
              setTypedLength(event.target.value.length);
              checked.onChangeValue(event.target.value);
              onChange?.(event);
            }}
            onBlur={(event) => {
              checked.onBlurValue(event.target.value);
              onBlur?.(event);
            }}
            onPaste={(event) => {
              rest.onPaste?.(event);
              if (!event.defaultPrevented && cleanKind) cleanOnPaste(event, cleanKind);
            }}
          />

          {showClear ? (
            <button
              type="button"
              onClick={clear}
              aria-label={clearable}
              /* 44pt of hit area on a 20px glyph, the same overlay trick the
                 chips use: the icon stays small, the target does not. */
              className={`${SLOT} right-1 pointer-events-auto grid size-11 place-items-center rounded-control hover:text-[var(--nf-content-primary)]`}
            >
              <UiIcon name="close" size={16} />
            </button>
          ) : trailing ? (
            <span className={`${SLOT} right-3.5`}>{trailing}</span>
          ) : null}
        </div>
        {isCode ? (
          <div className="nf-paste-code__row">
            <PasteCodeButton
              length={rest.maxLength && rest.maxLength > 0 ? rest.maxLength : 6}
              onCode={(code) => {
                if (!ref.current) return;
                setFieldValue(ref.current, code);
                ref.current.focus();
              }}
            />
          </div>
        ) : null}
        </>
      )}
    </Field>
  );
}

/* ------------------------------------------------------------ SelectField */

export type SelectFieldProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "size" | "className" | "id"
> &
  Omit<FieldProps, "children"> & {
    /**
     * Tells the mobile keyboard what the enter key should say.
     *
     * Not part of `SelectHTMLAttributes` (the spec ties it to text inputs),
     * but mobile browsers respect it on a `<select>` when a soft keyboard is
     * open beside a picker. Passed straight through to the `<select>`.
     */
    enterKeyHint?: "enter" | "done" | "go" | "next" | "previous" | "search" | "send";
    leadingIcon?: UiIconName;
    /** See `TextFieldProps.glyph`. */
    glyph?: ReactNode;
    material?: FieldMaterial;
    shape?: FieldShape;
    size?: ControlSize;
    selectClassName?: string;
  };

export function SelectField({
  label,
  hint,
  error,
  required,
  optionalText,
  hideLabel,
  className,
  enterKeyHint,
  leadingIcon,
  glyph,
  material,
  shape,
  size = "md",
  selectClassName,
  children,
  ...rest
}: SelectFieldProps) {
  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      required={required}
      optionalText={optionalText}
      hideLabel={hideLabel}
      /* Down to Field, not onto the control: {...control} is spread after
         {...rest}, so an id set there is immediately overwritten by the
         generated one. Field is the single owner of the id. */
      id={rest.id}
      className={className}
    >
      {(control) => (
        <div className="relative">
          {leadingIcon ? (
            <span className={`${SLOT} left-3.5`}>
              <UiIcon name={leadingIcon} size={20} />
            </span>
          ) : glyph ? (
            <span className="nf-field__glyph" aria-hidden="true">
              {glyph}
            </span>
          ) : null}

          <select
            {...rest}
            {...control}
            enterKeyHint={enterKeyHint}
            /*
             * `appearance-none` is not cosmetic here. The native control paints
             * its own arrow at its own size in its own colour, differently in
             * every browser, and on the dark theme Safari's is nearly invisible
             * against the inset fill. Stripping it and drawing our own chevron
             * is the only way the control looks like the rest of the form.
             */
            className={`${controlClass({
              size,
              leading: Boolean(leadingIcon) || Boolean(glyph),
              trailing: true,
              material,
              shape,
              className: selectClassName,
            })} appearance-none`}
            style={error ? INVALID_STYLE : undefined}
          >
            {children}
          </select>

          <span className={`${SLOT} right-3.5`}>
            <UiIcon name="chevron-down" size={16} />
          </span>
        </div>
      )}
    </Field>
  );
}

/* --------------------------------------------------------------- TextArea */

export type TextAreaProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "className" | "id"
> &
  Omit<FieldProps, "children"> & {
    textAreaClassName?: string;
    /** Checked when the reader leaves the field; see `useBlurValidation`. */
    validate?: (value: string) => string | null | undefined;
    /** The counter near `maxLength`; on by default for long text. */
    showCount?: boolean;
  };

export function TextArea({
  label,
  hint,
  error,
  required,
  optionalText,
  hideLabel,
  className,
  rows = 4,
  textAreaClassName,
  validate,
  showCount = true,
  onChange,
  onBlur,
  ...rest
}: TextAreaProps) {
  const checked = useBlurValidation(validate, error);
  const [typedLength, setTypedLength] = useState(String(rest.defaultValue ?? "").length);
  const length = rest.value !== undefined ? String(rest.value ?? "").length : typedLength;
  return (
    <Field
      label={label}
      hint={hint}
      error={checked.error}
      counter={showCount ? <Counter length={length} max={rest.maxLength} /> : undefined}
      required={required}
      optionalText={optionalText}
      hideLabel={hideLabel}
      /* Down to Field, not onto the control: {...control} is spread after
         {...rest}, so an id set there is immediately overwritten by the
         generated one. Field is the single owner of the id. */
      id={rest.id}
      className={className}
    >
      {(control) => (
        <textarea
          /* A box for prose: sentences start with a capital and the return
             key makes a new line. Defaults; the call site's own win. */
          {...PROSE_KEYBOARD}
          {...rest}
          {...control}
          rows={rows}
          /* The same material as the single-line fields, with the height rung
             replaced by `rows` - a textarea that does not match the inputs
             above it is the tell that a form was assembled rather than designed. */
          className={["nf-field block resize-y px-md py-sm", FIELD_TYPE, textAreaClassName ?? ""]
            .filter(Boolean)
            .join(" ")}
          style={checked.error ? INVALID_STYLE : undefined}
          onChange={(event) => {
            setTypedLength(event.target.value.length);
            checked.onChangeValue(event.target.value);
            onChange?.(event);
          }}
          onBlur={(event) => {
            checked.onBlurValue(event.target.value);
            onBlur?.(event);
          }}
        />
      )}
    </Field>
  );
}

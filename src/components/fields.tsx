"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronIcon } from "./icons";

function parse(text: string): number {
  const t = text.trim().replace(",", ".");
  if (t === "") return NaN;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

function stringify(v: number): string {
  return Number.isFinite(v) ? String(v) : "";
}

type NumberFieldProps = {
  label: string;
  value: number;
  onChange: (v: number) => void;
  unit?: string;
  hint?: ReactNode;
  placeholder?: string;
  className?: string;
};

export function NumberField({ label, value, onChange, unit, hint, placeholder, className }: NumberFieldProps) {
  const id = useId();
  const [text, setText] = useState(() => stringify(value));
  const [prevValue, setPrevValue] = useState(value);

  // Value changed from outside (preset, reset, shared link): sync the text.
  if (!Object.is(value, prevValue)) {
    setPrevValue(value);
    if (!Object.is(parse(text), value)) setText(stringify(value));
  }

  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-ink-2 mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          className="field num"
          style={unit ? { paddingRight: `${Math.max(2.2, unit.length * 0.6 + 1.2)}rem` } : undefined}
          value={text}
          placeholder={placeholder}
          onChange={(e) => {
            setText(e.target.value);
            onChange(parse(e.target.value));
          }}
        />
        {unit ? <span className="field-unit">{unit}</span> : null}
      </div>
      {hint ? <p className="mt-1.5 text-xs text-ink-3 leading-snug">{hint}</p> : null}
    </div>
  );
}

type TextFieldProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  hint?: ReactNode;
  maxLength?: number;
  type?: "text" | "url";
};

export function TextField({ label, value, onChange, placeholder, className, hint, maxLength = 80, type = "text" }: TextFieldProps) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-ink-2 mb-1.5">
        {label}
      </label>
      <input
        id={id}
        type={type}
        inputMode={type === "url" ? "url" : undefined}
        className="field"
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint ? <p className="mt-1.5 text-xs text-ink-3 leading-snug">{hint}</p> : null}
    </div>
  );
}

type TextAreaFieldProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  autoFocus?: boolean;
};

export function TextAreaField({ label, value, onChange, placeholder, rows = 3, className, autoFocus }: TextAreaFieldProps) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-ink-2 mb-1.5">
        {label}
      </label>
      <textarea
        id={id}
        className="field resize-y"
        value={value}
        placeholder={placeholder}
        rows={rows}
        maxLength={2000}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

type SelectFieldProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  hint?: ReactNode;
  className?: string;
};

export function SelectField({ label, value, onChange, options, placeholder, hint, className }: SelectFieldProps) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-ink-2 mb-1.5">
        {label}
      </label>
      <select id={id} className="field" value={value} onChange={(e) => onChange(e.target.value)}>
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint ? <p className="mt-1.5 text-xs text-ink-3 leading-snug">{hint}</p> : null}
    </div>
  );
}

type SectionProps = {
  title: string;
  lead?: string;
  children: ReactNode;
  /** When given, the section folds; `summary` keeps the gist visible while closed. */
  open?: boolean;
  onToggle?: (open: boolean) => void;
  summary?: string;
};

export function Section({ title, lead, children, open, onToggle, summary }: SectionProps) {
  const body = (
    <>
      {lead ? <p className="mt-1 text-sm text-ink-2 max-w-prose">{lead}</p> : null}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">{children}</div>
    </>
  );
  if (open === undefined) {
    return (
      <section className="pt-7 first:pt-0">
        <h2 className="display text-xl font-semibold leading-tight">{title}</h2>
        {body}
      </section>
    );
  }
  return (
    <details
      className="group pt-7 first:pt-0"
      open={open}
      onToggle={(e) => onToggle?.((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="flex cursor-pointer list-none items-baseline gap-3 rounded-md -mx-2 px-2 py-1 hover:bg-ticket/70 [&::-webkit-details-marker]:hidden">
        <h2 className="display text-xl font-semibold leading-tight shrink-0">{title}</h2>
        {!open && summary ? <span className="min-w-0 truncate text-sm text-ink-2">{summary}</span> : null}
        <ChevronIcon className="ml-auto shrink-0 self-center text-ink-3 transition-transform group-open:rotate-180" />
      </summary>
      {body}
    </details>
  );
}

type CheckboxProps = {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: ReactNode;
  disabled?: boolean;
  className?: string;
};

export function Checkbox({ label, checked, onChange, hint, disabled, className }: CheckboxProps) {
  const id = useId();
  return (
    <div className={className}>
      <div className="flex items-start gap-2.5">
        <input
          id={id}
          type="checkbox"
          className="mt-[3px] h-4 w-4 shrink-0 accent-[var(--accent)] disabled:opacity-50"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <label htmlFor={id} className={`text-sm font-medium ${disabled ? "text-ink-3" : "text-ink"}`}>
          {label}
        </label>
      </div>
      {hint ? <p className="mt-1.5 ml-[26px] text-xs text-ink-3 leading-snug">{hint}</p> : null}
    </div>
  );
}

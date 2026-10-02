"use client";

import { Blobatar } from "@blobatar/react";
import {
  BankIcon,
  CalendarBlankIcon,
  EnvelopeSimpleIcon,
  FileTextIcon,
  NewspaperIcon,
  SlackLogoIcon,
  XIcon,
  type Icon,
} from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type { ItemKind } from "@/lib/types";
import { useHelm } from "./helm-context";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

const SYSTEM_ROLES = new Set(["System", "Newsletter", "Notifications", "Vendor", "Events", "Saved Articles", "Internal", "Corporate Client", "Davr Integration"]);

export function Avatar({ id, size = 28, className }: { id: string; size?: number; className?: string }) {
  const { person } = useHelm();
  const p = person(id);
  if (SYSTEM_ROLES.has(p.role) || id === "people" || id === "legal") {
    const Glyph: Icon = id === "reading" ? NewspaperIcon : id === "calendar" ? CalendarBlankIcon : BankIcon;
    return (
      <span
        aria-hidden="true"
        className={cx("inline-flex shrink-0 items-center justify-center rounded-full bg-surface-strong text-body", className)}
        style={{ width: size, height: size }}
      >
        <Glyph size={Math.round(size * 0.5)} weight="bold" />
      </span>
    );
  }
  return (
    <Blobatar
      name={`${p.name}-${p.id}`}
      size={size}
      background="circle"
      alt=""
      className={cx("shrink-0 rounded-full", className)}
      width={size}
      height={size}
    />
  );
}

export function AvatarStack({ ids, size = 22, max = 3 }: { ids: string[]; size?: number; max?: number }) {
  const shown = ids.slice(0, max);
  return (
    <span className="flex items-center -space-x-1.5">
      {shown.map((id) => (
        <Avatar key={id} id={id} size={size} className="ring-2 ring-card" />
      ))}
      {ids.length > max && <span className="pl-2.5 text-xs text-muted">+{ids.length - max}</span>}
    </span>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "sm" | "md" | "lg" }) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        "inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-medium transition-[background-color,border-color,color,transform] duration-150 ease-out-soft active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
        size === "sm" && "h-8 px-3 text-[13px]",
        size === "md" && "h-10 px-4 text-sm",
        size === "lg" && "h-11 px-5 text-[15px]",
        variant === "primary" && "bg-accent-ink text-on-accent hover:brightness-95",
        variant === "secondary" && "border border-hairline-strong bg-card text-ink hover:border-ink/40 hover:bg-canvas-soft",
        variant === "ghost" && "text-body hover:bg-surface-strong/60 hover:text-ink",
        variant === "danger" && "border border-danger/40 bg-danger-soft text-danger hover:border-danger",
        className,
      )}
    />
  );
}

type Tone = "neutral" | "accent" | "danger" | "success" | "warn";

export function Pill({ tone = "neutral", children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium leading-5",
        tone === "neutral" && "bg-surface-strong text-ink",
        tone === "accent" && "bg-accent-soft text-accent-ink",
        tone === "danger" && "bg-danger-soft text-danger",
        tone === "success" && "bg-success-soft text-success",
        tone === "warn" && "bg-warn-soft text-warn",
        className,
      )}
    >
      {children}
    </span>
  );
}

export const KIND_ICON: Record<ItemKind | "calendar", Icon> = {
  email: EnvelopeSimpleIcon,
  slack: SlackLogoIcon,
  doc: FileTextIcon,
  article: NewspaperIcon,
  calendar: CalendarBlankIcon,
};

export function SourceChip({ id }: { id: string }) {
  const { day, setUrl } = useHelm();
  const item = day.items.find((i) => i.id === id);
  const event = item ? null : day.events.find((e) => e.id === id);
  if (!item && !event) return null;
  const Glyph = KIND_ICON[item ? item.kind : "calendar"];
  const label = item ? item.ref : `Calendar ${event!.start}`;
  return (
    <button
      type="button"
      onClick={() => setUrl({ src: id })}
      className="inline-flex h-6 items-center gap-1 rounded-md border border-hairline bg-canvas-soft px-1.5 text-xs text-body transition-colors hover:border-hairline-strong hover:text-ink"
      aria-label={`Open source: ${label}`}
    >
      <Glyph size={12} weight="bold" aria-hidden="true" />
      <span className="tnum">{label}</span>
    </button>
  );
}

/** Checkpoint triggers are item ids; this turns them into "Sender: subject". */
export function useTriggerText() {
  const { day, person } = useHelm();
  return (trigger: string) => {
    const item = day.items.find((i) => i.id === trigger);
    if (!item) return trigger;
    return `${person(item.from).name}: ${item.subject ?? item.text.split("\n")[0]}`;
  };
}

export function SourceChips({ ids, className }: { ids: string[]; className?: string }) {
  const unique = [...new Set(ids)];
  if (!unique.length) return null;
  return (
    <div className={cx("flex flex-wrap gap-1", className)}>
      {unique.map((id) => (
        <SourceChip key={id} id={id} />
      ))}
    </div>
  );
}

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);

  const hydrated = useHydrated();
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [open]);

  if (!hydrated) return null;
  const root = document.getElementById(SHEET_ROOT_ID);
  if (!root) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="absolute inset-0 z-30 flex flex-col justify-end">
          <motion.div
            className="absolute inset-0 bg-ink/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className="relative flex max-h-[88%] flex-col rounded-t-2xl border-t border-hairline bg-card outline-none"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
          >
            <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-4">
              <h2 id={titleId} className="text-[17px] font-semibold leading-snug text-ink text-balance">
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="-mr-1 inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-body hover:bg-surface-strong hover:text-ink"
              >
                <XIcon size={18} weight="bold" aria-hidden="true" />
              </button>
            </div>
            <div className="scroll-area min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>
            {footer && <div className="border-t border-hairline px-5 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    root,
  );
}

export const SHEET_ROOT_ID = "helm-sheet-root";

/** Absolutely positioned layer that sheets portal into, so they stay inside the phone screen. */
export function SheetRoot() {
  return <div id={SHEET_ROOT_ID} className="pointer-events-none absolute inset-0 z-30 *:pointer-events-auto" />;
}

const noop = () => () => {};

export function useHydrated() {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: T;
  options: { id: T; label: React.ReactNode }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cx("grid gap-1 rounded-lg bg-surface-strong p-1", className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          className={cx(
            "inline-flex h-8 items-center justify-center gap-1.5 truncate rounded-md px-2 text-[13px] font-medium transition-colors",
            value === o.id ? "bg-card text-ink shadow-[0_0_0_1px_var(--hairline-strong)]" : "text-body hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SectionTitle({ children, count, action }: { children: React.ReactNode; count?: number; action?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-1 pb-2 pt-6">
      <h2 className="text-[13px] font-semibold text-muted">
        {children}
        {count !== undefined && <span className="tnum ml-1.5 font-normal">{count}</span>}
      </h2>
      {action}
    </div>
  );
}

export function EmptyState({ icon: Glyph, title, body }: { icon: Icon; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span className="mb-3 inline-flex size-11 items-center justify-center rounded-full bg-surface-strong text-body">
        <Glyph size={20} weight="bold" aria-hidden="true" />
      </span>
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      <p className="mt-1 max-w-[30ch] text-sm leading-relaxed text-body text-pretty">{body}</p>
    </div>
  );
}

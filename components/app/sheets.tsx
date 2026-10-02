"use client";

import { InfoIcon, PaperPlaneTiltIcon, ProhibitIcon, SealCheckIcon, SpeakerHighIcon } from "@phosphor-icons/react";
import { useCallback, useState } from "react";
import { toMin } from "@/lib/time";
import type { Provenance } from "@/lib/types";
import { useHelm } from "../helm-context";
import { Avatar, Button, KIND_ICON, Pill, Segmented, Sheet, useHydrated } from "../ui";

export function SourceSheet() {
  const { url, setUrl, day, view, person } = useHelm();
  const close = useCallback(() => setUrl({ src: null }), [setUrl]);
  const item = url.src ? day.items.find((i) => i.id === url.src) : undefined;
  const event = url.src && !item ? day.events.find((e) => e.id === url.src) : undefined;
  const open = Boolean(item || event);
  const future = item ? toMin(item.at) > toMin(view.now) || (url.path === "helm" && item.defaultPathOnly) : false;
  const triage = item && url.path === "helm" ? view.triage.get(item.id) : undefined;

  const title = item ? (item.subject ?? item.ref) : event ? event.title : "Source";

  return (
    <Sheet open={open} onClose={close} title={title}>
      {item && future && (
        <p className="rounded-lg bg-warn-soft p-3 text-sm text-warn">
          This arrives at {item.at}. At {view.now} nobody, including Helm, has seen it.
        </p>
      )}
      {item && !future && (
        <>
          <div className="flex items-center gap-3">
            <Avatar id={item.from} size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">{person(item.from).name}</p>
              <p className="truncate text-xs text-muted">
                {[person(item.from).role, person(item.from).org !== "External" ? person(item.from).org : null].filter(Boolean).join(", ")}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="tnum font-mono text-xs text-ink">{item.at}</p>
              <p className="flex items-center justify-end gap-1 text-xs text-muted">
                {(() => {
                  const Glyph = KIND_ICON[item.kind];
                  return <Glyph size={12} weight="bold" aria-hidden="true" />;
                })()}
                {item.channel ?? item.ref}
              </p>
            </div>
          </div>
          {triage && (
            <p className="mt-3 text-[13px] text-body">
              <Pill tone={triage.bucket === "you" ? "accent" : "neutral"} className="mr-1.5">
                {triage.bucket === "you" ? "For you" : triage.bucket === "fyi" ? "FYI" : triage.bucket === "noise" ? "Noise" : "Delegate"}
              </Pill>
              {triage.reason}
            </p>
          )}
          <div className="mt-4 whitespace-pre-line rounded-xl border border-hairline bg-canvas-soft p-4 text-sm leading-relaxed text-ink">
            {item.text}
          </div>
          <ProvenanceNote provenance={item.provenance} />
        </>
      )}
      {event && (
        <>
          <p className="tnum font-mono text-sm text-ink">
            {event.start} to {event.end}
            {event.location ? <span className="font-sans text-muted">, {event.location}</span> : null}
          </p>
          {event.attendees.length > 0 && (
            <ul className="mt-3 flex flex-col gap-2">
              {event.attendees.map((id) => (
                <li key={id} className="flex items-center gap-2.5">
                  <Avatar id={id} size={28} />
                  <span className="text-sm text-ink">{person(id).name}</span>
                  <span className="truncate text-xs text-muted">{person(id).role}</span>
                </li>
              ))}
            </ul>
          )}
          {event.notes && <p className="mt-4 rounded-xl border border-hairline bg-canvas-soft p-4 text-sm leading-relaxed text-ink">{event.notes}</p>}
          <ProvenanceNote provenance={event.provenance} />
        </>
      )}
    </Sheet>
  );
}

function ProvenanceNote({ provenance: p }: { provenance: Provenance }) {
  if (p.kind === "file") {
    return (
      <p className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-muted">
        <InfoIcon size={14} weight="bold" className="mt-px shrink-0" aria-hidden="true" />
        <span>
          Verbatim from <span className="font-mono">{p.file}</span>
          {p.note ? `. ${p.note}` : ""}
        </span>
      </p>
    );
  }
  if (p.kind === "imported") {
    return (
      <p className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-muted">
        <InfoIcon size={14} weight="bold" className="mt-px shrink-0" aria-hidden="true" />
        <span>
          Imported from <span className="font-mono">{p.file}</span>
        </span>
      </p>
    );
  }
  return (
    <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-warn-soft p-3 text-xs leading-relaxed text-warn">
      <InfoIcon size={14} weight="bold" className="mt-px shrink-0" aria-hidden="true" />
      <span className="text-pretty">
        Reconstructed. <span className="font-mono">{p.missing}</span> was not provided, so this entry is rebuilt from{" "}
        {p.groundedIn.join(", ")}.{p.note ? ` ${p.note}` : ""}
      </span>
    </p>
  );
}

type Lang = "en" | "uz" | "ru";
const LANGS: { id: Lang; label: string; speech: string }[] = [
  { id: "en", label: "English", speech: "en-US" },
  { id: "uz", label: "O'zbekcha", speech: "uz-UZ" },
  { id: "ru", label: "Русский", speech: "ru-RU" },
];

export function CallKitSheet() {
  const { url, setUrl, view, person, sendKit, user } = useHelm();
  const [lang, setLang] = useState<Lang>("uz");
  const close = useCallback(() => setUrl({ kit: false }), [setUrl]);
  const kit = url.path === "helm" ? view.callKit : null;
  const hydrated = useHydrated();
  const canSpeak = hydrated && "speechSynthesis" in window;
  const event = kit ? view.events.find((e) => e.id === kit.eventId) : undefined;
  const sentAt = user.kitSentAt && toMin(user.kitSentAt) <= toMin(view.now) ? user.kitSentAt : null;

  const speak = (text: string) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = LANGS.find((l) => l.id === lang)!.speech;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  };

  return (
    <Sheet
      open={Boolean(url.kit && kit)}
      onClose={close}
      title={event ? `${event.title.split(":")[0]} call kit, ${event.start}` : "Call kit"}
      footer={
        kit &&
        (sentAt ? (
          <p className="flex items-center justify-center gap-1.5 py-2 text-sm font-medium text-success">
            <SealCheckIcon size={18} weight="fill" aria-hidden="true" />
            Pre-read sent at <span className="tnum font-mono">{sentAt}</span>
          </p>
        ) : (
          <Button variant="primary" size="lg" className="w-full" onClick={sendKit}>
            <PaperPlaneTiltIcon size={16} weight="bold" aria-hidden="true" />
            Send Pre-read to {person("bekzod").name.split(" ")[0]} and {person("dilnoza").name.split(" ")[0]}
          </Button>
        ))
      }
    >
      {kit && (
        <>
          <p className="text-sm leading-relaxed text-body text-pretty">{kit.purpose}</p>

          <Segmented
            label="Language"
            value={lang}
            onChange={setLang}
            className="mt-4"
            options={LANGS.map((l) => ({ id: l.id, label: <span lang={l.id}>{l.label}</span> }))}
          />

          <p className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-warn">
            <InfoIcon size={14} weight="bold" className="mt-px shrink-0" aria-hidden="true" />
            Machine translation. Ask Dilnoza to confirm the legal terms in writing after the call.
          </p>

          <h3 className="mt-5 flex items-center justify-between text-[13px] font-semibold text-muted">
            Opening
            {canSpeak && (
              <button
                type="button"
                onClick={() => speak(kit.opening[lang])}
                className="inline-flex items-center gap-1 text-xs font-medium text-accent-ink hover:underline"
              >
                <SpeakerHighIcon size={14} weight="bold" aria-hidden="true" />
                Listen
              </button>
            )}
          </h3>
          <p lang={lang} className="mt-1.5 text-[15px] leading-relaxed text-ink text-pretty">
            {kit.opening[lang]}
          </p>
          {lang !== "en" && <p className="mt-1.5 text-[13px] leading-relaxed text-muted text-pretty">{kit.opening.en}</p>}

          <h3 className="mt-5 text-[13px] font-semibold text-muted">Agenda</h3>
          <ol className="mt-1.5 flex flex-col gap-2">
            {kit.agenda.map((a, i) => (
              <li key={a.en} className="flex gap-2.5">
                <span className="tnum mt-0.5 w-4 shrink-0 font-mono text-xs text-muted">{i + 1}</span>
                <span className="min-w-0">
                  <span lang={lang} className="block text-sm leading-relaxed text-ink text-pretty">
                    {a[lang]}
                  </span>
                  {lang !== "en" && <span className="block text-xs leading-relaxed text-muted">{a.en}</span>}
                </span>
              </li>
            ))}
          </ol>

          <h3 className="mt-5 text-[13px] font-semibold text-muted">Glossary</h3>
          <dl className="mt-1.5 divide-y divide-hairline overflow-hidden rounded-xl border border-hairline">
            {kit.glossary.map((g) => (
              <div key={g.term} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-3 px-3 py-2.5">
                <dt className="text-[13px] font-medium text-ink">{g.term}</dt>
                <dd lang={lang} className="text-[13px] text-body">
                  {g[lang]}
                </dd>
              </div>
            ))}
          </dl>

          <h3 className="mt-5 text-[13px] font-semibold text-muted">Do not commit to</h3>
          <ul className="mt-1.5 flex flex-col gap-1.5">
            {kit.doNotCommit.map((t) => (
              <li key={t} className="flex items-start gap-2 text-sm leading-relaxed text-ink">
                <ProhibitIcon size={16} weight="bold" className="mt-0.5 shrink-0 text-danger" aria-hidden="true" />
                <span className="text-pretty">{t}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Sheet>
  );
}

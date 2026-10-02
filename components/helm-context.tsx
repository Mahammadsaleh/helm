"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { CheckpointOutput, Decision, Delegation } from "@/lib/ai/schema";
import type { GuardIssue } from "@/lib/engine/guard";
import { acceptEarlier, computeView, type Path, type View } from "@/lib/engine/view";
import { compact, fromCompact, toMin } from "@/lib/time";
import { EMPTY_USER_STATE, type Checkpoint, type Day, type HHMM, type Person, type UserState } from "@/lib/types";

export type Tab = "today" | "decide" | "onepager" | "feed";
export type Persona = "ceo" | "maya";
export type FeedFilter = "all" | "you" | "delegate" | "fyi" | "noise";

export interface UrlState {
  t: HHMM;
  tab: Tab;
  path: Path;
  as: Persona;
  feed: FeedFilter;
  src: string | null;
  kit: boolean;
}

interface LiveOverride {
  output: CheckpointOutput;
  model: string;
  generatedAt: string;
  guard: GuardIssue[];
}

interface HelmContextValue {
  day: Day;
  checkpoints: Checkpoint[];
  view: View;
  user: UserState;
  url: UrlState;
  setUrl: (patch: Partial<UrlState>) => void;
  setTime: (t: HHMM) => void;
  person: (id: string) => Person;
  decide: (d: Decision, optionId: string) => void;
  undoDecision: (id: string) => void;
  setChange: (ids: string | string[], state: "accepted" | "dismissed" | null) => void;
  sendDelegation: (d: Delegation) => void;
  sendOnePager: () => void;
  markOnePagerSeen: () => void;
  sendKit: () => void;
  reset: () => void;
  toasts: { id: number; text: string }[];
  toast: (text: string) => void;
  live: {
    model: string | null;
    running: boolean;
    error: string | null;
    overrides: Record<string, LiveOverride>;
    run: () => Promise<void>;
  };
}

const HelmContext = createContext<HelmContextValue | null>(null);

const STORAGE_KEY = "helm-demo-v1";
const TABS: Tab[] = ["today", "decide", "onepager", "feed"];
const FILTERS: FeedFilter[] = ["all", "you", "delegate", "fyi", "noise"];

function parseUrl(params: URLSearchParams): UrlState {
  const tab = params.get("tab") as Tab;
  const feed = params.get("feed") as FeedFilter;
  return {
    t: fromCompact(params.get("t")) ?? "08:30",
    tab: TABS.includes(tab) ? tab : "today",
    path: params.get("path") === "default" ? "default" : "helm",
    as: params.get("as") === "maya" ? "maya" : "ceo",
    feed: FILTERS.includes(feed) ? feed : "all",
    src: params.get("src"),
    kit: params.get("kit") === "1",
  };
}

function writeUrl(s: UrlState) {
  const p = new URLSearchParams();
  p.set("t", compact(s.t));
  if (s.tab !== "today") p.set("tab", s.tab);
  if (s.path !== "helm") p.set("path", s.path);
  if (s.as !== "ceo") p.set("as", s.as);
  if (s.feed !== "all") p.set("feed", s.feed);
  if (s.src) p.set("src", s.src);
  if (s.kit) p.set("kit", "1");
  window.history.replaceState(null, "", `?${p.toString()}`);
}

export function HelmProvider({
  day,
  checkpoints: baseCheckpoints,
  liveModel,
  children,
}: {
  day: Day;
  checkpoints: Checkpoint[];
  liveModel: string | null;
  children: React.ReactNode;
}) {
  const params = useSearchParams();
  const [url, setUrlState] = useState<UrlState>(() => parseUrl(new URLSearchParams(params.toString())));
  const [overrides, setOverrides] = useState<Record<string, LiveOverride>>({});
  const checkpoints = useMemo(
    () =>
      baseCheckpoints.map((c) =>
        overrides[c.id]
          ? { ...c, output: overrides[c.id].output, generatedBy: "model" as const, model: overrides[c.id].model, generatedAt: overrides[c.id].generatedAt }
          : c,
      ),
    [baseCheckpoints, overrides],
  );
  const [user, setUser] = useState<UserState>(() => acceptEarlier(EMPTY_USER_STATE, baseCheckpoints, url.t));
  const loaded = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate persisted demo state after mount
      if (raw) setUser({ ...EMPTY_USER_STATE, ...JSON.parse(raw) });
    } catch {
      /* corrupted storage: keep the default state */
    }
    loaded.current = true;
  }, []);

  useEffect(() => {
    if (loaded.current) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  }, [user]);

  useEffect(() => {
    const id = setTimeout(() => writeUrl(url), 120);
    return () => clearTimeout(id);
  }, [url]);

  const setUrl = useCallback((patch: Partial<UrlState>) => {
    setUrlState((prev) => ({ ...prev, ...patch }));
  }, []);

  const currentTime = useRef(url.t);
  useEffect(() => {
    currentTime.current = url.t;
  }, [url.t]);

  const setTime = useCallback(
    (t: HHMM) => {
      if (toMin(t) > toMin(currentTime.current)) setUser((u) => acceptEarlier(u, checkpoints, t));
      currentTime.current = t;
      setUrlState((prev) => ({ ...prev, t }));
    },
    [checkpoints],
  );

  const view = useMemo(() => computeView(day, checkpoints, url.t, user, url.path), [day, checkpoints, url.t, user, url.path]);

  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);
  const toast = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setToasts((list) => [...list.slice(-2), { id, text }]);
    setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), 3600);
  }, []);

  const person = useCallback(
    (id: string): Person => day.people[id] ?? { id, name: id, role: "", org: "External" },
    [day.people],
  );

  const decide = useCallback(
    (d: Decision, optionId: string) => {
      const opt = d.options.find((o) => o.id === optionId) ?? d.options[0];
      setUser((u) => ({ ...u, decisions: { ...u.decisions, [d.id]: { optionId: opt.id, optionLabel: opt.label, title: d.title, at: url.t } } }));
      toast(`Decided: ${opt.label}`);
    },
    [url.t, toast],
  );

  const undoDecision = useCallback((id: string) => {
    setUser((u) => {
      const decisions = { ...u.decisions };
      delete decisions[id];
      return { ...u, decisions };
    });
  }, []);

  const setChange = useCallback(
    (ids: string | string[], state: "accepted" | "dismissed" | null) => {
      const list = typeof ids === "string" ? [ids] : ids;
      setUser((u) => {
        const planChanges = { ...u.planChanges };
        for (const id of list) {
          if (state) planChanges[id] = state;
          else delete planChanges[id];
        }
        return { ...u, planChanges };
      });
      if (state === "accepted") toast(list.length > 1 ? `Calendar updated: ${list.length} changes` : "Calendar updated");
    },
    [toast],
  );

  const sendDelegation = useCallback(
    (d: Delegation) => {
      setUser((u) => ({
        ...u,
        delegations: { ...u.delegations, [d.id]: { at: url.t, to: d.to, summary: d.subject ?? d.body.slice(0, 80) } },
      }));
      toast(`Sent to ${person(d.to).name} (simulated)`);
    },
    [url.t, toast, person],
  );

  const sendOnePager = useCallback(() => {
    setUser((u) => ({ ...u, onePagerSentAt: url.t }));
    toast("One-pager sent to Richard (simulated)");
  }, [url.t, toast]);

  const markOnePagerSeen = useCallback(() => {
    const id = view.checkpoint?.id;
    if (id) setUser((u) => (u.onePagerSeenCheckpoint === id ? u : { ...u, onePagerSeenCheckpoint: id }));
  }, [view.checkpoint?.id]);

  const sendKit = useCallback(() => {
    setUser((u) => ({ ...u, kitSentAt: url.t }));
    toast("Pre-read sent to Bekzod and Dilnoza (simulated)");
  }, [url.t, toast]);

  const reset = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setOverrides({});
    setUser(acceptEarlier(EMPTY_USER_STATE, baseCheckpoints, "08:30"));
    setUrl({ t: "08:30", tab: "today", path: "helm", as: "ceo", feed: "all", src: null, kit: false });
  }, [baseCheckpoints, setUrl]);

  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async () => {
    const cp = view.checkpoint;
    if (!cp) return;
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ checkpointId: cp.id, user }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      setOverrides((o) => ({ ...o, [cp.id]: data }));
      toast(`Re-analysed ${cp.at} with ${data.model}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }, [view.checkpoint, user, toast]);

  const value: HelmContextValue = {
    day,
    checkpoints,
    view,
    user,
    url,
    setUrl,
    setTime,
    person,
    decide,
    undoDecision,
    setChange,
    sendDelegation,
    sendOnePager,
    markOnePagerSeen,
    sendKit,
    reset,
    toasts,
    toast,
    live: { model: liveModel, running, error, overrides, run },
  };

  return <HelmContext.Provider value={value}>{children}</HelmContext.Provider>;
}

export function useHelm(): HelmContextValue {
  const ctx = useContext(HelmContext);
  if (!ctx) throw new Error("useHelm must be used inside HelmProvider");
  return ctx;
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DecisionBadge } from "@/components/DecisionBadge";
import type { ResearchRun } from "@/domain/opportunity";

const EXAMPLE = "I have $2,000. I live in the USA. I have no e-commerce experience. Find me five product opportunities.";

export default function ChatPage() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [run, setRun] = useState<ResearchRun | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      setRun(data.run as ResearchRun);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <div className="mb-6 font-mono text-xs uppercase tracking-widest text-[var(--text-faint)]">
        AI Chat
      </div>
      <h1 className="mb-2 font-display text-2xl font-semibold tracking-tight">
        Master Agent
      </h1>
      <p className="mb-6 text-sm text-[var(--text-muted)]">
        Tell it your capital, market, and experience level. It will orchestrate the specialist
        agents, cross-check their findings, and hand back opportunities with a decision and the
        evidence behind it.
      </p>

      <form onSubmit={handleSubmit} className="mb-8">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={EXAMPLE}
          rows={3}
          className="w-full resize-none rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:border-[var(--border-strong)] focus:outline-none"
        />
        <div className="mt-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setMessage(EXAMPLE)}
            className="text-xs text-[var(--text-faint)] hover:text-[var(--text-muted)]"
          >
            Use example request
          </button>
          <button
            type="submit"
            disabled={loading || !message.trim()}
            className="rounded-md px-4 py-2 font-display text-sm font-semibold disabled:opacity-40"
            style={{ backgroundColor: "var(--accent-amber)", color: "#14100a" }}
          >
            {loading ? "Researching…" : "Run research"}
          </button>
        </div>
      </form>

      {error && (
        <div className="mb-6 rounded-md border border-[var(--accent-red-dim)] bg-[var(--accent-red-dim)] px-4 py-3 text-sm" style={{ color: "var(--accent-red)" }}>
          {error}
        </div>
      )}

      {loading && (
        <div className="space-y-2">
          {["Building research plan…", "Running specialist agents…", "Checking for contradictions…", "Scoring and deciding…"].map(
            (label) => (
              <div key={label} className="h-9 animate-pulse rounded-md bg-[var(--bg-surface)]" />
            )
          )}
        </div>
      )}

      {run && !loading && (
        <div className="space-y-6">
          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 text-sm leading-relaxed text-[var(--text-muted)]">
            {run.narrative}
          </div>

          <div className="space-y-2">
            {run.opportunities.map((o) => (
              <button
                key={o.id}
                onClick={() => router.push(`/opportunities/${o.id}`)}
                className="flex w-full items-center justify-between rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3 text-left transition-colors hover:border-[var(--border-strong)]"
              >
                <div>
                  <div className="text-sm font-medium">{o.candidate.name}</div>
                  <div className="mt-0.5 text-xs text-[var(--text-faint)] line-clamp-1 max-w-md">
                    {o.decisionNarrative}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-4 pl-4">
                  <span className="font-mono text-sm text-[var(--text-muted)]">{o.score.total}/100</span>
                  <DecisionBadge decision={o.decision} size="sm" />
                </div>
              </button>
            ))}
          </div>

          <Link href="/research" className="inline-block text-xs text-[var(--accent-amber)] hover:underline">
            View full Product Research table →
          </Link>
        </div>
      )}
    </div>
  );
}

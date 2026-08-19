"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Command Center" },
  { href: "/chat", label: "AI Chat" },
  { href: "/research", label: "Product Research" },
  { href: "/evidence", label: "Evidence Center" },
  { href: "/kill-list", label: "Kill List" },
  { href: "/settings", label: "Settings" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-6">
      <div className="mb-8 flex items-center gap-2 px-1">
        <div
          className="flex h-7 w-7 items-center justify-center rounded-md font-display text-sm font-bold"
          style={{ backgroundColor: "var(--accent-amber-dim)", color: "var(--accent-amber)" }}
        >
          A
        </div>
        <span className="font-display text-base font-semibold tracking-tight">Avocore</span>
      </div>

      <nav className="flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                "rounded-md px-3 py-2 text-sm transition-colors " +
                (active
                  ? "bg-[var(--bg-surface-raised)] text-[var(--text-primary)] font-medium"
                  : "text-[var(--text-muted)] hover:bg-[var(--bg-surface-raised)] hover:text-[var(--text-primary)]")
              }
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto rounded-md border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2.5">
        <div className="text-[10px] uppercase tracking-wider text-[var(--text-faint)]">Phase</div>
        <div className="font-mono text-xs text-[var(--text-muted)]">1 — Mock data foundation</div>
      </div>
    </aside>
  );
}

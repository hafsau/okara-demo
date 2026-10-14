"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Arrow, OkaraMark } from "./brand";
import { btn } from "./styles";

const NAV = [
  { href: "/", label: "First 60 seconds" },
  { href: "/teardown", label: "The teardown" },
];

export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-full focus:bg-text focus:px-4 focus:py-2 focus:text-bg">
        Skip to content
      </a>
      <div className="border-b border-line-soft bg-popover px-4 py-2 text-center text-[13px] leading-5 text-muted">
        Unofficial concept by{" "}
        <a className="link" href="https://hafsausmani.com">
          Hafsa Usmani
        </a>{" "}
        for Okara&apos;s Product Designer role. Not affiliated with Okara.
      </div>
      <header className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3 sm:px-6">
        <Link href="/" className="flex flex-none items-center gap-2" aria-label="First 60 seconds, home">
          <OkaraMark className="h-7 w-auto text-text" />
          <span className="display text-xl tracking-tight">Okara</span>
          <span className="rounded border border-line px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted">concept</span>
        </Link>
        <nav aria-label="Main" className="hidden flex-1 items-center gap-6 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active(n.href) ? "page" : undefined}
              className={`text-[15px] font-semibold transition-colors ${active(n.href) ? "text-text" : "text-muted hover:text-text"}`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto hidden sm:block">
          {path.startsWith("/teardown") ? (
            <Link href="/?example" className={btn("primary")}>
              Try the first 60 seconds <Arrow />
            </Link>
          ) : (
            <Link href="/teardown" className={btn("primary")}>
              Read the teardown <Arrow />
            </Link>
          )}
        </div>
      </header>
      <nav aria-label="Main, mobile" className="flex gap-2 overflow-x-auto px-4 pb-2 md:hidden">
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active(n.href) ? "page" : undefined}
            className={`flex-none rounded-full border px-3 py-1.5 text-[13px] font-medium ${active(n.href) ? "border-text bg-text text-bg" : "border-line text-muted"}`}
          >
            {n.label}
          </Link>
        ))}
      </nav>
      <main id="main">{children}</main>
      <footer className="mx-auto mt-24 max-w-6xl border-t border-line-soft px-4 py-8 text-[13px] leading-6 text-muted sm:px-6">
        <p>
          A concept, not Okara&apos;s product. Site checks are real and run on the page you enter. Strategy docs, feed items and the example site are illustrative.
          Brand tokens and the pixel mark are taken from okara.ai to show the work in context.{" "}
          <Link href="/notes" className="link">
            What&apos;s real and what isn&apos;t
          </Link>
          .
        </p>
      </footer>
    </>
  );
}

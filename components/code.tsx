"use client";

import { useState } from "react";
import { btn } from "./styles";

export function CopyButton({ text, label = "Copy", kind = "outline" }: { text: string; label?: string; kind?: "primary" | "outline" }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={btn(kind, "sm")}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        } catch {}
      }}
    >
      <span aria-live="polite">{done ? "Copied" : label}</span>
    </button>
  );
}

/** Mono code panel. Diff lines are tinted; the copied text drops the diff markers and notes. */
export function CodeBlock({ code, lang, label }: { code: string; lang: "html" | "text" | "diff"; label: string }) {
  const lines = code.replace(/\n$/, "").split("\n");
  return (
    <figure className="overflow-hidden rounded-xl border border-line bg-bg">
      <figcaption className="flex items-center justify-between gap-3 border-b border-line px-4 py-2 text-[13px] text-muted">
        <span className="font-mono">{label}</span>
      </figcaption>
      <pre className="max-h-80 overflow-auto px-4 py-3 font-mono text-[13px] leading-6" tabIndex={0} aria-label={`${label} code`}>
        <code>
          {lines.map((l, i) => {
            const tone = lang === "diff" ? (l.startsWith("+") ? "text-aqua" : l.startsWith("-") ? "text-red" : "text-muted") : "text-text";
            return (
              <span key={i} className={`block whitespace-pre ${tone}`}>
                {l || " "}
              </span>
            );
          })}
        </code>
      </pre>
    </figure>
  );
}

/** The text someone would actually paste: for a diff, the resulting lines only. */
export function pasteable(code: string, lang: "html" | "text" | "diff") {
  if (lang !== "diff") return code;
  return code
    .split("\n")
    .filter((l) => !l.startsWith("-"))
    .map((l) => l.replace(/^[+ ] /, "").replace(/\s+\(line \d+\)$/, ""))
    .join("\n");
}

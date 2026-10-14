/* Server-safe class helpers, matching okara.ai's buttons and pills. */

export type BtnKind = "primary" | "outline" | "ghost";

export function btn(kind: BtnKind = "primary", size: "md" | "sm" = "md") {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-full font-medium transition-all duration-200 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap";
  const sizes = { md: "h-10 px-5 text-sm", sm: "h-8 px-3.5 text-[13px]" };
  const kinds = {
    primary: "bg-text text-bg hover:bg-text/90",
    outline: "border border-line-input bg-bg text-text hover:border-muted",
    ghost: "text-muted hover:text-text",
  };
  return `${base} ${sizes[size]} ${kinds[kind]}`;
}

/** Pill tab, as in okara.ai's strategy-document switcher. */
export function pill(active: boolean) {
  return `inline-flex h-9 items-center rounded-full border px-4 text-[13px] font-medium ${
    active ? "border-text bg-text text-bg" : "border-line bg-transparent text-text hover:border-muted"
  }`;
}

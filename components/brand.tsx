/** Okara's pixel mark, as served on okara.ai, with the eye blink moved to CSS. */
export function OkaraMark({ className = "h-7 w-auto" }: { className?: string }) {
  return (
    <svg viewBox="0 0 85 105" fill="none" aria-hidden="true" className={className}>
      <path
        fill="currentColor"
        d="M28.0518 104.559H18.7012V87.5576H28.0518V104.559ZM74.8066 87.5586H65.4551V70.5566H56.1055V87.5576H65.4551V104.559H56.1045V87.5586H46.7539V70.5566H37.4033V87.5576H46.7539V104.559H37.4023V87.5586H28.0518V70.5566H18.7012V87.5586H9.35059V61.2061H74.8066V87.5586ZM9.35059 61.2051H0V18.7021H9.35059V61.2051ZM84.1572 61.2051H74.8057V18.7021H84.1572V61.2051ZM18.6982 18.6982H9.35059V9.35059H18.6982V18.6982ZM74.8027 18.6982H65.4551V9.35059H74.8027V18.6982ZM65.4551 9.35059H18.7012V0H65.4551V9.35059Z"
      />
      <rect className="blink" x="19.9766" y="27.2021" width="9.3505" height="18.7022" fill="currentColor" />
      <rect className="blink" x="54.8291" y="27.2021" width="9.3506" height="18.7022" fill="currentColor" />
    </svg>
  );
}

export function Arrow({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
    </svg>
  );
}

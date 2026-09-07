/** Zegar do przycisku "wpisz moment wziecia". Inline SVG - zewnetrzne ikony
 *  i tak zablokowaloby produkcyjne CSP (default-src 'self'). */
export function ClockIcon(): React.JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 7v5l3 2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

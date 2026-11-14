"use client";

declare global {
  interface Window { egoCookieSettings?: () => void }
}

// Opens the shared consent panel from consent.js.
export function CookieSettingsLink() {
  return (
    <button type="button" onClick={() => window.egoCookieSettings?.()} className="text-sm text-dim transition-colors hover:text-bone">
      Cookie settings
    </button>
  );
}

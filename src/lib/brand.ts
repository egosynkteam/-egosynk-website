// Brand colours for the few places that need a value in code rather than a CSS class: the
// browser theme colour, the Razorpay window and the 3D tub's rim light. They must equal the
// tokens in src/app/globals.css; tests/brand.test.js fails the build if they drift.
export const BRAND = {
  ink: "#0d0e10",
  rust: "#c41e3a",
  rustBright: "#e63950",
} as const;

"use client";

import { MotionConfig } from "motion/react";

// Every animation on the site follows the visitor's "reduce motion" setting.
export function MotionRoot({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

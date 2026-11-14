"use client";

import { motion, type HTMLMotionProps } from "motion/react";

// Content rises into place as it scrolls into view. With reduced motion turned on, Motion
// drops the movement and only fades.
export function Reveal({ delay = 0, y = 28, className, children, ...rest }: HTMLMotionProps<"div"> & { delay?: number; y?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

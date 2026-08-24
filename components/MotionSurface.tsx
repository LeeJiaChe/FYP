"use client";

import { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

export default function MotionSurface({ motionKey, children, disabled = false }: { motionKey: string; children: ReactNode; disabled?: boolean }) {
  const reduceMotion = useReducedMotion();
  if (disabled) return <div>{children}</div>;
  return <motion.div key={motionKey} initial={reduceMotion ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={reduceMotion ? { duration: 0 } : { duration: .2, ease: [.22, .8, .3, 1] }}>{children}</motion.div>;
}

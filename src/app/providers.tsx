"use client";

import { domMax, LazyMotion, MotionConfig } from "motion/react";

import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domMax} strict>
      <MotionConfig reducedMotion="user">
        <TooltipProvider delayDuration={500}>
          {children}
          <Toaster />
        </TooltipProvider>
      </MotionConfig>
    </LazyMotion>
  );
}

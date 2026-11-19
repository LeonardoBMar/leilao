"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import { LayoutGroup, m } from "motion/react";
import { createContext, use, useId, useState } from "react";

import { MOTION_SPRING } from "@/lib/motion";
import { cn } from "@/lib/utils";

import { tabListClass, tabTriggerClass } from "./tab-styles";

const TabsContext = createContext<string | undefined>(undefined);

function Tabs({ className, value, defaultValue, onValueChange, ...props }: TabsPrimitive.TabsProps) {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const activeValue = value !== undefined ? value : uncontrolledValue;

  return (
    <TabsContext value={activeValue}>
      <TabsPrimitive.Root
        className={cn("w-full min-w-0", className)}
        value={value}
        defaultValue={defaultValue}
        onValueChange={(next) => {
          if (value === undefined) setUncontrolledValue(next);
          onValueChange?.(next);
        }}
        {...props}
      />
    </TabsContext>
  );
}

function TabsList({ className, ...props }: TabsPrimitive.TabsListProps) {
  const groupId = useId();
  return (
    <LayoutGroup id={groupId}>
      <TabsPrimitive.List className={cn(tabListClass, className)} {...props} />
    </LayoutGroup>
  );
}

function TabsTrigger({ className, value, children, ...props }: TabsPrimitive.TabsTriggerProps) {
  const activeValue = use(TabsContext);
  const isActive = activeValue === value;

  return (
    <TabsPrimitive.Trigger
      value={value}
      className={cn(
        tabTriggerClass,
        "disabled:cursor-not-allowed disabled:text-muted-subtle data-[state=active]:font-semibold data-[state=active]:text-foreground",
        className,
      )}
      {...props}
    >
      {children}
      {isActive ? (
        <m.span
          aria-hidden="true"
          layoutId="tabs-indicator"
          transition={MOTION_SPRING}
          className="pointer-events-none absolute inset-x-0 -bottom-0.5 h-0.5 bg-foreground"
        />
      ) : null}
    </TabsPrimitive.Trigger>
  );
}

function TabsContent({ className, ...props }: TabsPrimitive.TabsContentProps) {
  return (
    <TabsPrimitive.Content
      className={cn("mt-6 min-w-0 outline-none focus-visible:ring-2 focus-visible:ring-accent", className)}
      {...props}
    />
  );
}

export { Tabs, TabsContent, TabsList, TabsTrigger };

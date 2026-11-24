"use client";

import { ChevronsUpDown, LoaderCircle, LogOut, SlidersHorizontal, UserRound } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore, useTransition } from "react";

import { getSidebarServerSnapshot, getSidebarSnapshot, subscribeSidebar } from "@/components/layout/sidebar-store";
import {
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui";
import { cn } from "@/lib/utils";

import { logoutAction } from "../actions";

type UserMenuDropdownProps = {
  email: string | null;
  devBypass: boolean;
  variant?: "header" | "sidebar";
};

/** Avatar e menu da conta (compacto no header mobile ou dock ancorado no rodapé da sidebar desktop). */
export function UserMenuDropdown({ email, devBypass, variant = "header" }: UserMenuDropdownProps) {
  const [isPending, startTransition] = useTransition();
  const collapsed = useSyncExternalStore(subscribeSidebar, getSidebarSnapshot, getSidebarServerSnapshot);
  const initial = email?.trim().charAt(0).toUpperCase() || null;
  const isSidebar = variant === "sidebar";

  const avatar = (
    <span className="relative inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface text-caption font-semibold text-foreground-secondary shadow-xs">
      {initial ?? <UserRound aria-hidden="true" className="size-3.5" />}
      {devBypass ? (
        <span
          aria-hidden="true"
          className="absolute -right-0.5 -bottom-0.5 size-2 rounded-full bg-warning ring-2 ring-background"
        />
      ) : null}
    </span>
  );

  const sidebarTrigger = (
    <button
      type="button"
      aria-label="Menu da conta"
      className={cn(
        "group flex h-10 w-full items-center rounded-md text-left transition-[background-color,color,transform] duration-150 ease-[var(--ease-out)] outline-none hover:bg-primary-subtle/70 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-2 focus-visible:outline-transparent active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100",
        collapsed ? "justify-center px-0" : "gap-2.5 px-2",
      )}
    >
      {avatar}
      {!collapsed ? (
        <>
          <span className="grid min-w-0 flex-1">
            <span className="truncate text-label font-medium text-foreground" title={email ?? undefined}>
              {email ?? "Sua conta"}
            </span>
            {devBypass ? <span className="truncate text-caption text-warning">Modo dev</span> : null}
          </span>
          <ChevronsUpDown
            aria-hidden="true"
            strokeWidth={1.75}
            className="size-3.5 shrink-0 text-muted-subtle transition-colors group-hover:text-foreground"
          />
        </>
      ) : null}
    </button>
  );

  return (
    <DropdownMenu>
      {isSidebar ? (
        collapsed ? (
          <Tooltip delayDuration={180}>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>{sidebarTrigger}</DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={10}>
              {email ?? "Sua conta"}
            </TooltipContent>
          </Tooltip>
        ) : (
          <DropdownMenuTrigger asChild>{sidebarTrigger}</DropdownMenuTrigger>
        )
      ) : (
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Menu da conta"
            className="relative inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-border-strong bg-primary-subtle text-caption font-semibold text-foreground-secondary transition-[background-color,border-color,color,transform] duration-150 ease-[var(--ease-out)] outline-none hover:border-control-border hover:bg-primary-subtle-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:outline-2 focus-visible:outline-transparent active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 sm:size-8 pointer-coarse:size-10"
          >
            {initial ?? <UserRound aria-hidden="true" className="size-4" />}
            {devBypass ? (
              <span
                aria-hidden="true"
                className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full bg-warning ring-2 ring-surface"
              />
            ) : null}
          </button>
        </DropdownMenuTrigger>
      )}

      <DropdownMenuContent
        side={isSidebar ? "top" : "bottom"}
        align={isSidebar ? "start" : "end"}
        sideOffset={8}
        className="w-60"
      >
        <DropdownMenuLabel className="grid gap-1.5 font-normal">
          <span className="truncate text-label font-medium text-foreground" title={email ?? undefined}>
            {email ?? "Sua conta"}
          </span>
          {devBypass ? (
            <Badge variant="warning" className="justify-self-start">
              Modo dev: login desligado
            </Badge>
          ) : null}
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href="/sistema/preferencias">
            <SlidersHorizontal aria-hidden="true" className="text-muted" />
            Preferências
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          aria-busy={isPending || undefined}
          onSelect={(event) => {
            event.preventDefault();
            if (isPending) return;
            startTransition(async () => {
              await logoutAction();
            });
          }}
        >
          {isPending ? (
            <LoaderCircle aria-hidden="true" className="animate-spin text-muted motion-reduce:animate-none" />
          ) : (
            <LogOut aria-hidden="true" className="text-muted" />
          )}
          {isPending ? "Saindo…" : "Sair"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

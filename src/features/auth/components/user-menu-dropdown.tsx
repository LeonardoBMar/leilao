"use client";

import { ChevronsUpDown, CircleHelp, LoaderCircle, LogOut, SlidersHorizontal, UserRound } from "lucide-react";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import Link from "next/link";
import { useSyncExternalStore, useTransition } from "react";

import { setGuideDialogOpen } from "@/components/layout/guide-dialog-store";
import { getSidebarServerSnapshot, getSidebarSnapshot, subscribeSidebar } from "@/components/layout/sidebar-store";
import {
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  toast,
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

function subscribeNoop() {
  return () => {};
}

/** Avatar e menu da conta (compacto no header mobile ou dock ancorado no rodapé da sidebar desktop). */
export function UserMenuDropdown({ email, devBypass, variant = "header" }: UserMenuDropdownProps) {
  const [isPending, startTransition] = useTransition();
  const isSidebar = variant === "sidebar";
  const collapsed = useSyncExternalStore(
    isSidebar ? subscribeSidebar : subscribeNoop,
    isSidebar ? getSidebarSnapshot : getSidebarServerSnapshot,
    getSidebarServerSnapshot,
  );
  const initial = email?.trim().charAt(0).toUpperCase() || null;
  const accountLabel = email ?? "Sua conta";
  const collapsedAccountLabel = devBypass ? `${accountLabel} (Modo dev)` : accountLabel;

  const avatar = (
    <span className="relative inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-primary-subtle text-caption font-semibold text-foreground-secondary">
      {initial ?? <UserRound aria-hidden="true" className="size-3.5" />}
      {devBypass ? (
        <span
          aria-hidden="true"
          className="absolute -right-0.5 -bottom-0.5 size-2 rounded-full bg-warning ring-2 ring-surface"
        />
      ) : null}
    </span>
  );

  const sidebarTrigger = (
    <button
      type="button"
      aria-label={collapsed ? `${collapsedAccountLabel} — abrir menu da conta` : undefined}
      className={cn(
        "group flex h-10 w-full items-center rounded-md text-left transition-[background-color,color,transform] duration-150 ease-[var(--ease-out)] outline-none hover:bg-primary-subtle/70 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-2 focus-visible:outline-transparent active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 pointer-coarse:h-11",
        collapsed ? "justify-center px-0" : "gap-2.5 px-1 pr-2",
      )}
    >
      {avatar}
      {!collapsed ? (
        <>
          <span className="grid min-w-0 flex-1">
            <span className="truncate text-label font-medium text-foreground" title={email ?? undefined}>
              {accountLabel}
            </span>
            {devBypass ? <span className="truncate text-caption text-warning">Modo dev</span> : null}
            <span className="sr-only"> — abrir menu da conta</span>
          </span>
          <ChevronsUpDown
            aria-hidden="true"
            strokeWidth={1.75}
            className="size-3.5 shrink-0 text-muted-subtle transition-colors group-hover:text-foreground motion-reduce:transition-none"
          />
        </>
      ) : null}
    </button>
  );

  return (
    <>
      <DropdownMenu>
        {isSidebar ? (
          <Tooltip delayDuration={180} open={collapsed ? undefined : false}>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>{sidebarTrigger}</DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={10}>
              {collapsedAccountLabel}
            </TooltipContent>
          </Tooltip>
        ) : (
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={devBypass ? "Menu da conta (Modo dev)" : "Menu da conta"}
              className="relative inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-border-strong bg-primary-subtle text-caption font-semibold text-foreground-secondary transition-[background-color,border-color,color,transform] duration-150 ease-[var(--ease-out)] outline-none hover:border-control-border hover:bg-primary-subtle-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:outline-2 focus-visible:outline-transparent active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 sm:size-9 pointer-coarse:size-11"
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
          side={isSidebar ? (collapsed ? "right" : "top") : "bottom"}
          align={isSidebar ? (collapsed ? "end" : "start") : "end"}
          sideOffset={collapsed && isSidebar ? 10 : 8}
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

          <DropdownMenuItem onSelect={() => setGuideDialogOpen(true)}>
            <CircleHelp aria-hidden="true" className="text-muted" />
            Guia e atalhos
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            aria-busy={isPending || undefined}
            onSelect={(event) => {
              event.preventDefault();
              if (isPending) return;
              startTransition(async () => {
                try {
                  await logoutAction();
                } catch (error) {
                  if (isRedirectError(error)) throw error;
                  toast.error("Não foi possível sair. Tente novamente.");
                }
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
    </>
  );
}

"use client";

import { LoaderCircle, LogOut, SlidersHorizontal, UserRound } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";

import {
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui";

import { logoutAction } from "../actions";

type UserMenuDropdownProps = {
  email: string | null;
  devBypass: boolean;
};

/** Avatar e menu da conta no canto direito do header (Preferências e Sair). */
export function UserMenuDropdown({ email, devBypass }: UserMenuDropdownProps) {
  const [isPending, startTransition] = useTransition();
  const initial = email?.trim().charAt(0).toUpperCase() || null;

  return (
    <DropdownMenu>
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

      <DropdownMenuContent align="end" className="w-60">
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

import type { Metadata } from "next";
import { Suspense } from "react";

import {
  Alert,
  AlertDescription,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
} from "@/components/ui";
import { LoginForm } from "@/features/auth/components/login-form";
import { nextPathSchema } from "@/features/auth/schemas";

export const metadata: Metadata = { title: "Entrar · Leilão Tracker" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-16">
      <Card className="w-full max-w-100">
        <CardHeader>
          <p className="text-overline text-primary uppercase">Leilão Tracker</p>
          <CardTitle>Entrar</CardTitle>
          <CardDescription>Acesse com a conta autorizada.</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<LoginFormSkeleton />}>
            <LoginFormWithRedirect searchParams={searchParams} />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}

async function LoginFormWithRedirect({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { next } = await searchParams;
  const nextPath = typeof next === "string" ? nextPathSchema.parse(next) : undefined;

  return (
    <div className="grid gap-4">
      {nextPath ? (
        <Alert variant="info">
          <AlertDescription>Sua sessão expirou ou é preciso entrar para continuar.</AlertDescription>
        </Alert>
      ) : null}
      <LoginForm next={nextPath} />
    </div>
  );
}

function LoginFormSkeleton() {
  return (
    <div className="grid gap-4" aria-hidden="true">
      <Skeleton className="h-16" />
      <Skeleton className="h-16" />
      <Skeleton className="mt-2 h-10" />
    </div>
  );
}

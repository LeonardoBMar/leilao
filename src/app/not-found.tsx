import { SearchX } from "lucide-react";

import { ButtonLink, EmptyState } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-16">
      <EmptyState
        icon={SearchX}
        title="Página não encontrada"
        description="O endereço não existe ou o registro não está disponível para a sua conta."
        action={
          <ButtonLink href="/dashboard" variant="secondary">
            Ir para o dashboard
          </ButtonLink>
        }
      />
    </main>
  );
}

import { SearchX } from "lucide-react";
import Link from "next/link";

import { Button, EmptyState } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-16">
      <EmptyState
        icon={SearchX}
        title="Página não encontrada"
        description="O endereço não existe ou o registro não está disponível para a sua conta."
        action={
          <Button asChild variant="secondary">
            <Link href="/dashboard">Ir para o dashboard</Link>
          </Button>
        }
      />
    </main>
  );
}

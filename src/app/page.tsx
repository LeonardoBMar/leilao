import { redirect } from "next/navigation";

/**
 * A raiz não tem conteúdo próprio: o proxy leva ao login (sem sessão) ou ao dashboard (com sessão) antes de chegar
 * aqui. O redirect é só a reserva, caso o proxy não rode.
 */
export default function RootPage() {
  redirect("/dashboard");
}

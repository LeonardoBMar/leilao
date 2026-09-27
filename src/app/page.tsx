import { redirect } from "next/navigation";

/** A raiz não tem conteúdo próprio: o proxy leva visitantes sem sessão ao login. */
export default function RootPage() {
  redirect("/dashboard");
}

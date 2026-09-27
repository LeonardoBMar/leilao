import type { VariantProps } from "class-variance-authority";
import Link, { type LinkProps } from "next/link";

import { cn } from "@/lib/utils";

import { buttonVariants } from "./button-variants";

type ButtonLinkProps<RouteType> = LinkProps<RouteType> &
  Omit<React.ComponentProps<"a">, keyof LinkProps<RouteType>> &
  VariantProps<typeof buttonVariants>;

/**
 * Link com aparência de botão, seguro em Server Components (sem "use client").
 *
 * Use no lugar de `<Button asChild><Link/></Button>` quando o link for montado no servidor: o elemento que
 * atravessa a fronteira servidor→cliente pode chegar ao `Button` como referência lazy, e o `Children.only` do
 * `asChild` lança "React.Children.only expected to receive a single React element child".
 */
function ButtonLink<RouteType>({ variant, size, className, ...props }: ButtonLinkProps<RouteType>) {
  return <Link className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export { ButtonLink };

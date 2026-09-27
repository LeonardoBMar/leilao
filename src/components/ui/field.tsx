import { cn } from "@/lib/utils";

function Field({ className, ...props }: React.ComponentProps<"div">) {
  // content-start: em grids de formulário o campo é esticado até a altura do vizinho (ex.: vizinho com
  // texto de ajuda). Sem isso, as linhas internas esticam e label/controle descem, desalinhando a linha.
  // min-w-0 + grid-cols-1: o texto do controle (ex.: opção longa de um select) não alarga a coluna do grid pai;
  // o controle trunca dentro dela em vez de vazar do card.
  return <div className={cn("grid min-w-0 grid-cols-1 content-start gap-2", className)} {...props} />;
}

function FieldLabel({ className, ...props }: React.ComponentProps<"label">) {
  return <label className={cn("text-label text-foreground", className)} {...props} />;
}

function FieldDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-caption text-muted", className)} {...props} />;
}

function FieldError({ className, role = "alert", ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-caption text-error", className)} role={role} {...props} />;
}

function RequiredMark() {
  return (
    <span aria-hidden="true" className="text-error">
      {" "}
      *
    </span>
  );
}

export { Field, FieldDescription, FieldError, FieldLabel, RequiredMark };

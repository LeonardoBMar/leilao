# Biblioteca UI

Esta pasta contém as primitivas reutilizáveis do Leilão Tracker. Os contratos visuais e de uso estão em [`DESIGN.md`](../../../DESIGN.md).

## Regras de uso

- Importe pelo barrel `@/components/ui` quando consumir mais de uma primitiva.
- Use as variantes semânticas existentes antes de criar outra.
- Componentes de domínio ficam em `src/features/<feature>/components`, não nesta pasta.
- Não use cores literais nem espaçamentos arbitrários nos consumidores.
- Todo botão apenas com ícone precisa de `aria-label`.
- Todo formulário deve apresentar label e mensagem de erro associada.

## Componentes

| Grupo | Componentes | Uso |
| --- | --- | --- |
| Ação | `Button` | Ações primary, secondary, outline, ghost, destructive e link. Suporta loading. |
| Formulário | `Input`, `Textarea`, `SelectField`, `Checkbox`, `RadioGroup`, `Switch` | Entrada acessível com label, descrição e erro. |
| Estrutura | `Card`, `Table`, `Tabs`, `Pagination` | Composição de conteúdo e navegação local. |
| Estado | `Badge`, `Alert`, `Skeleton`, `Spinner`, `EmptyState` | Estado semântico, carregamento e ausência de dados. |
| Overlay | `Dialog`, `DropdownMenu`, `Tooltip` | Interações acessíveis providas por Radix. |
| Feedback | `Toaster`, `toast` | Confirmações e falhas globais breves. |

## Exemplos

```tsx
import { Button, Input } from "@/components/ui";

<Input
  label="Nome do leilão"
  placeholder="Ex.: Leilão Detran SP"
  helperText="Use o nome exibido no edital."
  required
/>

<Button loading={isSaving} loadingLabel="Salvando…">Salvar leilão</Button>
```

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

<Card>
  <CardHeader>
    <CardTitle>Resumo</CardTitle>
  </CardHeader>
  <CardContent>Conteúdo composto pela feature.</CardContent>
</Card>
```

Não há Storybook nesta fase. A rota inicial funciona como referência visual temporária durante a fundação do projeto.

## Contratos de composição

- Passe `loading={false}` desde o primeiro render de ações assíncronas para reservar o espaço dos dois estados. Loading mantém contraste, bloqueia repetição e expõe `aria-busy`; `disabled` usa aparência própria.
- `Button asChild` recebe um único elemento. Exemplo: `<Button asChild variant="secondary"><a href="/leiloes">Ver leilões</a></Button>`. Links bloqueados saem do Tab e não disparam navegação ou handlers de ativação. Prefira `Button` nativo para mutações; filhos customizados devem repassar props e ref ao elemento interativo, como exige Radix Slot.
- Botões `sm`, checkbox e radio mantêm alvos de 40 × 40 px; switch mantém 44 × 40 px. Use o label da primitiva para ampliar a área clicável.
- Use `text-heading-2`, `text-heading-3`, `text-body`, `text-label` e `text-caption`. `cn()` distingue tamanho de cor, como em `text-heading-2 text-foreground`.
- `border` e `border-strong` são decorativos; campos usam `control-border` e `placeholder`.
- Formulários e rodapés mudam de composição em `md` (768 px). A ordem visual das ações acompanha a ordem do DOM.
- `SelectContent` em modo `popper` acompanha a largura do gatilho. `Table` não impõe largura mínima; defina-a na feature quando a comparação exigir rolagem. Para lotes, use registros empilhados abaixo de `md`.
- `buttonVariants` permanece disponível pelo barrel e por `./button-variants`, inclusive em Server Components.

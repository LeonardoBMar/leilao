"use client";

import { Eye, MoreHorizontal, Plus, Save, Trash2 } from "lucide-react";
import { useState } from "react";

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Checkbox,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  Input,
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  RadioGroup,
  RadioItem,
  SelectField,
  Skeleton,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  toast,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui";

const sampleLots = [
  {
    id: "152",
    vehicle: "Toyota Corolla 2020",
    status: "Abaixo do limite",
    variant: "success",
    currentBid: "R$ 38.500,00",
    limit: "R$ 42.000,00",
  },
  {
    id: "184",
    vehicle: "Honda Civic 2019",
    status: "Acima do limite",
    variant: "destructive",
    currentBid: "R$ 51.000,00",
    limit: "R$ 47.000,00",
  },
] as const;

export function ComponentShowcase() {
  const [followed, setFollowed] = useState(true);
  const [commission, setCommission] = useState("fixed");
  const [saving, setSaving] = useState(false);

  return (
    <div className="grid min-w-0 gap-10 [&>section]:min-w-0">
      <section aria-labelledby="actions-title" className="grid gap-5">
        <div>
          <h2 id="actions-title" className="text-heading-3">
            Ações e estados
          </h2>
          <p className="mt-1 text-body text-foreground-secondary">
            Variantes essenciais, com foco, loading e significado semântico consistentes.
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Button>
              <Plus aria-hidden="true" />
              Novo leilão
            </Button>
            <Button variant="secondary">Cancelar</Button>
            <Button variant="outline">Ver análise</Button>
            <Button variant="ghost">Arquivar</Button>
            <Button variant="destructive">
              <Trash2 aria-hidden="true" />
              Excluir
            </Button>
            <Button loading loadingLabel="Salvando…">
              Salvar
            </Button>
            <Button disabled>Indisponível</Button>
            <Button asChild variant="secondary" size="sm">
              <a href="#forms-title">Ver formulário</a>
            </Button>
            <Button asChild disabled variant="secondary">
              <a href="#forms-title">Link indisponível</a>
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button aria-label="Mais ações" size="icon" variant="ghost">
                  <MoreHorizontal aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Mais ações</TooltipContent>
            </Tooltip>
          </CardContent>
        </Card>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            loading={saving}
            loadingLabel="Salvando exemplo…"
            onClick={async () => {
              setSaving(true);
              await new Promise((resolve) => setTimeout(resolve, 3000));
              setSaving(false);
              toast.success("Demonstração concluída");
            }}
          >
            <Save aria-hidden="true" />
            Simular salvamento
          </Button>
          <Button asChild loading={saving} loadingLabel="Aguarde…" variant="outline">
            <a href="#data-title">Ver dados</a>
          </Button>
          <p className="text-caption text-muted">Exemplo de carregamento, sem gravar dados.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge>Rascunho</Badge>
          <Badge variant="primary">Acompanhando</Badge>
          <Badge variant="success">Abaixo do limite</Badge>
          <Badge variant="warning">No limite</Badge>
          <Badge variant="destructive">Acima do limite</Badge>
        </div>
      </section>

      <section aria-labelledby="forms-title" className="grid gap-5">
        <div>
          <h2 id="forms-title" className="text-heading-3">
            Formulários
          </h2>
          <p className="mt-1 text-body text-foreground-secondary">
            Campos com label, ajuda, erro e unidades que não dependem de placeholder.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Dados do lote</CardTitle>
            <CardDescription>Exemplo de composição para um formulário do produto.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Input label="Marca e modelo" placeholder="Ex.: Toyota Corolla" required />
            <SelectField
              label="Origem"
              placeholder="Selecione a origem"
              options={[
                { label: "Detran", value: "detran" },
                { label: "Seguradora", value: "seguradora" },
                { label: "Financeira", value: "financeira" },
              ]}
              required
            />
            <Input
              className="tabular-nums"
              inputMode="decimal"
              label="Lance atual"
              placeholder="R$ 0,00"
              helperText="Último valor observado manualmente."
            />
            <Input label="Preço final" placeholder="R$ 0,00" error="Informe um valor maior que zero." />
            <Textarea
              containerClassName="md:col-span-2"
              label="Observações"
              placeholder="Registre danos, documentação e premissas da análise."
            />
            <div className="grid gap-2 md:col-span-2 md:grid-cols-2">
              <Checkbox label="Edital analisado" defaultChecked />
              <Switch checked={followed} label="Acompanhar lote" onCheckedChange={setFollowed} />
            </div>
            <div className="md:col-span-2">
              <p id="commission-label" className="mb-2 text-label">
                Modalidade de comissão
              </p>
              <RadioGroup aria-labelledby="commission-label" value={commission} onValueChange={setCommission}>
                <RadioItem label="Valor fixo" value="fixed" />
                <RadioItem label="Percentual sobre o lance" value="percentage" />
              </RadioGroup>
            </div>
          </CardContent>
          <CardFooter className="justify-end">
            <Button variant="secondary">Salvar rascunho</Button>
            <Button>
              <Save aria-hidden="true" />
              Fixar análise
            </Button>
          </CardFooter>
        </Card>
      </section>

      <section aria-labelledby="feedback-title" className="grid gap-5">
        <div>
          <h2 id="feedback-title" className="text-heading-3">
            Feedback e overlays
          </h2>
          <p className="mt-1 text-body text-foreground-secondary">
            Mensagens persistentes, confirmação contextual e ações secundárias.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Alert variant="info">
            <AlertTitle>Análise retrospectiva</AlertTitle>
            <AlertDescription>
              Esta versão foi criada depois do resultado e não entra nas métricas de decisão.
            </AlertDescription>
          </Alert>
          <Alert variant="success">
            <AlertTitle>Análise fixada</AlertTitle>
            <AlertDescription>As premissas desta versão foram preservadas.</AlertDescription>
          </Alert>
        </div>
        <div className="flex flex-wrap gap-3">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Abrir confirmação</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Fixar esta análise?</DialogTitle>
                <DialogDescription>
                  Os valores desta versão não poderão ser editados. Uma revisão criará uma nova versão.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="secondary">Cancelar</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button onClick={() => toast.success("Análise fixada")}>Fixar análise</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary">Ações do lote</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Lote 152</DropdownMenuLabel>
              <DropdownMenuItem>Editar lote</DropdownMenuItem>
              <DropdownMenuItem>Registrar resultado</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive>Excluir definitivamente</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="secondary" onClick={() => toast.success("Leilão salvo")}>
            Mostrar toast
          </Button>
        </div>
      </section>

      <section aria-labelledby="data-title" className="grid gap-5">
        <div>
          <h2 id="data-title" className="text-heading-3">
            Dados e navegação local
          </h2>
          <p className="mt-1 text-body text-foreground-secondary">
            Tabela simples, tabs e paginação sem introduzir um data-grid.
          </p>
        </div>
        <Tabs defaultValue="lots">
          <TabsList>
            <TabsTrigger value="lots">Lotes</TabsTrigger>
            <TabsTrigger value="analyses">Análises</TabsTrigger>
            <TabsTrigger disabled value="results">
              Resultados
            </TabsTrigger>
          </TabsList>
          <TabsContent value="lots">
            <ul aria-label="Lotes" className="grid gap-4 md:hidden">
              {sampleLots.map((lot) => (
                <li key={lot.id} className="grid gap-4 rounded-lg border border-border bg-surface p-5">
                  <div className="grid gap-1">
                    <h3 className="text-label">{lot.vehicle}</h3>
                    <p className="text-caption text-muted">Lote {lot.id}</p>
                  </div>
                  <Badge variant={lot.variant}>{lot.status}</Badge>
                  <dl className="grid gap-2">
                    <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
                      <dt className="text-muted">Lance atual</dt>
                      <dd className="tabular-nums">{lot.currentBid}</dd>
                    </div>
                    <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
                      <dt className="text-muted">Limite</dt>
                      <dd className="font-semibold tabular-nums">{lot.limit}</dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
            <div className="hidden md:block">
              <Table>
                <caption className="sr-only">Lotes e limites de lance</caption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Veículo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Lance atual</TableHead>
                    <TableHead className="text-right">Limite</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sampleLots.map((lot) => (
                    <TableRow key={lot.id}>
                      <TableCell>
                        <p className="text-label">{lot.vehicle}</p>
                        <p className="text-caption text-muted">Lote {lot.id}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={lot.variant}>{lot.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap tabular-nums">{lot.currentBid}</TableCell>
                      <TableCell className="text-right whitespace-nowrap tabular-nums">{lot.limit}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
          <TabsContent value="analyses">
            <EmptyState
              icon={Eye}
              title="Nenhuma análise nesta visualização"
              description="Crie uma análise financeira para preservar suas premissas."
              action={<Button variant="secondary">Criar análise</Button>}
            />
          </TabsContent>
        </Tabs>
        <Pagination>
          <p className="text-body text-muted">1–2 de 2</p>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious aria-disabled="true" href="#" />
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#" isActive>
                1
              </PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext aria-disabled="true" href="#" />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </section>

      <section aria-labelledby="loading-title" className="grid gap-5">
        <h2 id="loading-title" className="text-heading-3">
          Carregamento
        </h2>
        <Card>
          <CardContent className="grid gap-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-full max-w-xl" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

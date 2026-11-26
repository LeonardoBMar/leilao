"use client";

import { Plus, Trash2 } from "lucide-react";
import { useActionState, useState } from "react";

import {
  Alert,
  AlertDescription,
  Button,
  ConfirmDialog,
  CurrencyInput,
  Input,
  Money,
  SelectField,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  toast,
  useActionToast,
} from "@/components/ui";
import { EXPENSE_CATEGORIES, type ExpenseCategory } from "@/domain/post-auction/pnl";
import { type ActionState, fieldError, fieldValue, idleState } from "@/lib/action-state";
import { formatBRL, formatCalendarDate } from "@/lib/format";

import { addLotExpenseAction, deleteLotExpenseAction } from "../actions";
import { EXPENSE_CATEGORY_LABELS } from "../labels";
import type { LotExpenseItem } from "../types";

const CATEGORY_OPTIONS = EXPENSE_CATEGORIES.map((value) => ({
  value,
  label: EXPENSE_CATEGORY_LABELS[value],
}));

type PostAuctionExpensesProps = {
  lotId: string;
  expenses: readonly LotExpenseItem[];
  defaultDate: string;
};

/** Registro rápido e histórico de despesas reais lançadas no pós-arremate (D-96). */
export function PostAuctionExpenses({ lotId, expenses, defaultDate }: PostAuctionExpensesProps) {
  const [category, setCategory] = useState<ExpenseCategory>("repair");
  const [formKey, setFormKey] = useState(0);
  const { isPending: isDeleting, run: runDelete } = useActionToast();

  const [state, formAction, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const next = await addLotExpenseAction(lotId, prev, formData);
    if (next.status === "success") {
      if (next.message) toast.success(next.message);
      setFormKey((key) => key + 1);
    }
    return next;
  }, idleState);

  return (
    <div className="grid gap-4 border-t border-border pt-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-label font-semibold text-foreground">Despesas reais</h3>
        <span className="text-caption text-muted tabular-nums">
          {expenses.length === 0
            ? "Nenhuma despesa lançada"
            : expenses.length === 1
              ? "1 lançamento"
              : `${expenses.length} lançamentos`}
        </span>
      </div>

      <form
        key={formKey}
        action={formAction}
        noValidate
        className="grid gap-3 rounded-lg border border-border bg-background p-3.5"
      >
        {state.status === "error" && !state.fieldErrors ? (
          <Alert variant="error">
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_minmax(0,9rem)_minmax(0,9.5rem)]">
          <SelectField
            name="category"
            label="Categoria"
            options={CATEGORY_OPTIONS}
            value={category}
            onValueChange={(next) => {
              const matched = EXPENSE_CATEGORIES.find((item) => item === next);
              if (matched) setCategory(matched);
            }}
            error={fieldError(state, "category")}
          />
          <Input
            name="description"
            label="Descrição"
            placeholder="Ex.: Funilaria porta dianteira + pintura"
            required
            maxLength={200}
            defaultValue={fieldValue(state, "description") ?? ""}
            error={fieldError(state, "description")}
          />
          <CurrencyInput
            name="amount"
            label="Valor"
            required
            defaultValue={fieldValue(state, "amount") ?? ""}
            error={fieldError(state, "amount")}
          />
          <Input
            name="incurredAt"
            label="Data"
            type="date"
            required
            className="tabular-nums"
            defaultValue={fieldValue(state, "incurredAt") ?? defaultDate}
            error={fieldError(state, "incurredAt")}
          />
        </div>

        <div className="flex justify-end">
          <Button type="submit" variant="secondary" size="sm" loading={pending} loadingLabel="Registrando…">
            <Plus aria-hidden="true" />
            Adicionar despesa
          </Button>
        </div>
      </form>

      {expenses.length > 0 ? (
        <div className="overflow-x-auto">
          <Table className="min-w-130">
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="w-12 text-right">
                  <span className="sr-only">Ações</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell className="whitespace-nowrap text-muted tabular-nums">
                    {formatCalendarDate(expense.incurredAt)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-foreground-secondary">
                    {EXPENSE_CATEGORY_LABELS[expense.category]}
                  </TableCell>
                  <TableCell className="text-foreground">{expense.description}</TableCell>
                  <TableCell className="text-right font-medium text-foreground tabular-nums">
                    <Money value={expense.amount} />
                  </TableCell>
                  <TableCell className="text-right">
                    <ConfirmDialog
                      title="Remover despesa?"
                      description={`Remover "${expense.description}" (${formatBRL(expense.amount)}) do histórico de despesas reais?`}
                      confirmLabel="Remover"
                      loading={isDeleting}
                      loadingLabel="Removendo…"
                      closeOnConfirm
                      onConfirm={() => runDelete(() => deleteLotExpenseAction(lotId, expense.id))}
                      trigger={
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-label={`Remover despesa ${expense.description}`}
                          className="text-muted hover:text-error"
                        >
                          <Trash2 aria-hidden="true" className="size-4" />
                        </Button>
                      }
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </div>
  );
}

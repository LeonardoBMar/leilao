"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { Component, type ErrorInfo, type ReactNode, useTransition } from "react";

import { Alert, AlertDescription, AlertTitle, Button, ButtonLink } from "@/components/ui";

type ErrorBoundaryInnerProps = {
  title: string;
  isRetrying: boolean;
  onRetry: (reset: () => void) => void;
  fallbackHref?: Route;
  fallbackLabel?: string;
  children: ReactNode;
};

type ErrorBoundaryInnerState = {
  hasError: boolean;
};

class ErrorBoundaryInner extends Component<ErrorBoundaryInnerProps, ErrorBoundaryInnerState> {
  override state: ErrorBoundaryInnerState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryInnerState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  private handleRetry = () => {
    this.props.onRetry(() => this.setState({ hasError: false }));
  };

  override render() {
    if (!this.state.hasError) return this.props.children;
    const { fallbackHref, fallbackLabel, isRetrying } = this.props;
    return (
      <Alert variant="error" className="grid gap-3">
        <div className="grid gap-1">
          <AlertTitle>{this.props.title}</AlertTitle>
          <AlertDescription>
            {fallbackHref && fallbackLabel
              ? "Ocorreu uma falha temporária nesta seção. Tente novamente ou use o atalho abaixo; seus dados salvos permanecem intactos."
              : "Ocorreu uma falha temporária nesta seção. Tente novamente em instantes; seus dados salvos permanecem intactos."}
          </AlertDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={isRetrying}
            loadingLabel="Tentando…"
            onClick={this.handleRetry}
          >
            Tentar novamente
          </Button>
          {fallbackHref && fallbackLabel ? (
            <ButtonLink href={fallbackHref} variant="ghost" size="sm">
              {fallbackLabel}
            </ButtonLink>
          ) : null}
        </div>
      </Alert>
    );
  }
}

/** Isola falhas de uma seção independente para não derrubar a página inteira (DESIGN.md §15.7). */
export function SectionErrorBoundary({
  title = "Algo deu errado",
  fallbackHref,
  fallbackLabel,
  children,
}: {
  title?: string;
  fallbackHref?: Route;
  fallbackLabel?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  return (
    <ErrorBoundaryInner
      title={title}
      isRetrying={isPending}
      fallbackHref={fallbackHref}
      fallbackLabel={fallbackLabel}
      onRetry={(reset) => {
        startTransition(() => {
          router.refresh();
          reset();
        });
      }}
    >
      {children}
    </ErrorBoundaryInner>
  );
}

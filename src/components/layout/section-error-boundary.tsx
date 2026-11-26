"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { Component, type ErrorInfo, type ReactNode } from "react";

import { Alert, AlertDescription, AlertTitle, Button, ButtonLink } from "@/components/ui";

type ErrorBoundaryInnerProps = {
  title: string;
  onRetry: () => void;
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
    this.setState({ hasError: false });
    this.props.onRetry();
  };

  override render() {
    if (!this.state.hasError) return this.props.children;
    const { fallbackHref, fallbackLabel } = this.props;
    return (
      <Alert variant="error" className="grid gap-3">
        <div className="grid gap-1">
          <AlertTitle>{this.props.title}</AlertTitle>
          <AlertDescription>
            Ocorreu uma falha temporária nesta seção. Tente novamente ou use o atalho ao lado; seus dados salvos
            permanecem intactos.
          </AlertDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={this.handleRetry}>
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
  return (
    <ErrorBoundaryInner
      title={title}
      fallbackHref={fallbackHref}
      fallbackLabel={fallbackLabel}
      onRetry={() => router.refresh()}
    >
      {children}
    </ErrorBoundaryInner>
  );
}

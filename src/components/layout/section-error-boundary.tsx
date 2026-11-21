"use client";

import { useRouter } from "next/navigation";
import { Component, type ErrorInfo, type ReactNode } from "react";

import { Alert, AlertDescription, AlertTitle, Button } from "@/components/ui";

type ErrorBoundaryInnerProps = {
  title: string;
  onRetry: () => void;
  children: ReactNode;
};

type ErrorBoundaryInnerState = {
  hasError: boolean;
};

class ErrorBoundaryInner extends Component<ErrorBoundaryInnerProps, ErrorBoundaryInnerState> {
  state: ErrorBoundaryInnerState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryInnerState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  private handleRetry = () => {
    this.setState({ hasError: false });
    this.props.onRetry();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <Alert variant="error" className="grid gap-3">
        <div className="grid gap-1">
          <AlertTitle>{this.props.title}</AlertTitle>
          <AlertDescription>Não foi possível carregar esta seção agora.</AlertDescription>
        </div>
        <div>
          <Button type="button" variant="secondary" size="sm" onClick={this.handleRetry}>
            Tentar novamente
          </Button>
        </div>
      </Alert>
    );
  }
}

/** Isola falhas de uma seção independente para não derrubar a página inteira (DESIGN.md §15.7). */
export function SectionErrorBoundary({
  title = "Algo deu errado",
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  return (
    <ErrorBoundaryInner title={title} onRetry={() => router.refresh()}>
      {children}
    </ErrorBoundaryInner>
  );
}

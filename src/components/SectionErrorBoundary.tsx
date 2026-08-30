"use client";

import { useRouter } from "next/navigation";
import { Component, type ReactNode } from "react";
import { useToastStore } from "@/src/stores/toast-store";

interface InnerProps {
  children: ReactNode;
  label: string;
  onRetry: () => void;
}

interface InnerState {
  hasError: boolean;
}

/**
 * Class component because componentDidCatch has no hook equivalent.
 * Retry can't just clear local state and re-render `children` — for an
 * async Server Component child (GamesResults, FeaturedGames, ...) that
 * element was already resolved server-side before it reached this
 * boundary, so a local re-render alone would show the same failure
 * again. router.refresh() (passed in as onRetry) is what actually
 * re-runs the server component and gives it a fresh chance.
 */
class SectionErrorBoundaryInner extends Component<InnerProps, InnerState> {
  state: InnerState = { hasError: false };

  static getDerivedStateFromError(): InnerState {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error(error);
    useToastStore.getState().showToast(`Couldn't load ${this.props.label}.`, {
      label: "Retry",
      onClick: this.handleRetry,
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false });
    this.props.onRetry();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-nova-hairline bg-nova-crypt px-6 py-12 text-center">
          <p className="text-sm text-nova-ash">
            Couldn&rsquo;t load {this.props.label}.
          </p>
          <button
            type="button"
            onClick={this.handleRetry}
            className="-my-2.5 min-h-11 px-4 py-2.5 text-sm font-semibold text-nova-ember hover:text-nova-ember-lo"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Wrap any section that fetches its own data (an async Server Component,
 * typically inside its own <Suspense>) so a failure there shows an
 * inline retry — not a blank page and not a crash of everything around
 * it. `label` is a short, lowercase noun phrase used in both the inline
 * fallback and the failure toast, e.g. "featured games".
 */
export default function SectionErrorBoundary({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  const router = useRouter();

  return (
    <SectionErrorBoundaryInner label={label} onRetry={() => router.refresh()}>
      {children}
    </SectionErrorBoundaryInner>
  );
}

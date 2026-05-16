import { type ReactNode } from "react";
import { Loader2, AlertTriangle, Inbox } from "lucide-react";

interface AsyncViewProps<T> {
  data: T | null | undefined;
  isLoading: boolean;
  error?: string | null;
  children: (data: T) => ReactNode;
  loading?: ReactNode;
  errorFallback?: ReactNode;
  emptyFallback?: ReactNode;
  isEmpty?: (data: T) => boolean;
}

export function AsyncView<T>({
  data,
  isLoading,
  error,
  children,
  loading,
  errorFallback,
  emptyFallback,
  isEmpty,
}: AsyncViewProps<T>) {
  if (isLoading) {
    return loading ?? (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={20} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return errorFallback ?? (
      <div className="text-center py-8 space-y-2">
        <AlertTriangle size={20} className="text-destructive mx-auto" />
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (data == null || (isEmpty && isEmpty(data))) {
    return emptyFallback ?? (
      <div className="text-center py-8 space-y-2">
        <Inbox size={20} className="text-muted-foreground mx-auto" />
        <p className="text-sm text-muted-foreground">No data</p>
      </div>
    );
  }

  return <>{children(data)}</>;
}

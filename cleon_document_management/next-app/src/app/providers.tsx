"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense, useState } from "react";
import { NavigationHistoryProvider } from "../../hooks/useNavigationHistory";
import { ToastProvider } from "../../hooks/useToast";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={null}>
        <ToastProvider>
          <NavigationHistoryProvider>{children}</NavigationHistoryProvider>
        </ToastProvider>
      </Suspense>
    </QueryClientProvider>
  );
}

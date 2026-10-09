"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense, useState } from "react";
import { NavigationHistoryProvider } from "../../hooks/useNavigationHistory";
import { WorkspaceDelegationProvider } from "../../lib/workspaceDelegation";
import { ToastProvider } from "../../hooks/useToast";
import { AppDialogProvider } from "../../hooks/useAppDialog";
import { FormWindowProvider } from "@/app/components/FormWindowProvider";
import { TooltipProvider } from "@/components/ui/tooltip";

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
          <TooltipProvider>
            <AppDialogProvider>
              <FormWindowProvider>
                <WorkspaceDelegationProvider>
                  <NavigationHistoryProvider>{children}</NavigationHistoryProvider>
                </WorkspaceDelegationProvider>
              </FormWindowProvider>
            </AppDialogProvider>
          </TooltipProvider>
        </ToastProvider>
      </Suspense>
    </QueryClientProvider>
  );
}

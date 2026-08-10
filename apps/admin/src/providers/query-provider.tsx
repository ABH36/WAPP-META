"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "../lib/api";

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (
            error instanceof ApiError &&
            error.statusCode &&
            [401, 403, 404].includes(error.statusCode)
          ) {
            return false;
          }
          return failureCount < 1;
        },
      },
    },
  });
}

export function QueryProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [client] = React.useState(createQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

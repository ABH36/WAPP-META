"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { emailSchema } from "@wapp/shared-validation";
import { Alert, Button, Input, PasswordInput } from "@wapp/ui";
import { authService } from "../../services/auth.service";
import { useAuthStore } from "../../stores/auth-store";
import { ApiError } from "../../lib/api";
import { hydrateUserPreferences } from "../../lib/preference-sync";

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

/**
 * FRD-001 Volume-2 §4.1/§6 — "Login Form." Deliberately NOT a `packages/ui`
 * component (see docs/ADR-FE-003-authentication-ui-strategy.md) — its
 * submit behavior (which authService, which store, where it redirects) is
 * inherently app-specific, unlike the presentational primitives it
 * composes (`Input`/`PasswordInput`/`Alert`/`Button`, all from `@wapp/ui`).
 */
export function LoginForm(): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setSession = useAuthStore((s) => s.setSession);
  const [formError, setFormError] = React.useState<{
    message: string;
    variant: "danger" | "warning";
  } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", rememberMe: true },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const { tokens, user } = await authService.login(
        values.email,
        values.password,
        values.rememberMe,
      );
      setSession(user, tokens.accessToken);
      void hydrateUserPreferences();
      router.push(searchParams.get("redirectTo") ?? "/dashboard");
    } catch (error) {
      if (error instanceof ApiError) {
        // §10 — Maintenance Mode (503) is transient/expected-to-resolve;
        // everything else (invalid credentials 401, locked/suspended 403)
        // is a harder rejection. Always the backend's own message, never
        // custom copy (BR-006 — never expose sensitive backend information
        // beyond what it already chose to disclose).
        const variant = error.statusCode === 503 ? "warning" : "danger";
        setFormError({
          message:
            error.statusCode === null
              ? "Unable to reach the server. Check your connection and try again."
              : error.message,
          variant,
        });
      } else {
        setFormError({ message: "Something went wrong. Please try again.", variant: "danger" });
      }
    }
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {formError ? <Alert variant={formError.variant}>{formError.message}</Alert> : null}

      <div>
        <label
          htmlFor="email"
          className="text-body-sm mb-1 block font-medium text-neutral-700 dark:text-neutral-300"
        >
          Email
        </label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          error={!!errors.email}
          {...register("email")}
        />
        {errors.email ? (
          <p className="text-body-sm text-danger-700 mt-1">{errors.email.message}</p>
        ) : null}
      </div>

      <div>
        <label
          htmlFor="password"
          className="text-body-sm mb-1 block font-medium text-neutral-700 dark:text-neutral-300"
        >
          Password
        </label>
        <PasswordInput
          id="password"
          autoComplete="current-password"
          error={!!errors.password}
          {...register("password")}
        />
        {errors.password ? (
          <p className="text-body-sm text-danger-700 mt-1">{errors.password.message}</p>
        ) : null}
      </div>

      <label className="text-body-sm flex items-center gap-2 text-neutral-700 dark:text-neutral-300">
        <input
          type="checkbox"
          className="text-brand-500 focus-visible:ring-brand-500 h-4 w-4 rounded border-neutral-300 focus-visible:ring-2 dark:border-neutral-700"
          {...register("rememberMe")}
        />
        Remember me
      </label>

      <Button type="submit" variant="primary" loading={isSubmitting} className="w-full">
        Log in
      </Button>

      <div className="text-body-sm flex justify-between">
        <a href="/forgot-password" className="text-brand-600 hover:underline">
          Forgot password?
        </a>
      </div>
    </form>
  );
}

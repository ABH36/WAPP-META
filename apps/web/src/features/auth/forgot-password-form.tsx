"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { emailSchema } from "@wapp/shared-validation";
import { Alert, Button, Input } from "@wapp/ui";
import { authService } from "../../services/auth.service";
import { ApiError } from "../../lib/api";

const forgotPasswordSchema = z.object({ email: emailSchema });
type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

/** FRD-001 Volume-2 §4.2 — "No account existence disclosure." The success message is the backend's own (identical whether the account exists or not) — never authored client-side, so the guarantee can't accidentally drift. */
export function ForgotPasswordForm(): React.JSX.Element {
  const [result, setResult] = React.useState<{
    message: string;
    variant: "success" | "danger";
  } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setResult(null);
    try {
      const { message } = await authService.forgotPassword(values.email);
      setResult({ message, variant: "success" });
    } catch (error) {
      setResult({
        message:
          error instanceof ApiError ? error.message : "Something went wrong. Please try again.",
        variant: "danger",
      });
    }
  });

  if (result?.variant === "success") {
    return <Alert variant="info">{result.message}</Alert>;
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {result ? <Alert variant="danger">{result.message}</Alert> : null}

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

      <Button type="submit" variant="primary" loading={isSubmitting} className="w-full">
        Send reset link
      </Button>
    </form>
  );
}

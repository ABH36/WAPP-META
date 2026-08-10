"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { passwordSchema, PASSWORD_POLICY_RULES } from "@wapp/shared-validation";
import { Alert, Button, PasswordInput, PasswordStrengthIndicator } from "@wapp/ui";
import { authService } from "../../services/auth.service";
import { ApiError } from "../../lib/api";

const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

/**
 * FRD-001 Volume-2 §4.3 — "Token validation." Architecture Review,
 * 2026-08-10: no backend endpoint exists to validate a reset token before
 * the form is shown — the form always renders, and an invalid/expired
 * token surfaces only on submit (`POST /auth/reset-password`'s own
 * `BadRequestException`). No client-side workaround/pre-check is
 * attempted.
 */
export function ResetPasswordForm(): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [formError, setFormError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });
  const password = watch("password");

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await authService.resetPassword(token, values.password);
      setSuccess(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch (error) {
      setFormError(
        error instanceof ApiError ? error.message : "Something went wrong. Please try again.",
      );
    }
  });

  if (!token) {
    return <Alert variant="danger">This password reset link is invalid or has expired.</Alert>;
  }

  if (success) {
    return <Alert variant="info">Password reset successful. Redirecting to log in…</Alert>;
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {formError ? <Alert variant="danger">{formError}</Alert> : null}

      <div>
        <label
          htmlFor="password"
          className="text-body-sm mb-1 block font-medium text-neutral-700 dark:text-neutral-300"
        >
          New password
        </label>
        <PasswordInput
          id="password"
          autoComplete="new-password"
          error={!!errors.password}
          {...register("password")}
        />
        <PasswordStrengthIndicator
          password={password}
          rules={PASSWORD_POLICY_RULES}
          className="mt-2"
        />
      </div>

      <div>
        <label
          htmlFor="confirmPassword"
          className="text-body-sm mb-1 block font-medium text-neutral-700 dark:text-neutral-300"
        >
          Confirm new password
        </label>
        <PasswordInput
          id="confirmPassword"
          autoComplete="new-password"
          error={!!errors.confirmPassword}
          {...register("confirmPassword")}
        />
        {errors.confirmPassword ? (
          <p className="text-body-sm text-danger-700 mt-1">{errors.confirmPassword.message}</p>
        ) : null}
      </div>

      <Button type="submit" variant="primary" loading={isSubmitting} className="w-full">
        Reset password
      </Button>
    </form>
  );
}

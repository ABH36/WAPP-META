"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { passwordSchema, PASSWORD_POLICY_RULES } from "@wapp/shared-validation";
import { Alert, Button, PasswordInput, PasswordStrengthIndicator } from "@wapp/ui";
import { securitySettingsService } from "../../services/security-settings.service";
import { ApiError } from "../../lib/api";

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

/** FRD-001 Volume-2 §4.7 — the success message is the backend's own, verbatim: it always includes "You've been signed out of all other sessions" (a real side effect of POST /settings/security/change-password), never custom copy that could omit it. */
export function ChangePasswordForm(): React.JSX.Element {
  const [formError, setFormError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });
  const newPassword = watch("newPassword");

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    setSuccessMessage(null);
    try {
      const { message } = await securitySettingsService.changePassword(
        values.currentPassword,
        values.newPassword,
      );
      setSuccessMessage(message);
      reset();
    } catch (error) {
      setFormError(
        error instanceof ApiError ? error.message : "Something went wrong. Please try again.",
      );
    }
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {formError ? <Alert variant="danger">{formError}</Alert> : null}
      {successMessage ? <Alert variant="info">{successMessage}</Alert> : null}

      <div>
        <label
          htmlFor="currentPassword"
          className="text-body-sm mb-1 block font-medium text-neutral-700 dark:text-neutral-300"
        >
          Current password
        </label>
        <PasswordInput
          id="currentPassword"
          autoComplete="current-password"
          error={!!errors.currentPassword}
          {...register("currentPassword")}
        />
        {errors.currentPassword ? (
          <p className="text-body-sm text-danger-700 mt-1">{errors.currentPassword.message}</p>
        ) : null}
      </div>

      <div>
        <label
          htmlFor="newPassword"
          className="text-body-sm mb-1 block font-medium text-neutral-700 dark:text-neutral-300"
        >
          New password
        </label>
        <PasswordInput
          id="newPassword"
          autoComplete="new-password"
          error={!!errors.newPassword}
          {...register("newPassword")}
        />
        <PasswordStrengthIndicator
          password={newPassword}
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

      <Button type="submit" variant="primary" loading={isSubmitting} className="w-fit">
        Change password
      </Button>
    </form>
  );
}

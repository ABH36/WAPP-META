import * as React from "react";
import { Check, X } from "lucide-react";
import { cn } from "../lib/cn";

/**
 * DS-001 §4/§6 — "Password Strength Indicator." Deliberately takes a generic
 * `rules` prop rather than importing `@wapp/shared-validation` directly —
 * `packages/ui` stays agnostic to a specific validation schema's internals,
 * the same "UI/design-system dependencies only" boundary established in
 * FRD-001 Volume-1 for axios/zustand. Callers pass
 * `PASSWORD_POLICY_RULES` from `@wapp/shared-validation` (the actual
 * backend-mirroring source of truth).
 */
export interface PasswordRuleCheck {
  id: string;
  label: string;
  test: (password: string) => boolean;
}

export interface PasswordStrengthIndicatorProps {
  password: string;
  rules: PasswordRuleCheck[];
  className?: string;
}

export function PasswordStrengthIndicator({
  password,
  rules,
  className,
}: PasswordStrengthIndicatorProps): React.JSX.Element {
  return (
    <ul className={cn("flex flex-col gap-1", className)}>
      {rules.map((rule) => {
        const passed = rule.test(password);
        return (
          <li
            key={rule.id}
            className={cn(
              "text-body-sm flex items-center gap-2",
              passed
                ? "text-success-700 dark:text-success-500"
                : "text-neutral-500 dark:text-neutral-400",
            )}
          >
            {passed ? (
              <Check className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <X className="h-3.5 w-3.5" aria-hidden />
            )}
            <span>{rule.label}</span>
          </li>
        );
      })}
    </ul>
  );
}

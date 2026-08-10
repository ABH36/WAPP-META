import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "../lib/cn";
import { Input, type InputProps } from "./input";

/** DS-001 §4/§6 — "Password Input." An `Input` with a show/hide toggle, nothing else — validation/strength is `PasswordStrengthIndicator`'s job, kept separate so a Password Input can be used without a strength meter (e.g. the Login form, which only ever needs one field, not a strength check on an existing password). */
export type PasswordInputProps = Omit<InputProps, "type">;

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);

    return (
      <div className="relative">
        <Input
          ref={ref}
          type={visible ? "text" : "password"}
          className={cn("pr-10", className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
        >
          {visible ? (
            <EyeOff className="h-4 w-4" aria-hidden />
          ) : (
            <Eye className="h-4 w-4" aria-hidden />
          )}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";

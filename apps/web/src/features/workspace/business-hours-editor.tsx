"use client";

import * as React from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Permission } from "@wapp/shared-types";
import { Plus, Trash2 } from "lucide-react";
import {
  Alert,
  Button,
  Input,
  SkeletonText,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@wapp/ui";
import { workspaceService } from "../../services/workspace.service";
import { useHasPermission } from "../../lib/permissions";
import { ApiError } from "../../lib/api";

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm");

const businessHoursSchema = z
  .object({
    timezone: z.string().min(1, "Timezone is required"),
    schedule: z.array(
      z.object({
        dayOfWeek: z.number().min(0).max(6),
        isOpen: z.boolean(),
        openTime: timeSchema,
        closeTime: timeSchema,
      }),
    ),
    publicHolidays: z.array(
      z.object({
        date: z.string().min(1, "Date is required"),
        name: z.string().min(1, "Name is required").max(100, "Must be 100 characters or fewer"),
      }),
    ),
  })
  .superRefine((data, ctx) => {
    data.schedule.forEach((day, index) => {
      if (day.isOpen && day.openTime >= day.closeTime) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Opening time must be before closing time",
          path: ["schedule", index, "closeTime"],
        });
      }
    });
    const seenDates = new Set<string>();
    data.publicHolidays.forEach((holiday, index) => {
      if (seenDates.has(holiday.date)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "This date is already a holiday",
          path: ["publicHolidays", index, "date"],
        });
      }
      seenDates.add(holiday.date);
    });
  });

type BusinessHoursValues = z.infer<typeof businessHoursSchema>;

const DEFAULT_SCHEDULE = Array.from({ length: 7 }, (_, dayOfWeek) => ({
  dayOfWeek,
  isOpen: dayOfWeek >= 1 && dayOfWeek <= 5,
  openTime: "09:00",
  closeTime: "18:00",
}));

/** FRD-001 Volume-3 §4.3 — timezone stays a plain text field (the backend accepts any string, no IANA zone list/enum exists to validate against, so none is invented here). Holidays are manual-entry only — no calendar sync exists. */
export function BusinessHoursEditor(): React.JSX.Element {
  const queryClient = useQueryClient();
  const canEdit = useHasPermission(Permission.EDIT_WORKSPACE);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  const workspaceQuery = useQuery({
    queryKey: ["workspace", "current"],
    queryFn: () => workspaceService.current(),
  });

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<BusinessHoursValues>({
    resolver: zodResolver(businessHoursSchema),
    values: workspaceQuery.data
      ? {
          timezone: workspaceQuery.data.businessHours.timezone,
          schedule:
            workspaceQuery.data.businessHours.schedule.length > 0
              ? workspaceQuery.data.businessHours.schedule
              : DEFAULT_SCHEDULE,
          publicHolidays: workspaceQuery.data.businessHours.publicHolidays,
        }
      : undefined,
  });

  const scheduleFields = useFieldArray({ control, name: "schedule" });
  const holidayFields = useFieldArray({ control, name: "publicHolidays" });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    setSuccessMessage(null);
    try {
      const updated = await workspaceService.updateBusinessHours(values);
      queryClient.setQueryData(["workspace", "current"], updated);
      setSuccessMessage("Business hours updated.");
      reset(values);
    } catch (error) {
      setFormError(
        error instanceof ApiError ? error.message : "Something went wrong. Please try again.",
      );
    }
  });

  if (workspaceQuery.isLoading) {
    return <SkeletonText lines={6} />;
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      {formError ? <Alert variant="danger">{formError}</Alert> : null}
      {successMessage ? <Alert variant="info">{successMessage}</Alert> : null}
      {!canEdit ? (
        <Alert variant="info">
          Only the workspace Owner or Administrator can edit business hours.
        </Alert>
      ) : null}

      <div className="max-w-xs">
        <label
          htmlFor="timezone"
          className="text-body-sm mb-1 block font-medium text-neutral-700 dark:text-neutral-300"
        >
          Timezone
        </label>
        <Input
          id="timezone"
          disabled={!canEdit}
          error={!!errors.timezone}
          {...register("timezone")}
        />
        {errors.timezone ? (
          <p className="text-body-sm text-danger-700 mt-1">{errors.timezone.message}</p>
        ) : null}
      </div>

      <div>
        <h2 className="text-h3 mb-2 text-neutral-900 dark:text-neutral-50">Weekly schedule</h2>
        <div className="flex flex-col divide-y divide-neutral-200 dark:divide-neutral-800">
          {scheduleFields.fields.map((field, index) => (
            <div key={field.id} className="flex flex-wrap items-center gap-4 py-3">
              <Switch
                aria-label={`${DAY_LABELS[field.dayOfWeek]} open`}
                checked={field.isOpen}
                disabled={!canEdit}
                onCheckedChange={(next) => scheduleFields.update(index, { ...field, isOpen: next })}
              />
              <span className="text-body w-24 font-medium text-neutral-900 dark:text-neutral-50">
                {DAY_LABELS[field.dayOfWeek]}
              </span>
              <Input
                type="time"
                aria-label={`${DAY_LABELS[field.dayOfWeek]} opening time`}
                className="w-32"
                disabled={!canEdit || !field.isOpen}
                error={!!errors.schedule?.[index]?.openTime}
                {...register(`schedule.${index}.openTime`)}
              />
              <span className="text-neutral-500 dark:text-neutral-400">to</span>
              <Input
                type="time"
                aria-label={`${DAY_LABELS[field.dayOfWeek]} closing time`}
                className="w-32"
                disabled={!canEdit || !field.isOpen}
                error={!!errors.schedule?.[index]?.closeTime}
                {...register(`schedule.${index}.closeTime`)}
              />
              {errors.schedule?.[index]?.closeTime ? (
                <p className="text-body-sm text-danger-700 w-full">
                  {errors.schedule[index]?.closeTime?.message}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-h3 mb-2 text-neutral-900 dark:text-neutral-50">Public holidays</h2>
        {holidayFields.fields.length === 0 ? (
          <p className="text-body-sm text-neutral-500 dark:text-neutral-400">No holidays added.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Name</TableHead>
                {canEdit ? <TableHead>&nbsp;</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {holidayFields.fields.map((field, index) => (
                <TableRow key={field.id}>
                  <TableCell>
                    <Input
                      type="date"
                      aria-label="Holiday date"
                      disabled={!canEdit}
                      error={!!errors.publicHolidays?.[index]?.date}
                      {...register(`publicHolidays.${index}.date`)}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      aria-label="Holiday name"
                      disabled={!canEdit}
                      error={!!errors.publicHolidays?.[index]?.name}
                      {...register(`publicHolidays.${index}.name`)}
                    />
                  </TableCell>
                  {canEdit ? (
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Remove holiday"
                        onClick={() => holidayFields.remove(index)}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </Button>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {canEdit ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={() => holidayFields.append({ date: "", name: "" })}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add holiday
          </Button>
        ) : null}
      </div>

      {canEdit ? (
        <Button
          type="submit"
          variant="primary"
          loading={isSubmitting}
          disabled={!isDirty}
          className="w-fit"
        >
          Save changes
        </Button>
      ) : null}
    </form>
  );
}

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import * as React from "react";
import { useForm, type DefaultValues, type FieldValues, type Path } from "react-hook-form";
import type { z } from "zod";
import type { ActionState } from "@/lib/action-state";

/**
 * React Hook Form + Zod on the client, a Server Action as the authority.
 * Server-side field errors are mapped back onto the form.
 */
export function useActionForm<TSchema extends z.ZodType<FieldValues, FieldValues>>(
  schema: TSchema,
  defaultValues: DefaultValues<z.input<TSchema>>,
  action: (values: z.input<TSchema>) => Promise<ActionState | void>,
) {
  const form = useForm<z.input<TSchema>, unknown, z.output<TSchema>>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: "onTouched",
  });
  const [pending, startTransition] = React.useTransition();
  const [result, setResult] = React.useState<ActionState | null>(null);

  const onSubmit = form.handleSubmit(() => {
    setResult(null);
    // Send the raw input; the server re-validates with the same schema.
    const raw = form.getValues();
    startTransition(async () => {
      const res = await action(raw);
      if (!res) return; // redirected
      setResult(res);
      if (res.fieldErrors) {
        for (const [name, message] of Object.entries(res.fieldErrors)) {
          form.setError(name as Path<z.input<TSchema>>, { message });
        }
      }
    });
  });

  return { form, onSubmit, pending, result, setResult };
}

"use client";

import * as React from "react";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";
import { Radio } from "@base-ui/react/radio";
import { cn } from "@/lib/utils";

function RadioGroup({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive>) {
  return (
    <RadioGroupPrimitive
      data-slot="radio-group"
      className={cn("grid gap-2", className)}
      {...props}
    />
  );
}

function RadioGroupItem({
  value,
  id,
  label,
  className,
}: {
  value: string;
  id: string;
  label: React.ReactNode;
  className?: string;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-200 transition-colors hover:bg-zinc-800/80 has-[[data-checked]]:border-emerald-600 has-[[data-checked]]:bg-emerald-950/30",
        className
      )}
    >
      <Radio.Root
        id={id}
        value={value}
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded-full border border-zinc-500 bg-zinc-950 outline-none transition-colors",
          "data-checked:border-emerald-500 data-checked:bg-emerald-600",
          "focus-visible:ring-2 focus-visible:ring-emerald-500/50"
        )}
      >
        <Radio.Indicator className="size-2 rounded-full bg-white [[data-unchecked]_&]:hidden" />
      </Radio.Root>
      <span className="flex-1">{label}</span>
    </label>
  );
}

export { RadioGroup, RadioGroupItem };

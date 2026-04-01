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
        "flex cursor-pointer items-center gap-2 rounded-md border border-bia-gray/40 bg-bia-blue/50 px-3 py-2 text-sm text-white transition-colors hover:bg-bia-blue-mid/80 has-[[data-checked]]:border-bia-aqua has-[[data-checked]]:bg-bia-aqua/10",
        className
      )}
    >
      <Radio.Root
        id={id}
        value={value}
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded-full border border-bia-gray bg-bia-blue outline-none transition-colors",
          "data-checked:border-bia-aqua data-checked:bg-bia-aqua",
          "focus-visible:ring-2 focus-visible:ring-bia-aqua/50"
        )}
      >
        <Radio.Indicator className="size-2 rounded-full bg-white [[data-unchecked]_&]:hidden" />
      </Radio.Root>
      <span className="flex-1">{label}</span>
    </label>
  );
}

export { RadioGroup, RadioGroupItem };

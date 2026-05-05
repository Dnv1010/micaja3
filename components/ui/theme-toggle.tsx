"use client";

import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme, type Theme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";

const CYCLE: Theme[] = ["system", "dark", "light"];

const ICONS = {
  dark: Moon,
  light: Sun,
  system: Monitor,
} as const;

const LABELS = {
  dark: "Oscuro",
  light: "Claro",
  system: "Auto",
} as const;

export function ThemeToggle({ iconOnly = false }: { iconOnly?: boolean }) {
  const { theme, setTheme } = useTheme();
  const next = CYCLE[(CYCLE.indexOf(theme) + 1) % CYCLE.length];
  const Icon = ICONS[theme];

  return (
    <Button
      variant="ghost"
      size={iconOnly ? "icon" : "sm"}
      onClick={() => setTheme(next)}
      aria-label={`Tema: ${LABELS[theme]}. Clic para cambiar a ${LABELS[next]}`}
      title={`Tema: ${LABELS[theme]}`}
      className="text-muted-foreground hover:text-foreground"
    >
      <Icon className="h-4 w-4" />
      {!iconOnly && <span className="ml-1.5 text-xs">{LABELS[theme]}</span>}
    </Button>
  );
}

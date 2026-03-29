import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const COLORS: Record<string, string> = {
  admin: "bg-violet-600 hover:bg-violet-600 text-white",
  coordinador: "bg-amber-600 hover:bg-amber-600 text-white",
  verificador: "bg-sky-600 hover:bg-sky-600 text-white",
  user: "bg-slate-600 hover:bg-slate-600 text-white",
};

export function RoleBadge({ rol }: { rol: string }) {
  const r = rol.toLowerCase();
  return (
    <Badge className={cn("capitalize text-xs", COLORS[r] || COLORS.user)} variant="secondary">
      {r}
    </Badge>
  );
}

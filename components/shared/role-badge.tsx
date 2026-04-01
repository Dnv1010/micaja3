import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const COLORS: Record<string, string> = {
  admin: "border-bia-purple/30 bg-bia-purple/20 text-bia-purple-light hover:bg-bia-purple/30",
  coordinador: "border-bia-aqua/30 bg-bia-aqua/15 text-bia-aqua hover:bg-bia-aqua/25",
  verificador: "border-bia-gray/30 bg-bia-gray/25 text-bia-gray-light hover:bg-bia-gray/35",
  user: "border-bia-gray/30 bg-bia-blue-mid text-bia-gray-light hover:bg-bia-gray/20",
};

export function RoleBadge({ rol }: { rol: string }) {
  const r = rol.toLowerCase();
  return (
    <Badge className={cn("capitalize text-xs", COLORS[r] || COLORS.user)} variant="outline">
      {r}
    </Badge>
  );
}

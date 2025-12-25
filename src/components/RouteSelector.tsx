import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Route } from "lucide-react";

interface RouteSelectorProps {
  value: string;
  onChange: (route: string) => void;
  routes: string[];
  disabled?: boolean;
}

export function RouteSelector({ value, onChange, routes, disabled }: RouteSelectorProps) {
  const sortedRoutes = [...routes].sort((a, b) => {
    const numA = parseInt(a);
    const numB = parseInt(b);
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA - numB;
    }
    return a.localeCompare(b);
  });

  return (
    <div className="flex items-center gap-2">
      <Route className="h-4 w-4 text-muted-foreground" />
      <Select value={value} onValueChange={onChange} disabled={disabled || routes.length === 0}>
        <SelectTrigger className="w-[120px] h-8 text-xs">
          <SelectValue placeholder="Γραμμή" />
        </SelectTrigger>
        <SelectContent className="max-h-[300px]">
          <SelectItem value="all">Όλες οι γραμμές</SelectItem>
          {sortedRoutes.map((route) => (
            <SelectItem key={route} value={route}>
              {route}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

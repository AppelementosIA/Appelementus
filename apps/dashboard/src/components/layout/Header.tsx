import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";

interface HeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function Header({ title, description, actions }: HeaderProps) {
  const { isPresentationMode } = useAuth();

  return (
    <header className="border-b bg-white/90 px-4 py-4 backdrop-blur lg:px-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {actions}
          <Badge variant="outline">WhatsApp - IA - envio</Badge>
          <Badge variant={isPresentationMode ? "info" : "success"}>
            {isPresentationMode ? "Modo apresentacao" : "Sessao operacional"}
          </Badge>
        </div>
      </div>
    </header>
  );
}

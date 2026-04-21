import type { ElementType } from "react";
import { Link } from "react-router-dom";
import { FileText, Image, Inbox, Send, Sparkles } from "lucide-react";
import {
  buildWorkflowHref,
  getWorkflowStageCounts,
  workflowStageMeta,
  workflowStageOrder,
  type WorkflowStage,
} from "@/data/workflow";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface FlowStageStripProps {
  activeStage: WorkflowStage;
  caseId?: string;
  reportId?: string;
}

const stageIcons = {
  entrada: Inbox,
  montagem: Sparkles,
  relatorio: FileText,
  imagens: Image,
  envio: Send,
} satisfies Record<WorkflowStage, ElementType>;

export function FlowStageStrip({ activeStage, caseId, reportId }: FlowStageStripProps) {
  const stageCounts = getWorkflowStageCounts();

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[860px] gap-3 lg:grid-cols-5">
        {workflowStageOrder.map((stage) => {
          const meta = workflowStageMeta[stage];
          const Icon = stageIcons[stage];
          const active = stage === activeStage;

          return (
            <Link
              key={stage}
              to={buildWorkflowHref(stage, { caseId, reportId })}
              className={cn(
                "rounded-2xl border bg-white p-4 transition-colors hover:border-elementus-blue/40 hover:bg-elementus-blue/5",
                active && "border-elementus-blue bg-elementus-blue/5 shadow-sm"
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted text-elementus-blue">
                  <Icon className="h-5 w-5" />
                </div>
                <Badge variant={active ? "info" : "outline"}>{stageCounts[stage]}</Badge>
              </div>
              <div className="mt-4">
                <p className="text-sm font-semibold">{meta.label}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {meta.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

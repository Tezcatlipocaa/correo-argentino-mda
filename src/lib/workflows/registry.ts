import type { WorkflowConfig } from "@/types/workflows";

export const WORKFLOWS_CATALOG: readonly WorkflowConfig[] = [
  {
    slug: "implementacion",
    name: "Implementación, Cambio y Release",
    description:
      "Proceso orquestado de despliegue, cambios en producción y pases a release con compuertas CAB.",
    viewId: 65,
    icon: "boxicons:git-repo-forked",
  },
] as const;

export function getWorkflowConfig(slug: string): WorkflowConfig | undefined {
  return WORKFLOWS_CATALOG.find((wf) => wf.slug === slug);
}

import { db } from "@db/index";
import { workflowStages } from "@db/schema";
import { eq } from "drizzle-orm";
import { createDeleteHandler } from "@lib/api/deleteHandler";

export const POST = createDeleteHandler({
  entityName: "etapa del workflow",
  redirectPath: "admin/automatizaciones/etapas",
  performDelete: async (id) => {
    const [deleted] = await db
      .delete(workflowStages)
      .where(eq(workflowStages.id, id))
      .returning({ id: workflowStages.id, name: workflowStages.name });
    return deleted ?? null;
  },
  successMessage: () => "Etapa eliminada con éxito.",
});

import { deleteWithSnapshot } from "@lib/deletedRecords";
import {
  offices,
  officeContacts,
  officeAssets,
  officeInvgateLinks,
} from "@db/schema";
import { createDeleteHandler } from "@lib/api/deleteHandler";
import { invalidateOfficeCaches } from "@lib/officeQueries";

export const POST = createDeleteHandler({
  entityName: "oficina",
  redirectPath: "oficinas",
  requiredFeature: "Administrar Contenido",
  genericSnapshot: false,
  performDelete: async (id, { username }) => {
    const res = await deleteWithSnapshot({
      entity: "oficina",
      recordId: id,
      username,
      label: (father) => `${father.name} (${father.code})`,
      fatherTable: offices,
      fatherPkColumn: offices.id,
      children: [
        { key: "officeContacts", table: officeContacts, fkColumn: officeContacts.officeId, fkProperty: "officeId" },
        { key: "officeAssets", table: officeAssets, fkColumn: officeAssets.officeId, fkProperty: "officeId" },
        { key: "officeInvgateLinks", table: officeInvgateLinks, fkColumn: officeInvgateLinks.officeId, fkProperty: "officeId" },
      ],
    });
    invalidateOfficeCaches();
    return res;
  },
  successMessage: (d) =>
    d
      ? `Oficina "${(d as any).name}" (${(d as any).code}) eliminada con éxito.`
      : "Oficina eliminada con éxito.",
  notFoundMessage: "La oficina no existe.",
  errorMessage: () => "Error al eliminar la oficina",
  logMessage: (d) =>
    `Eliminó la oficina "${(d as any)?.name}" (${(d as any)?.code})`,
});

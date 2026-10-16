import type { APIRoute } from "astro";
import { jsonResponse, jsonError } from "@lib/apiResponse";
import { requireReadAccess } from "@lib/rbac-middleware";
import { withLdapClient, getLdapUserErrorMessage } from "@lib/ldap";

const LICENSE_FILTER =
  "(&(objectClass=group)(|" +
  "(cn=*f3*)(cn=*e1*)(cn=*e3*)(cn=*kiosk*)(cn=*kiosko*)(cn=*o365*)(cn=*m365*)(cn=*licen*)(cn=*office*)" +
  "(description=*f3*)(description=*e1*)(description=*e3*)(description=*kiosk*)(description=*kiosko*)(description=*office*)" +
  "))";

interface AdGroupEntry {
  cn?: string;
  description?: string;
  distinguishedName?: string;
}

export const GET: APIRoute = async ({ locals }) => {
  const denied = await requireReadAccess(locals, "usuarios");
  if (denied) return denied;

  try {
    const groups = await withLdapClient(async (client, config) => {
      const entries: AdGroupEntry[] = [];

      await new Promise<void>((resolve, reject) => {
        client.search(
          config.baseDn,
          {
            filter: LICENSE_FILTER,
            scope: "sub" as const,
            attributes: ["cn", "description", "distinguishedName"],
          },
          (err, res) => {
            if (err) {
              reject(new Error(`Error en búsqueda LDAP: ${err.message}`));
              return;
            }
            res.on("searchEntry", (entry) => {
              const flat: Record<string, unknown> = {};
              for (const a of entry.pojo.attributes) {
                flat[a.type] = a.values.length === 1 ? a.values[0] : a.values;
              }
              entries.push(flat as AdGroupEntry);
            });
            res.on("error", (err2) => {
              reject(new Error(`Error en búsqueda LDAP: ${err2.message}`));
            });
            res.on("end", () => resolve());
          },
        );
      });

      return entries
        .map((e) => ({
          name: String(e.cn || ""),
          description:
            typeof e.description === "string" ? e.description : "",
          dn: String(e.distinguishedName || ""),
        }))
        .filter((g) => g.name)
        .sort((a, b) => a.name.localeCompare(b.name));
    });

    return jsonResponse({ total: groups.length, groups });
  } catch (error) {
    console.error("[AdGroupsLicenses] Error:", error);
    return jsonError(getLdapUserErrorMessage(error), 500);
  }
};

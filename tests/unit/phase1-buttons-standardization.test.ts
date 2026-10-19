import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Phase 1: Button Standardization, FormShell & UserCard (#324, #327, #332)", () => {
  const formShellPath = path.resolve(
    process.cwd(),
    "src/components/ui/FormShell.astro"
  );
  const userCardPath = path.resolve(
    process.cwd(),
    "src/components/UserCard.astro"
  );
  const directorioContentPath = path.resolve(
    process.cwd(),
    "src/components/offices/DirectorioContent.astro"
  );
  const formStandardDocPath = path.resolve(
    process.cwd(),
    "docs/FORM_STANDARD.md"
  );

  it("verifies FormShell.astro uses soft-danger (variant='soft' color='btn-error') for cancel button (#327)", () => {
    const content = fs.readFileSync(formShellPath, "utf-8");
    expect(content).toContain('label={cancelLabel}');
    expect(content).toContain('color="btn-error"');
    expect(content).toContain('variant="soft"');
    expect(content).not.toContain('color="btn-secondary"');
  });

  it("verifies all cancel/deny buttons in forms, sections and modals use soft-danger (#327)", () => {
    const filesToCheck = [
      "src/components/admin/invgate/UbicacionesContent.astro",
      "src/components/admin/users/AdminUsersContent.astro",
      "src/components/admin/users/UserCreateModal.astro",
      "src/components/buscador-usuarios/EditUserModal.astro",
      "src/components/cronograma/CronogramaDashboard.astro",
      "src/components/cronograma/subcomponents/HolidaysModal.astro",
      "src/components/cronograma/subcomponents/NewMonthModal.astro",
      "src/components/cronograma/subcomponents/OperatorFormModal.astro",
      "src/components/cronograma/subcomponents/RulesSettingsModal.astro",
      "src/components/offices/AgentsTicketModal.astro",
      "src/components/ui/DeleteCategoryModal.astro",
      "src/components/ui/modals/feedbackModal.astro",
      "src/pages/automatizaciones/_components/CloseAutomationModal.astro",
      "src/pages/automatizaciones/_components/EditManualDataModal.astro",
      "src/pages/profile.astro",
    ];

    for (const relPath of filesToCheck) {
      const fullPath = path.resolve(process.cwd(), relPath);
      const content = fs.readFileSync(fullPath, "utf-8");
      // Where label='Cancelar' is passed to ActionButton, it should have variant='soft' and color='btn-error'
      expect(content).toMatch(/<ActionButton[^>]*label="Cancelar"[^>]*\/>/s);
      const match = content.match(/<ActionButton[^>]*label="Cancelar"[^>]*\/>/s)?.[0] || "";
      expect(match).toContain('variant="soft"');
      expect(match).toContain('color="btn-error"');
    }
  });

  it("verifies UserCard.astro action buttons use variant='soft' (#332)", () => {
    const content = fs.readFileSync(userCardPath, "utf-8");
    const terminalBtn = content.match(/<ActionButton[^>]*icon="boxicons:terminal-filled"[^>]*\/>/s)?.[0] || "";
    const editBtn = content.match(/<ActionButton[^>]*icon="boxicons:pencil-filled"[^>]*\/>/s)?.[0] || "";
    const createTicketBtn = content.match(/<ActionButton[^>]*icon="boxicons:user-plus-filled"[^>]*\/>/s)?.[0] || "";

    expect(terminalBtn).toContain('variant="soft"');
    expect(editBtn).toContain('variant="soft"');
    expect(createTicketBtn).toContain('variant="soft"');
  });

  it("verifies DirectorioContent.astro export CSV ActionButton preserves label, download attribute and classes (#324)", () => {
    const content = fs.readFileSync(directorioContentPath, "utf-8");
    expect(content).toMatch(/id="export-csv-btn"[^>]*download/s);
    expect(content).toMatch(/id="export-csv-btn"[^>]*label="Exportar CSV"/s);
    expect(content).toMatch(/id="export-csv-btn"[^>]*font-semibold shadow-sm shrink-0/s);
  });

  it("verifies docs/FORM_STANDARD.md reflects variant='soft' color='btn-error' for cancel button doctrine (#327)", () => {
    const content = fs.readFileSync(formStandardDocPath, "utf-8");
    expect(content).toContain('variant="soft"');
    expect(content).toContain('color="btn-error"');
  });
});

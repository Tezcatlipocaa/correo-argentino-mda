export interface GroupLicenseInfo {
  description: string;
  recommendation: string;
}

export const GROUP_DESCRIPTIONS: Record<string, GroupLicenseInfo> = {
  F3: {
    description: "Apps básicas (habitualmente Outlook)",
    recommendation: "Instalar WPS Office",
  },
  E1: {
    description:
      "Office web (Word/Excel/PowerPoint online). Sin Office de escritorio",
    recommendation:
      "Instalar WPS Office si requieren suite local. Caso contrario, usar Office web",
  },
  Kiosko: {
    description: "Similar a F3 (habitualmente Outlook)",
    recommendation: "Instalar WPS Office",
  },
  E3: {
    description: "Office de escritorio (instalable en la PC)",
    recommendation:
      "Instalar Microsoft Office 365/Apps. WPS solo si hay motivo puntual y validado",
  },
};

export interface ModelCFamily {
  id: string;
  name: string;
  icon: string;
  description: string;
  systemsCount: number;
}

export interface HomonymMergerGroup {
  targetName: string;
  categoriesCount: number;
  absorbedCategories: Array<{ id?: number | string; name: string; tickets: number }>;
  totalTickets: number;
}

export interface ImmediateShortcut {
  name: string;
  tickets: number;
  immediatePercent: number;
  currentSelections: number;
  targetSelections: number;
}

export interface DeadNodesSummary {
  totalDeadNodes: number;
  deadLeaves: number;
  emptyBranches: number;
}

export interface ActionPlans {
  homonymMergers: HomonymMergerGroup[];
  deadNodesSummary: DeadNodesSummary;
  immediateShortcuts: ImmediateShortcut[];
}

export const MODEL_C_FAMILIES: ModelCFamily[] = [
  {
    id: "distribucion",
    name: "Aplicaciones de Distribucion",
    icon: "bx:bx-transfer-alt",
    description: "Sistemas operativos y logísticos de distribución (TYT, SOP, STS, escáneres operativos y Office Track NG).",
    systemsCount: 6,
  },
  {
    id: "comerciales",
    name: "Aplicaciones Comerciales",
    icon: "bx:bx-store",
    description: "Sistemas de atención comercial y sucursales (Mosaic, SOP Central, Sistema Central PAQ, Giros y Transferencias).",
    systemsCount: 4,
  },
  {
    id: "web-escritorio",
    name: "Aplicaciones Web y de Escritorio",
    icon: "bx:bx-globe",
    description: "Portales institucionales, ofimática y herramientas de puesto (Portal TI, WEB, W10, WPS Office, MidPoint, Mi Correo, EI, MFA).",
    systemsCount: 8,
  },
  {
    id: "administrativas",
    name: "Aplicaciones Administrativas",
    icon: "bx:bx-briefcase",
    description: "Gestión corporativa, financiera y telefonía IP (SAP, Netterm, OnBase, Mercado Pago, DTD, Denarius, SoftPhone).",
    systemsCount: 7,
  },
  {
    id: "impresion",
    name: "Impresion",
    icon: "bx:bx-printer",
    description: "Equipos y colas de impresión de todo tipo (general, láser, etiquetas y tickets).",
    systemsCount: 4,
  },
  {
    id: "equipos-trabajo",
    name: "Equipos de trabajo",
    icon: "bx:bx-desktop",
    description: "Hardware de puesto de trabajo y periféricos (PC, colector de datos, software base, periféricos, notebook, lectores).",
    systemsCount: 8,
  },
  {
    id: "moviles",
    name: "Moviles",
    icon: "bx:bx-mobile",
    description: "Dispositivos móviles y colectores de campo (Hand Held, celulares corporativos, tablets).",
    systemsCount: 3,
  },
  {
    id: "redes-telefonia",
    name: "Redes y Telefonia",
    icon: "bx:bx-network-chart",
    description: "Conectividad física y lógica, enlaces y telefonía fija (red local, telefonía fija, red de terminal).",
    systemsCount: 3,
  },
  {
    id: "entidades-externas",
    name: "Entidades externas",
    icon: "bx:bx-link-external",
    description: "Equipamiento y servicios provistos por terceros o convenios (Canal Directo, POS, turneros, Tecnomart).",
    systemsCount: 5,
  },
  {
    id: "edificios-traslados",
    name: "Edificios y traslados",
    icon: "bx:bx-building-house",
    description: "Infraestructura edilicia, servicios generales, traslados físicos y mudanzas.",
    systemsCount: 2,
  },
];

export const ACTION_PLANS: ActionPlans = {
  deadNodesSummary: {
    totalDeadNodes: 165,
    deadLeaves: 148,
    emptyBranches: 17,
  },
  immediateShortcuts: [
    {
      name: "Mosaic- Reimpresion de label",
      tickets: 567,
      immediatePercent: 80.4,
      currentSelections: 5,
      targetSelections: 3,
    },
    {
      name: "Consulta de uso",
      tickets: 398,
      immediatePercent: 80.9,
      currentSelections: 3,
      targetSelections: 3,
    },
    {
      name: "Mosaic- Consulta",
      tickets: 779,
      immediatePercent: 40.1,
      currentSelections: 5,
      targetSelections: 3,
    },
    {
      name: "TYT- Consulta",
      tickets: 509,
      immediatePercent: 58.3,
      currentSelections: 5,
      targetSelections: 3,
    },
    {
      name: "CC- Consulta",
      tickets: 347,
      immediatePercent: 74.1,
      currentSelections: 5,
      targetSelections: 3,
    },
    {
      name: "TYT- Re direccionamiento de impresiones",
      tickets: 267,
      immediatePercent: 94.4,
      currentSelections: 5,
      targetSelections: 3,
    },
    {
      name: "HOST (Demoras) No impactan tareas",
      tickets: 766,
      immediatePercent: 29.5,
      currentSelections: 5,
      targetSelections: 3,
    },
    {
      name: "Microsoft Outlook- Consulta",
      tickets: 290,
      immediatePercent: 72.1,
      currentSelections: 5,
      targetSelections: 3,
    },
    {
      name: "Solicitudes HH",
      tickets: 278,
      immediatePercent: 68.0,
      currentSelections: 3,
      targetSelections: 3,
    },
    {
      name: "TYT- Rehabilitar cola de impresión",
      tickets: 191,
      immediatePercent: 95.3,
      currentSelections: 5,
      targetSelections: 3,
    },
    {
      name: "GYT- Consulta",
      tickets: 168,
      immediatePercent: 65.2,
      currentSelections: 5,
      targetSelections: 3,
    },
    {
      name: "STS- Redireccionamiento de impresiones",
      tickets: 107,
      immediatePercent: 88.7,
      currentSelections: 5,
      targetSelections: 3,
    },
    {
      name: "Portal AG- Asistencia",
      tickets: 107,
      immediatePercent: 62.4,
      currentSelections: 5,
      targetSelections: 3,
    },
    {
      name: "W10- Configuracion de impresora a terminal",
      tickets: 101,
      immediatePercent: 55.4,
      currentSelections: 5,
      targetSelections: 3,
    },
    {
      name: "TYT- Desbloquear usuario de Host",
      tickets: 101,
      immediatePercent: 71.3,
      currentSelections: 5,
      targetSelections: 3,
    },
    {
      name: "Portal AG- Consulta",
      tickets: 93,
      immediatePercent: 69.8,
      currentSelections: 5,
      targetSelections: 3,
    },
    {
      name: "Configuración de Impresora Label",
      tickets: 82,
      immediatePercent: 58.5,
      currentSelections: 5,
      targetSelections: 3,
    },
    {
      name: "Sistema Central Paq- Consulta",
      tickets: 82,
      immediatePercent: 51.2,
      currentSelections: 5,
      targetSelections: 3,
    },
    {
      name: "TelegraphScan- Consulta",
      tickets: 70,
      immediatePercent: 64.3,
      currentSelections: 5,
      targetSelections: 3,
    },
  ],
  homonymMergers: [
    {
      targetName: "No actualiza las tablas del sistema",
      categoriesCount: 2,
      absorbedCategories: [
        { id: 687, name: "No actualiza tablas (STS)", tickets: 1 },
        { id: 657, name: "No actualiza tablas (TYT)", tickets: 1 },
      ],
      totalTickets: 2,
    },
    {
      targetName: "Reactivar una cola de impresion",
      categoriesCount: 3,
      absorbedCategories: [
        { id: 343, name: "TYT- Rehabilitar cola de impresión", tickets: 191 },
        { id: 1397, name: "Cola de impresión (STS)", tickets: 1 },
        { id: 270, name: "SAP- Rehabilitar cola de impresión", tickets: 1 },
      ],
      totalTickets: 193,
    },
    {
      targetName: "Reenviar la impresion a otra impresora",
      categoriesCount: 2,
      absorbedCategories: [
        { id: 342, name: "TYT- Re direccionamiento de impresiones", tickets: 267 },
        { id: 261, name: "STS- Redireccionamiento de impresiones", tickets: 107 },
      ],
      totalTickets: 374,
    },
    {
      targetName: "Configurar la impresora láser",
      categoriesCount: 5,
      absorbedCategories: [
        { id: 220, name: "Láser - Configurar impresora (Mosaic)", tickets: 49 },
        { id: 661, name: "Láser - Configurar impresora (TYT)", tickets: 40 },
        { id: 226, name: "Láser - Configuración (TGiros)", tickets: 37 },
        { id: 86, name: "Impresoras (GEN) - Configuración (Monte Grande)", tickets: 5 },
        { id: 2544, name: "Impresoras (GEN) - Configuración (Ed French)", tickets: 3 },
      ],
      totalTickets: 134,
    },
    {
      targetName: "Consultar el estado de la impresora láser",
      categoriesCount: 3,
      absorbedCategories: [
        { id: 217, name: "Láser- Consulta (Mosaic)", tickets: 25 },
        { id: 225, name: "Láser- Consulta (TGiros)", tickets: 25 },
        { id: 650, name: "Láser- Consulta (TYT)", tickets: 9 },
      ],
      totalTickets: 59,
    },
    {
      targetName: "Configurar la cola de impresion láser",
      categoriesCount: 2,
      absorbedCategories: [
        { id: 659, name: "Láser - Configurar cola de impresión (TYT)", tickets: 5 },
        { id: 221, name: "Láser - Configurar cola de impresión (Mosaic)", tickets: 3 },
      ],
      totalTickets: 8,
    },
    {
      targetName: "Configurar el escaner de la impresora láser",
      categoriesCount: 2,
      absorbedCategories: [
        { id: 219, name: "Láser - Configurar escaner (Mosaic)", tickets: 5 },
        { id: 660, name: "Láser - Configurar escaner (TYT)", tickets: 1 },
      ],
      totalTickets: 6,
    },
    {
      targetName: "Atasca las hojas (impresora láser)",
      categoriesCount: 2,
      absorbedCategories: [
        { id: 1387, name: "Láser - Atasca las hojas (TYT)", tickets: 5 },
        { id: 1393, name: "Atasca las hojas (STS)", tickets: 1 },
      ],
      totalTickets: 6,
    },
    {
      targetName: "No imprime (impresora láser)",
      categoriesCount: 4,
      absorbedCategories: [
        { id: 1392, name: "No imprime (STS)", tickets: 21 },
        { id: 1277, name: "Láser - No imprime (Mosaic)", tickets: 5 },
        { id: 1386, name: "Láser - No imprime (TYT)", tickets: 3 },
        { id: 1292, name: "Láser - No imprime (TGiros)", tickets: 1 },
      ],
      totalTickets: 30,
    },
    {
      targetName: "Imprime con manchas (impresora láser)",
      categoriesCount: 2,
      absorbedCategories: [
        { id: 1283, name: "Láser - Imprime con manchas (Mosaic)", tickets: 2 },
        { id: 1396, name: "Imprime con manchas (STS)", tickets: 1 },
      ],
      totalTickets: 3,
    },
    {
      targetName: "Impresora HP Lexmark no funciona",
      categoriesCount: 3,
      absorbedCategories: [
        { id: 691, name: "Impresoras laser HP LEXMARK (Monte Grande)", tickets: 27 },
        { id: 2555, name: "Impresoras laser HP LEXMARK (Tortuguitas)", tickets: 5 },
        { id: 2535, name: "Impresoras laser HP LEXMARK (Ed French)", tickets: 3 },
      ],
      totalTickets: 35,
    },
    {
      targetName: "Configurar la impresora de etiquetas",
      categoriesCount: 2,
      absorbedCategories: [
        { id: 2594, name: "Configuración de Impresora Label (Giros)", tickets: 82 },
        { id: 216, name: "Label - Configuración (Mosaic)", tickets: 41 },
      ],
      totalTickets: 123,
    },
    {
      targetName: "Configurar la impresora de tickets",
      categoriesCount: 2,
      absorbedCategories: [
        { id: 228, name: "Tickets - Configuración (TGiros)", tickets: 4 },
        { id: 176, name: "Tickets - Configuración (Mosaic)", tickets: 3 },
      ],
      totalTickets: 7,
    },
    {
      targetName: "Consultar el estado de la impresora de tickets",
      categoriesCount: 2,
      absorbedCategories: [
        { id: 174, name: "Tickets - Consulta (Mosaic)", tickets: 3 },
        { id: 227, name: "Tickets - Consulta (TGiros)", tickets: 2 },
      ],
      totalTickets: 5,
    },
    {
      targetName: "No imprime los tickets",
      categoriesCount: 2,
      absorbedCategories: [
        { id: 1295, name: "Tickets - No imprime (Mosaic)", tickets: 3 },
        { id: 1304, name: "Tickets - No imprime (TGiros)", tickets: 1 },
      ],
      totalTickets: 4,
    },
    {
      targetName: "Consulta sobre la PC",
      categoriesCount: 2,
      absorbedCategories: [
        { id: 590, name: "PC - Consulta (Mosaic)", tickets: 22 },
        { id: 631, name: "PC - Consulta (TGiros)", tickets: 13 },
      ],
      totalTickets: 35,
    },
    {
      targetName: "La PC no funciona",
      categoriesCount: 4,
      absorbedCategories: [
        { id: 2362, name: "PC - CPU (CDD)", tickets: 40 },
        { id: 74, name: "PC - CPU (Monte Grande)", tickets: 15 },
        { id: 2539, name: "PC - CPU (Ed French)", tickets: 7 },
        { id: 2559, name: "PC - CPU (Tortuguitas)", tickets: 2 },
      ],
      totalTickets: 64,
    },
    {
      targetName: "No enciende (PC)",
      categoriesCount: 4,
      absorbedCategories: [
        { id: 640, name: "PC - CPU - No enciende (TYT)", tickets: 9 },
        { id: 636, name: "PC - CPU - No enciende (TGiros)", tickets: 8 },
        { id: 677, name: "PC - CPU - No enciende (STS)", tickets: 6 },
        { id: 595, name: "PC - CPU - No enciende (Mosaic)", tickets: 4 },
      ],
      totalTickets: 27,
    },
    {
      targetName: "Funciona lento (PC)",
      categoriesCount: 4,
      absorbedCategories: [
        { id: 638, name: "PC - CPU - Funciona lento (TGiros)", tickets: 6 },
        { id: 642, name: "PC - CPU - Funciona lento (TYT)", tickets: 5 },
        { id: 597, name: "PC - CPU - Funciona lento (Mosaic)", tickets: 4 },
        { id: 679, name: "PC - CPU - Funciona lento (STS)", tickets: 2 },
      ],
      totalTickets: 17,
    },
    {
      targetName: "Quedo fuera del dominio (PC)",
      categoriesCount: 2,
      absorbedCategories: [
        { id: 635, name: "PC - Fuera de dominio (TGiros)", tickets: 4 },
        { id: 594, name: "PC - Fuera de dominio (Mosaic)", tickets: 1 },
      ],
      totalTickets: 5,
    },
    {
      targetName: "Colector de datos no funciona",
      categoriesCount: 2,
      absorbedCategories: [
        { id: 79, name: "Colector de Datos (Monte Grande)", tickets: 5 },
        { id: 2534, name: "Colector de Datos (Ed French)", tickets: 1 },
      ],
      totalTickets: 6,
    },
    {
      targetName: "Otro equipo roto o faltante",
      categoriesCount: 5,
      absorbedCategories: [
        { id: 2501, name: "Otro hardware (Mosaic)", tickets: 20 },
        { id: 2498, name: "Otro hardware (TGiros)", tickets: 20 },
        { id: 2489, name: "Otros equipos (Monte Grande)", tickets: 4 },
        { id: 2542, name: "Otros equipos (Ed French)", tickets: 1 },
        { id: 2562, name: "Otros equipos (Tortuguitas)", tickets: 1 },
      ],
      totalTickets: 46,
    },
    {
      targetName: "Configurar la terminal",
      categoriesCount: 2,
      absorbedCategories: [
        { id: 632, name: "PC - Configuración (TGiros)", tickets: 6 },
        { id: 591, name: "PC - Configuración (Mosaic)", tickets: 4 },
      ],
      totalTickets: 10,
    },
    {
      targetName: "Instalar el sistema operativo",
      categoriesCount: 2,
      absorbedCategories: [
        { id: 2546, name: "Sistema Operativo Instalacion (Ed French)", tickets: 4 },
        { id: 2566, name: "Sistema Operativo Instalacion (Tortuguitas)", tickets: 1 },
      ],
      totalTickets: 5,
    },
    {
      targetName: "Instalar otro software",
      categoriesCount: 3,
      absorbedCategories: [
        { id: 2483, name: "Otro SW (Monte Grande)", tickets: 3 },
        { id: 2547, name: "Otro SW (Ed French)", tickets: 3 },
        { id: 2567, name: "Otro SW (Tortuguitas)", tickets: 2 },
      ],
      totalTickets: 8,
    },
    {
      targetName: "Instalar Office",
      categoriesCount: 3,
      absorbedCategories: [
        { id: 2368, name: "Office (Terminal Administrativa)", tickets: 2 },
        { id: 2545, name: "Office - Instalacion (Ed French)", tickets: 1 },
        { id: 84, name: "Office - Instalacion (Monte Grande)", tickets: 1 },
      ],
      totalTickets: 4,
    },
    {
      targetName: "Actualizar el navegador",
      categoriesCount: 2,
      absorbedCategories: [
        { id: 608, name: "Chrome - Actualización (Mosaic)", tickets: 1 },
        { id: 46, name: "Chrome - Actualización (TGiros)", tickets: 1 },
      ],
      totalTickets: 2,
    },
    {
      targetName: "El teclado no funciona",
      categoriesCount: 5,
      absorbedCategories: [
        { id: 588, name: "Teclado - No funciona (Mosaic)", tickets: 9 },
        { id: 689, name: "Teclado (Monte Grande)", tickets: 3 },
        { id: 2363, name: "Teclado (Terminal Administrativa)", tickets: 3 },
        { id: 2577, name: "Teclado (Ed French)", tickets: 1 },
        { id: 683, name: "Teclado - No funciona (STS)", tickets: 1 },
      ],
      totalTickets: 17,
    },
    {
      targetName: "El mouse no funciona",
      categoriesCount: 5,
      absorbedCategories: [
        { id: 620, name: "Mouse - No funciona (TGiros)", tickets: 4 },
        { id: 589, name: "Mouse - No funciona (Mosaic)", tickets: 4 },
        { id: 2576, name: "Mouse (Ed French)", tickets: 1 },
        { id: 647, name: "Mouse - No funciona (TYT)", tickets: 1 },
        { id: 2364, name: "Mouse (Terminal Administrativa)", tickets: 1 },
      ],
      totalTickets: 11,
    },
    {
      targetName: "La notebook no funciona",
      categoriesCount: 4,
      absorbedCategories: [
        { id: 126, name: "Falla Notebook (Móviles)", tickets: 6 },
        { id: 2538, name: "Notebook (Ed French)", tickets: 6 },
        { id: 76, name: "Notebook (Monte Grande)", tickets: 3 },
        { id: 2558, name: "Notebook (Tortuguitas)", tickets: 1 },
      ],
      totalTickets: 16,
    },
    {
      targetName: "Pistola lectora no lee codigos de barra",
      categoriesCount: 2,
      absorbedCategories: [
        { id: 2500, name: "No lee código de barra (Mosaic)", tickets: 7 },
        { id: 654, name: "No lee códigos de barra (TYT)", tickets: 2 },
      ],
      totalTickets: 9,
    },
    {
      targetName: "Pistola lectora no enciende",
      categoriesCount: 2,
      absorbedCategories: [
        { id: 2499, name: "Pistola - No enciende (Mosaic)", tickets: 6 },
        { id: 623, name: "Pistola - No enciende (TGiros)", tickets: 2 },
      ],
      totalTickets: 8,
    },
    {
      targetName: "Monitor no enciende",
      categoriesCount: 2,
      absorbedCategories: [
        { id: 586, name: "Monitor - No enciende (Mosaic)", tickets: 6 },
        { id: 2537, name: "Monitor - No enciende (Ed French)", tickets: 2 },
      ],
      totalTickets: 8,
    },
    {
      targetName: "Puerto de red bloqueado",
      categoriesCount: 3,
      absorbedCategories: [
        { id: 102, name: "Puerto bloqueado (OPS)", tickets: 9 },
        { id: 89, name: "Puerto bloqueado (Monte Grande)", tickets: 2 },
        { id: 2569, name: "Puerto bloqueado (Tortuguitas)", tickets: 1 },
      ],
      totalTickets: 12,
    },
    {
      targetName: "Otro problema de red",
      categoriesCount: 2,
      absorbedCategories: [
        { id: 2551, name: "Otro (Ed French)", tickets: 4 },
        { id: 2482, name: "Otro (Monte Grande)", tickets: 1 },
      ],
      totalTickets: 5,
    },
  ],
};

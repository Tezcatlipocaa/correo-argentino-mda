export interface MdaReportHeroKpi {
  value: string;
  label: string;
}

export interface MdaReportHero {
  eyebrow: string;
  title: string;
  subtitle: string;
  methodology: string;
  kpis: MdaReportHeroKpi[];
}

export interface MdaReportWeakPoint {
  point: string;
  magnitude: string;
  measurement: string;
  userImpact: string;
}

export interface MdaReportParetoRow {
  range: string;
  leaves: number;
  catalogPercent: string;
  tickets: number;
  volumePercent: string;
  coverage: string;
}

export interface MdaReportUsageBracket {
  bracket: string;
  leaves: number;
}

export interface MdaReportMonthlyVolume {
  month: string;
  tickets: number;
}

export interface MdaReportClosureTimeframe {
  timeframe: string;
  tickets: number;
  volumePercent: string;
  cumulativePercent: string;
  coverage: string;
}

export interface MdaReportImmediateLeaf {
  leaf: string;
  tickets: number;
  selections: number;
  closesUnder15MinPercent: string;
}

export interface MdaReportLongCycleLeaf {
  leaf: string;
  tickets?: number;
  closesUnder15MinPercent: string;
  resolutionMedian: string;
}

export interface MdaReportComparativeIndicator {
  indicator: string;
  today: string;
  propuestaA: string;
  propuestaB: string;
  propuestaC: string;
}

export interface MdaReportApplicationAction {
  action: string;
  scope: string;
  ticketsToMove: string;
  observation: string;
}

export interface MdaReportMethodologyHypothesis {
  hypothesis: string;
  resolutionTime: string;
  reality: string;
}

export interface MdaReportDecisionSummaryItem {
  today: string;
  withPropuestaC: string;
}

export interface MdaReportData {
  hero: MdaReportHero;
  section1: {
    title: string;
    description: string;
    weakPoints: MdaReportWeakPoint[];
  };
  section2: {
    title: string;
    description: string;
    pareto: MdaReportParetoRow[];
    usageDistribution: MdaReportUsageBracket[];
    monthlyVolume: MdaReportMonthlyVolume[];
  };
  section3: {
    title: string;
    description: string;
    closureTimes: MdaReportClosureTimeframe[];
    immediateLeaves: MdaReportImmediateLeaf[];
    longCycleLeaves: MdaReportLongCycleLeaf[];
  };
  section4: {
    title: string;
    description: string;
    indicators: MdaReportComparativeIndicator[];
    rawTable: string[][];
  };
  section5: {
    title: string;
    actions: MdaReportApplicationAction[];
  };
  section6: {
    title: string;
    description: string;
    hypotheses: MdaReportMethodologyHypothesis[];
  };
  section7: {
    title: string;
    balance: MdaReportDecisionSummaryItem[];
  };
}

function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    const val = (obj as Record<string, unknown>)[key];
    if (val !== null && typeof val === "object" && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }
  return obj;
}

export const MDA_TI_REPORT_DATA: MdaReportData = deepFreeze({
  hero: {
    eyebrow: "Mesa de Ayuda TI · Informe para dirección",
    title: "Rediseño del árbol de categorías",
    subtitle:
      "86.300 incidentes de producción (21-11-2025 a 29-09-2026), con foco en la rama Mesa de Ayuda TI: 11.875 tickets, 13,8% del portal. Objetivo: que una persona no técnica ubique su categoría rápido, sin crear categorías nuevas.",
    methodology:
      "Método: árbol leído por API de InvGate (2.884 categorías, 13 raíces) y cruce con las 11.875 incidencias de la rama. Los 10 meses cubren toda la historia del portal: registro más antiguo del 21-11-2025 y movimiento todos los meses, sin huecos.",
    kpis: [
      {
        value: "52%",
        label: "de los nodos nunca recibió un ticket (377 de 719)",
      },
      {
        value: "4,71",
        label: "selecciones para llegar a una categoría",
      },
      {
        value: "46%",
        label: "del volumen se cierra en 15 minutos o menos",
      },
      {
        value: "0",
        label: "tickets que hay que mover en la etapa sin riesgo",
      },
    ],
  },
  section1: {
    title: "1. Radiografía: dónde duele hoy",
    description:
      "Ocho números del árbol actual, todos medidos sobre el cruce entre categorías e incidencias.",
    weakPoints: [
      {
        point: "Desperdicio estructural",
        magnitude: "377 de 719 nodos (52%)",
        measurement: "Subárbol completo en 0 tickets",
        userImpact: "Opciones que no llevan a ningún lado",
      },
      {
        point: "Hojas muertas",
        magnitude: "150",
        measurement: "Hojas con 0 tickets",
        userImpact: "Aparecen en el desplegable como cualquier otra",
      },
      {
        point: "Ramas vacías",
        magnitude: "227",
        measurement: "Intermedios con subárbol entero en 0",
        userImpact: "Nadie las atravesó nunca",
      },
      {
        point: "Profundidad excesiva",
        magnitude: "hasta 7 selecciones promedio 4,71",
        measurement: "Profundidad de cada hoja, ponderada por volumen",
        userImpact: "A la 4ª o 5ª el usuario abandona y llama",
      },
      {
        point: "Redundancia de nombres",
        magnitude: "72 hojas",
        measurement: "Hojas que repiten el nombre de su padre",
        userImpact: '"Mosaic > Consulta > Mosaic - Consulta": cuál elegir',
      },
      {
        point: "Niveles genéricos",
        magnitude: '12 "Consulta" 13 "Fallas"',
        measurement: "Intermedios con verbo comodín",
        userImpact: "Un clic extra para lo mismo",
      },
      {
        point: "Nodos de un solo hijo",
        magnitude: "39",
        measurement: "Intermedios con un único descendiente",
        userImpact: "Clic puro, sin decisión real",
      },
      {
        point: "Anomalías estructurales",
        magnitude: "2",
        measurement: "Intermedios con tickets propios",
        userImpact: "Rompen el modelo y confunden el reporte",
      },
      {
        point: "Concentración extrema",
        magnitude: "16 hojas = 50%",
        measurement: "Hojas necesarias para acumular la mitad del volumen",
        userImpact: "16 hojas cargan medio volumen entre 474 vacías",
      },
      {
        point: "Lenguaje de sistema",
        magnitude: "casos verificados",
        measurement:
          "Nombres que describen el sistema, no el problema del usuario",
        userImpact:
          '"Hace mucho riuido", "No inica Giros", "Nettern- Error de conexión", "Craddle", "Error 40020": tipeo y jerga interna',
      },
    ],
  },
  section2: {
    title:
      "2. La demanda está concentrada: pocas categorías hacen todo el trabajo",
    description:
      "Si el uso se concentra, el rediseño puede enfocarse en el tramo que importa y retirar el resto sin costo operativo.",
    pareto: [
      {
        range: "top 5 hojas",
        leaves: 5,
        catalogPercent: "1,0%",
        tickets: 2980,
        volumePercent: "25,2%",
        coverage: "25%",
      },
      {
        range: "top 10 hojas",
        leaves: 10,
        catalogPercent: "2,0%",
        tickets: 4645,
        volumePercent: "39,2%",
        coverage: "39%",
      },
      {
        range: "top 20 hojas",
        leaves: 20,
        catalogPercent: "4,1%",
        tickets: 6635,
        volumePercent: "56,0%",
        coverage: "56%",
      },
      {
        range: "top 50 hojas",
        leaves: 50,
        catalogPercent: "10,2%",
        tickets: 9308,
        volumePercent: "78,6%",
        coverage: "79%",
      },
      {
        range: "las 440 hojas restantes",
        leaves: 440,
        catalogPercent: "89,8%",
        tickets: 2567,
        volumePercent: "21,4%",
        coverage: "21%",
      },
    ],
    usageDistribution: [
      { bracket: "0 tickets en 10 meses", leaves: 150 },
      { bracket: "1 a 9 tickets", leaves: 214 },
      { bracket: "10 a 49 tickets", leaves: 74 },
      { bracket: "50 a 199 tickets", leaves: 39 },
      { bracket: "200 tickets o más", leaves: 13 },
    ],
    monthlyVolume: [
      { month: "nov-2025 (desde el 21)", tickets: 486 },
      { month: "dic-2025", tickets: 1574 },
      { month: "ene-2026", tickets: 1316 },
      { month: "feb-2026", tickets: 751 },
      { month: "mar-2026", tickets: 1148 },
      { month: "abr-2026", tickets: 726 },
      { month: "may-2026", tickets: 975 },
      { month: "jun-2026", tickets: 1074 },
      { month: "jul-2026", tickets: 1500 },
      { month: "ago-2026", tickets: 1253 },
      { month: "sep-2026", tickets: 1072 },
    ],
  },
  section3: {
    title: "3. Casi la mitad del volumen se cierra en el acto",
    description:
      "Qué tipo de trabajo entra por la rama: el tiempo entre creación y cierre muestra que la mayor parte no es resolución, sino gestión inmediata del operador.",
    closureTimes: [
      {
        timeframe: "1 minuto o menos",
        tickets: 4432,
        volumePercent: "37,3%",
        cumulativePercent: "37,3%",
        coverage: "37%",
      },
      {
        timeframe: "de 1 a 5 minutos",
        tickets: 622,
        volumePercent: "5,2%",
        cumulativePercent: "42,6%",
        coverage: "5%",
      },
      {
        timeframe: "de 5 a 15 minutos",
        tickets: 438,
        volumePercent: "3,7%",
        cumulativePercent: "46,2%",
        coverage: "4%",
      },
      {
        timeframe: "de 15 minutos a 1 hora",
        tickets: 1087,
        volumePercent: "9,2%",
        cumulativePercent: "55,4%",
        coverage: "9%",
      },
      {
        timeframe: "más de 1 hora",
        tickets: 4084,
        volumePercent: "34,4%",
        cumulativePercent: "89,8%",
        coverage: "34%",
      },
      {
        timeframe: "sin cerrar",
        tickets: 1212,
        volumePercent: "10,2%",
        cumulativePercent: "100%",
        coverage: "10%",
      },
    ],
    immediateLeaves: [
      {
        leaf: "Mosaic- Reimpresion de label",
        tickets: 548,
        selections: 5,
        closesUnder15MinPercent: "81,6%",
      },
      {
        leaf: "Consulta de uso",
        tickets: 381,
        selections: 3,
        closesUnder15MinPercent: "83,2%",
      },
      {
        leaf: "TYT- Re direccionamiento de impresiones",
        tickets: 255,
        selections: 5,
        closesUnder15MinPercent: "94,9%",
      },
      {
        leaf: "TYT- Rehabilitar cola de impresión",
        tickets: 184,
        selections: 5,
        closesUnder15MinPercent: "95,1%",
      },
      {
        leaf: "Mosaic- Configuracion de Unidad W",
        tickets: 178,
        selections: 5,
        closesUnder15MinPercent: "93,3%",
      },
      {
        leaf: "Servicio Energético",
        tickets: 146,
        selections: 3,
        closesUnder15MinPercent: "95,9%",
      },
      {
        leaf: "Sop Central- Link de acceso",
        tickets: 133,
        selections: 4,
        closesUnder15MinPercent: "87,2%",
      },
      {
        leaf: "Portal AG- Asistencia",
        tickets: 106,
        selections: 5,
        closesUnder15MinPercent: "90,6%",
      },
      {
        leaf: "STS- Redireccionamiento de impresiones",
        tickets: 104,
        selections: 5,
        closesUnder15MinPercent: "93,3%",
      },
      {
        leaf: "Usuario no habilitado",
        tickets: 98,
        selections: 5,
        closesUnder15MinPercent: "85,7%",
      },
    ],
    longCycleLeaves: [
      {
        leaf: "Solicitud de Toner",
        tickets: 158,
        closesUnder15MinPercent: "1,3%",
        resolutionMedian: "138,5 h",
      },
      {
        leaf: "Solicitud de Técnico",
        tickets: 85,
        closesUnder15MinPercent: "1,2%",
        resolutionMedian: "90,1 h",
      },
      {
        leaf: "POS Problema de hardware",
        tickets: 36,
        closesUnder15MinPercent: "0%",
        resolutionMedian: "131,6 h",
      },
      {
        leaf: "Turneros y TVs Mediterránea",
        tickets: 29,
        closesUnder15MinPercent: "0%",
        resolutionMedian: "43,1 h",
      },
      {
        leaf: "Total trabajo de ciclo largo",
        tickets: 308,
        closesUnder15MinPercent: "—",
        resolutionMedian: "2,6% de la rama",
      },
    ],
  },
  section4: {
    title: "4. Tres formas de reordenar, medidas contra el árbol actual",
    description:
      "Los tres modelos usan las mismas 340 hojas vivas. Se diferencian en el primer nivel, que es donde el usuario decide.",
    indicators: [
      {
        indicator: "Nodos totales (hoy 719)",
        today: "719",
        propuestaA: "453",
        propuestaB: "392",
        propuestaC: "402",
      },
      {
        indicator: "Opciones en la primera pantalla",
        today: "11 ramas",
        propuestaA: "5 intenciones",
        propuestaB: "52 sistemas",
        propuestaC: "10 familias",
      },
      {
        indicator: "Máximo de opciones en una misma pantalla",
        today: "11",
        propuestaA: "42",
        propuestaB: "56",
        propuestaC: "28",
      },
      {
        indicator: "Selecciones para llegar a la hoja (máximo)",
        today: "7",
        propuestaA: "3",
        propuestaB: "2",
        propuestaC: "3",
      },
      {
        indicator: "Selecciones promedio, ponderado por tickets",
        today: "4,71",
        propuestaA: "3,00",
        propuestaB: "2,00",
        propuestaC: "3,00",
      },
      {
        indicator: "Tickets que llegan en 2 selecciones o menos",
        today: "209 (1,8%)",
        propuestaA: "0",
        propuestaB: "11.875 (100%)",
        propuestaC: "0",
      },
      {
        indicator: "Tickets que llegan en 3 selecciones o menos",
        today: "1.539 (13%)",
        propuestaA: "11.875 (100%)",
        propuestaB: "11.875 (100%)",
        propuestaC: "11.875 (100%)",
      },
      {
        indicator: "Tickets que exigen 6 selecciones o más",
        today: "552 (4,6%)",
        propuestaA: "0",
        propuestaB: "0",
        propuestaC: "0",
      },
      {
        indicator: "Hojas",
        today: "490",
        propuestaA: "340",
        propuestaB: "340",
        propuestaC: "340",
      },
      {
        indicator: "Hojas sin un solo ticket",
        today: "150",
        propuestaA: "150",
        propuestaB: "150",
        propuestaC: "150",
      },
      {
        indicator: "Hojas que repiten el nombre de su padre",
        today: "72",
        propuestaA: "0",
        propuestaB: "0",
        propuestaC: "0",
      },
      {
        indicator: "Nodos intermedios con un solo hijo",
        today: "39",
        propuestaA: "0",
        propuestaB: "0",
        propuestaC: "0",
      },
      {
        indicator: "Nodos intermedios con tickets propios",
        today: "2",
        propuestaA: "0",
        propuestaB: "0",
        propuestaC: "0",
      },
      {
        indicator: "Categorías con el mismo nombre bajo el mismo padre",
        today: "0",
        propuestaA: "64",
        propuestaB: "64",
        propuestaC: "64",
      },
      {
        indicator: "Sistemas que necesitan dos padres a la vez",
        today: "0",
        propuestaA: "36 no implementable",
        propuestaB: "0",
        propuestaC: "0",
      },
    ],
    rawTable: [
      ["Indicador", "Hoy", "Propuestas"],
      [
        "A · intención consultar / falla / cambio",
        "B · sistema elegir el sistema",
        "C · híbrida familia > sistema",
      ],
      ["Nodos totales (hoy 719)", "719", "453", "392", "402"],
      [
        "Opciones en la primera pantalla",
        "11 ramas",
        "5 intenciones",
        "52 sistemas",
        "10 familias",
      ],
      ["Máximo de opciones en una misma pantalla", "11", "42", "56", "28"],
      ["Selecciones para llegar a la hoja (máximo)", "7", "3", "2", "3"],
      [
        "Selecciones promedio, ponderado por tickets",
        "4,71",
        "3,00",
        "2,00",
        "3,00",
      ],
      [
        "Tickets que llegan en 2 selecciones o menos",
        "209 (1,8%)",
        "0",
        "11.875 (100%)",
        "0",
      ],
      [
        "Tickets que llegan en 3 selecciones o menos",
        "1.539 (13%)",
        "11.875 (100%)",
        "11.875 (100%)",
        "11.875 (100%)",
      ],
      ["Tickets que exigen 6 selecciones o más", "552 (4,6%)", "0", "0", "0"],
      ["Hojas", "490", "340", "340", "340"],
      ["Hojas sin un solo ticket", "150", "150", "150", "150"],
      ["Hojas que repiten el nombre de su padre", "72", "0", "0", "0"],
      ["Nodos intermedios con un solo hijo", "39", "0", "0", "0"],
      ["Nodos intermedios con tickets propios", "2", "0", "0", "0"],
      [
        "Categorías con el mismo nombre bajo el mismo padre",
        "0",
        "64",
        "64",
        "64",
      ],
      [
        "Sistemas que necesitan dos padres a la vez",
        "0",
        "36 no implementable",
        "0",
        "0",
      ],
    ],
  },
  section5: {
    title: "5. Qué hace falta para aplicarlo, y qué no",
    actions: [
      {
        action: "Reparentar para armar las 10 familias y los 52 sistemas",
        scope: "340 hojas + 62 intermedios",
        ticketsToMove: "0",
        observation: "Cambia padre y nombre. Los tickets siguen donde están.",
      },
      {
        action: "Retirar ramas y hojas vacías",
        scope: "377 nodos",
        ticketsToMove: "0",
        observation: "Nunca recibieron tickets: no hay nada que reasignar.",
      },
      {
        action: "Fusionar hojas homónimas",
        scope: "64 categorías en 35 grupos",
        ticketsToMove: "1.265 (10,6% de la rama)",
        observation:
          "Única parte que exige reasignar tickets cerrados. Fuera de alcance hoy: quedan conviviendo, con el registro de fusión para cuando se pueda.",
      },
      {
        action: "Crear categorías nuevas",
        scope: "0",
        ticketsToMove: "0",
        observation: "El modelo se construye solo con categorías existentes.",
      },
    ],
  },
  section6: {
    title: "6. Dónde el rediseño NO ayuda: advertencia metodológica",
    description: "Para que el número no se use mal: qué no muestran los datos.",
    hypotheses: [
      {
        hypothesis: '"Las categorías más profundas tardan más en resolverse"',
        resolutionTime: "5 selecciones o menos: 106,4 h 6 o más: 38,1 h",
        reality:
          "Falso, y al revés. Las profundas resuelven más rápido: son atajos del propio operador (reimpresión de etiqueta, desbloqueo de usuario). Las poco profundas son trabajo real, de días.",
      },
      {
        hypothesis: '"Menos categorías = mejores tiempos"',
        resolutionTime: "—",
        reality:
          "No medible. El tiempo depende del tipo de caso, no del árbol.",
      },
    ],
  },
  section7: {
    title: "7. Resumen para la decisión",
    balance: [
      {
        today: "719 nodos, más de la mitad sin usar",
        withPropuestaC: "402 nodos, todos con función",
      },
      {
        today: "4,71 selecciones promedio, hasta 7",
        withPropuestaC: "3 selecciones fijas",
      },
      {
        today: "Primera pantalla de 11 ramas sin lógica de usuario",
        withPropuestaC: "10 familias reconocibles",
      },
      {
        today: "72 hojas repiten el nombre de su padre",
        withPropuestaC: "0",
      },
      {
        today: "39 nodos intermedios de un solo hijo",
        withPropuestaC: "0",
      },
      {
        today: "377 nodos que nunca recibieron un ticket",
        withPropuestaC: "retirados",
      },
      {
        today: "36 sistemas imposibles de ubicar sin duplicar",
        withPropuestaC: "0 conflictos estructurales",
      },
      {
        today:
          "2.547 tickets de cierre inmediato (21,4%) repartidos a 3, 4 y 5 selecciones",
        withPropuestaC: "todos a 3 selecciones",
      },
    ],
  },
});

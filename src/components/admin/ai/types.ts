export interface ChatMessage {
  id: string;
  sender: "assistant" | "user";
  text: string;
  timestamp: Date;
}

export interface QuickPrompt {
  id: string;
  label: string;
  query: string;
  response: string;
  iconName: "office" | "automations" | "capabilities";
}

export const INITIAL_QUICK_PROMPTS: QuickPrompt[] = [
  {
    id: "offices",
    label: "Estado de oficinas",
    query: "¿Cuál es el estado de las oficinas y regiones?",
    response:
      "Actualmente hay 5 regiones con sincronización activa. Podés revisar el detalle completo en el [Directorio](/oficinas) y en la vista de [Estructura de red](/oficinas/estructura).",
    iconName: "office",
  },
  {
    id: "automations",
    label: "Automatizaciones",
    query: "¿Cómo consultar las automatizaciones?",
    response:
      "El módulo de [Automatizaciones](/automatizaciones) cuenta con métricas de ejecuciones y procesos de tareas programadas operativas.",
    iconName: "automations",
  },
  {
    id: "capabilities",
    label: "¿Qué funciones tendrás?",
    query: "¿Qué funciones tendrás cuando estés listo?",
    response:
      "En próximas etapas podré consultar [Inventario de terminales](/inventario-terminales), generar [Métricas](/reportes), buscar tickets en InvGate y ejecutar scripts de administración.",
    iconName: "capabilities",
  },
];

export const INITIAL_GREETING: ChatMessage = {
  id: "greeting",
  sender: "assistant",
  text: "¡Hola! Soy Referente. ¿En qué te puedo ayudar hoy?",
  timestamp: new Date(),
};

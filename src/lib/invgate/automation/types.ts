/**
 * Shape de comentario validado empíricamente contra QA (bulk /incidents?comments=1,
 * ticket 317) y producción (hijo 77181): message trae HTML escapado,
 * created_at en epoch (segundos). customer_visible llega como 0/1 numérico
 * en producción (el tipo relaja boolean/number).
 *
 * is_solution: el endpoint dedicado GET /incident.comment la devuelve siempre
 * (validado en producción 2026-09, ticket 77765: msg_num=1 → true); el bulk
 * /incidents?comments=1 la omite (undefined). Por eso es opcional.
 */
export interface InvgateComment {
  id: number;
  incident_id: number;
  author_id: number;
  message: string;
  created_at: number;
  customer_visible: number | boolean;
  reference: string | null;
  msg_num: number;
  is_solution?: boolean;
  attached_files: unknown[];
}

/**
 * Incidente de InvGate consumido por el módulo de automatizaciones.
 * Tipos scoped del módulo: NO extiende InvgateIncident de @types/invgate
 * (consumido por otros módulos con shapes distintos, p.ej. closed_reason/rating).
 */
export interface InvgateAutomationIncident {
  id: number;
  pretty_id: string;
  title: string;
  description: string;
  created_at: number;
  last_update: number;
  date_ocurred: number;
  solved_at: number | null;
  closed_at: number | null;
  closed_reason: number | null;
  user_id: number;
  creator_id: number;
  source_id: number;
  type_id: number;
  category_id: number;
  status_id: number;
  priority_id: number;
  assigned_group_id: number | null;
  assigned_id: number | null;
  location_id: number | null;
  process_id?: number;
  data_cleaned?: unknown;
  rating: number | null;
  attachments: number[];
  custom_fields: Record<string, unknown>[];
  sla_incident_resolution: string | null;
  sla_incident_first_reply: string | null;
  request_customer_sentiment_initial: string | null;
  request_customer_sentiment_current: string | null;
  /** Presente solo cuando el bulk se solicita con comments=1. */
  comments?: InvgateComment[];
}

/**
 * Envelope de GET /incidents validado con el ticket real 317:
 * la API responde un objeto indexado por ID de incidente, no un array.
 */
export type InvgateIncidentsByIdResponse = Record<
  string,
  InvgateAutomationIncident
>;

/**
 * Shape validado con el ticket real 317: GET /incident.link devuelve
 * array plano de { id, title } sin más campos.
 */
export interface InvgateIncidentLink {
  id: number;
  title: string;
}

/**
 * Shape según documentación oficial (pendiente validar contra respuesta
 * no vacía; con la sucursal 317 la respuesta fue []).
 */
export interface InvgateIncidentTask {
  task_id: number;
  name: string;
  description: string;
  status: number;
  created_at: number;
  expiration_date: number | null;
  completed_at: number | null;
  assignment_type: number | null;
  agent_id: number | null;
  helpdesk_id: number | null;
  is_predefined: boolean;
  is_required: boolean;
  linked_request_id: number | null;
  wf_stage_id: string | null;
}

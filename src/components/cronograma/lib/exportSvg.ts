import { OperatorStatus, type OperatorData } from "./types";

export interface ExportSvgInput {
  monthLabel: string;
  dates: string[];
  operators: Array<Pick<OperatorData, "nombre" | "location" | "asistencia" | "comentarios">>;
}

export interface ExportSvgResult {
  svg: string;
  width: number;
  height: number;
}

export const CELL_W = 40;
export const NAME_W = 220;
export const ROW_H = 34;
export const HEADER_H = 46;
export const TITLE_H = 46;
export const LEGEND_H = 44;
export const PAD = 16;

export const STATUS_FILL: Record<OperatorStatus, { bg: string; text: string }> = {
  [OperatorStatus.PresencialMonteGrande]: { bg: "#fff8e6", text: "#b25e00" },
  [OperatorStatus.PresencialParquePatricios]: { bg: "#f3e8ff", text: "#7e22ce" },
  [OperatorStatus.HomeOffice]: { bg: "#e8effe", text: "#254888" },
  [OperatorStatus.Licencia]: { bg: "#fde8e8", text: "#e02424" },
  [OperatorStatus.Vacaciones]: { bg: "#def7ec", text: "#03543f" },
  [OperatorStatus.Franco]: { bg: "#f8f9fa", text: "#333333" },
};

export const STATUS_LABEL: Record<OperatorStatus, string> = {
  [OperatorStatus.PresencialMonteGrande]: "Presencial Monte Grande",
  [OperatorStatus.PresencialParquePatricios]: "Presencial Parque Patricios",
  [OperatorStatus.HomeOffice]: "Home Office",
  [OperatorStatus.Licencia]: "Licencia",
  [OperatorStatus.Vacaciones]: "Vacaciones",
  [OperatorStatus.Franco]: "Franco",
};

export const STATUS_INITIAL: Record<OperatorStatus, string> = {
  [OperatorStatus.PresencialMonteGrande]: "MG",
  [OperatorStatus.PresencialParquePatricios]: "PP",
  [OperatorStatus.HomeOffice]: "HO",
  [OperatorStatus.Licencia]: "L",
  [OperatorStatus.Vacaciones]: "V",
  [OperatorStatus.Franco]: "",
};

const FONT = "Arial, Helvetica, sans-serif";
const WEEKDAY_INITIALS = ["D", "L", "M", "M", "J", "V", "S"];

export function escapeXml(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

function textEl(value: string, attrs: string): string {
  return `<text ${attrs}>${escapeXml(value)}</text>`;
}

export function buildCronogramaSvg(input: ExportSvgInput): ExportSvgResult {
  const { monthLabel, dates, operators } = input;
  const width = PAD * 2 + NAME_W + dates.length * CELL_W;
  const height = PAD * 2 + TITLE_H + HEADER_H + operators.length * ROW_H + LEGEND_H;
  const gridTop = PAD + TITLE_H;
  const bodyTop = gridTop + HEADER_H;
  const body: string[] = [];

  body.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"/>`);
  body.push(
    textEl(`Cronograma — ${monthLabel}`, `x="${PAD}" y="${PAD + 26}" font-size="20" font-weight="bold" fill="#111827"`),
  );

  body.push(`<rect x="${PAD}" y="${gridTop}" width="${NAME_W}" height="${HEADER_H}" fill="#f3f4f6" stroke="#e5e7eb"/>`);
  body.push(
    textEl("Operador", `x="${PAD + 10}" y="${gridTop + 28}" font-size="12" font-weight="bold" fill="#374151"`),
  );

  dates.forEach((date, i) => {
    const x = PAD + NAME_W + i * CELL_W;
    const day = String(Number(date.slice(8, 10)));
    const weekday = WEEKDAY_INITIALS[new Date(`${date}T12:00:00`).getDay()];
    body.push(`<rect x="${x}" y="${gridTop}" width="${CELL_W}" height="${HEADER_H}" fill="#f3f4f6" stroke="#e5e7eb"/>`);
    body.push(
      textEl(day, `x="${x + CELL_W / 2}" y="${gridTop + 20}" font-size="12" font-weight="bold" fill="#374151" text-anchor="middle"`),
    );
    body.push(
      textEl(weekday, `x="${x + CELL_W / 2}" y="${gridTop + 35}" font-size="9" fill="#6b7280" text-anchor="middle"`),
    );
  });

  operators.forEach((op, r) => {
    const y = bodyTop + r * ROW_H;
    const rowBg = r % 2 === 0 ? "#ffffff" : "#fafafa";
    body.push(`<rect x="${PAD}" y="${y}" width="${NAME_W}" height="${ROW_H}" fill="${rowBg}" stroke="#e5e7eb"/>`);
    body.push(
      textEl(truncate(op.nombre, 26), `x="${PAD + 10}" y="${y + 14}" font-size="12" fill="#111827"`),
    );
    body.push(
      textEl(truncate(op.location ?? "", 32), `x="${PAD + 10}" y="${y + 27}" font-size="9" fill="#6b7280"`),
    );

    dates.forEach((date, i) => {
      const x = PAD + NAME_W + i * CELL_W;
      const status = op.asistencia?.[date] ?? OperatorStatus.Franco;
      const fill = STATUS_FILL[status] ?? STATUS_FILL[OperatorStatus.Franco];
      body.push(`<rect x="${x}" y="${y}" width="${CELL_W}" height="${ROW_H}" fill="${fill.bg}" stroke="#e5e7eb"/>`);
      const initial = STATUS_INITIAL[status];
      if (initial) {
        body.push(
          textEl(initial, `x="${x + CELL_W / 2}" y="${y + ROW_H / 2 + 4}" font-size="11" font-weight="bold" fill="${fill.text}" text-anchor="middle"`),
        );
      }
      if (op.comentarios?.[date]) {
        body.push(`<circle class="note-dot" cx="${x + CELL_W - 6}" cy="${y + 6}" r="3" fill="#e02424"/>`);
      }
    });
  });

  const legendY = bodyTop + operators.length * ROW_H + 26;
  Object.values(OperatorStatus).forEach((status, i) => {
    const x = PAD + i * 200;
    body.push(
      `<rect x="${x}" y="${legendY - 9}" width="10" height="10" rx="2" fill="${STATUS_FILL[status].bg}" stroke="#d1d5db"/>`,
    );
    body.push(
      textEl(STATUS_LABEL[status], `x="${x + 16}" y="${legendY}" font-size="11" fill="#374151"`),
    );
  });

  return {
    width,
    height,
    svg: `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${FONT}">${body.join("")}</svg>`,
  };
}

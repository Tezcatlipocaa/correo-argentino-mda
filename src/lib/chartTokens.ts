export interface ChartTokens {
  palette: string[];
  text: string;
  grid: string;
}

const PALETTE_VARS = [
  "--color-primary",
  "--color-secondary",
  "--color-accent",
  "--color-info",
  "--color-success",
  "--color-warning",
  "--color-error",
  "--color-neutral",
] as const;

const FALLBACK = "#6b7280";

export function readChartTokens(
  getVar: (name: string) => string,
): ChartTokens {
  const read = (name: string): string => {
    const value = (getVar(name) ?? "").trim();
    return value.length > 0 ? value : FALLBACK;
  };
  return {
    palette: PALETTE_VARS.map(read),
    text: read("--color-base-content"),
    grid: read("--color-base-300"),
  };
}

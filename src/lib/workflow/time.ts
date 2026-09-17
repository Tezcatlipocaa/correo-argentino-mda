/** Epoch actual en segundos, alineado a los timestamps de InvGate. */
export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

// Formato de dinero en euros a partir de céntimos (enteros).
export function money(cents: number): string {
  return (cents / 100).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

// "39,95" | "39.95" | "3995" -> céntimos
export function toCents(input: string): number {
  const n = parseFloat(input.replace(',', '.').replace(/[^0-9.]/g, ''));
  return Math.round((isNaN(n) ? 0 : n) * 100);
}

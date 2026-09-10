// Dia civil no fuso de Brasília (America/Sao_Paulo), sem hardcode de -3:
// o offset é lido do próprio Intl para essa data.

const TZ = 'America/Sao_Paulo';

/** "YYYY-MM-DD" do dia civil em Brasília para o instante dado. */
export function brtDayString(date: Date): string {
  // en-CA formata como 2026-03-10
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Offset do fuso em ms nesse instante (local = utc + offset). */
function tzOffsetMs(date: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);

  const m: Record<string, string> = {};
  for (const p of parts) m[p.type] = p.value;

  const asUtc = Date.UTC(
    Number(m.year),
    Number(m.month) - 1,
    Number(m.day),
    Number(m.hour),
    Number(m.minute),
    Number(m.second),
  );
  return asUtc - date.getTime();
}

/** Instante UTC da meia-noite civil de Brasília do dia "YYYY-MM-DD". */
function brtMidnightUtc(dayString: string): Date {
  const [y, mo, d] = dayString.split('-').map(Number);
  // Chute: a parede 00:00 lida como se fosse UTC.
  const wall = Date.UTC(y, mo - 1, d, 0, 0, 0);
  // local = utc + offset  =>  utc = wall - offset
  let utc = wall - tzOffsetMs(new Date(wall));
  // Reajuste único caso o offset mude perto da fronteira (DST).
  utc = wall - tzOffsetMs(new Date(utc));
  return new Date(utc);
}

/**
 * Limites UTC (semiaberto) do dia civil de Brasília:
 * `start <= createdAt < end`.
 */
export function brtDayRange(dayString: string): { start: Date; end: Date } {
  const start = brtMidnightUtc(dayString);
  const [y, mo, d] = dayString.split('-').map(Number);
  const nextWall = new Date(Date.UTC(y, mo - 1, d + 1));
  const next = `${nextWall.getUTCFullYear()}-${String(nextWall.getUTCMonth() + 1).padStart(2, '0')}-${String(
    nextWall.getUTCDate(),
  ).padStart(2, '0')}`;
  return { start, end: brtMidnightUtc(next) };
}

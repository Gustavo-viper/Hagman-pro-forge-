/** Minimal structured JSON logger (one line per event; Railway parses JSON logs). */
type Level = 'debug' | 'info' | 'warn' | 'error';

export function log(level: Level, message: string, fields: Record<string, unknown> = {}): void {
  const line = JSON.stringify({ level, time: new Date().toISOString(), service: 'fandom-worker', message, ...fields });
  if (level === 'error' || level === 'warn') console.error(line);
  else console.log(line);
}

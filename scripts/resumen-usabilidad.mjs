// #28 (EC-01, MC-E4): resume la prueba de usabilidad del registro de un precio.
// Uso: node scripts/resumen-usabilidad.mjs docs/calidad/usabilidad-resultados.csv
import { readFileSync } from 'node:fs';

const [file] = process.argv.slice(2);
if (!file) {
  process.stderr.write('Uso: node scripts/resumen-usabilidad.mjs <archivo.csv>\n');
  process.exit(1);
}

const [header, ...lines] = readFileSync(file, 'utf-8')
  .split(/\r?\n/)
  .filter((line) => line.trim() !== '');
const columns = header.split(',');
const rows = lines.map((line) =>
  Object.fromEntries(line.split(',').map((value, at) => [columns[at], value.trim()])),
);

if (rows.length === 0) {
  process.stdout.write('Todavía no hay intentos en el archivo.\n');
  process.exit(0);
}

const finished = rows.filter((row) => row.terminado === 'si' || row.terminado === 'sí');
const fast = finished.filter((row) => Number(row.segundos) <= 15);
const seconds = finished.map((row) => Number(row.segundos)).sort((a, b) => a - b);
const median = seconds.length === 0 ? 0 : seconds[Math.floor((seconds.length - 1) / 2)];

// SUS: impares (respuesta − 1), pares (5 − respuesta); la suma por 2,5 da un puntaje de 0 a 100.
const susOf = (row) => {
  const answers = Array.from({ length: 10 }, (_, at) => Number(row[`sus${String(at + 1)}`]));
  if (answers.some((answer) => !(answer >= 1 && answer <= 5))) return null;
  const sum = answers.reduce(
    (total, answer, at) => total + (at % 2 === 0 ? answer - 1 : 5 - answer),
    0,
  );
  return sum * 2.5;
};
const sus = rows.map((row) => [row.participante, susOf(row)]).filter(([, score]) => score !== null);
const susAverage =
  sus.length === 0 ? 0 : sus.reduce((total, [, score]) => total + score, 0) / sus.length;

const percent = (part, whole) => (whole === 0 ? 0 : (part / whole) * 100);
const fastPercent = percent(fast.length, rows.length);
const effectiveness = percent(finished.length, rows.length);
const participants = new Set(rows.map((row) => row.participante)).size;
const mark = (ok) => (ok ? 'cumple' : 'NO cumple');

process.stdout.write(
  [
    `Participantes: ${String(participants)} (meta: 8 o más) → ${mark(participants >= 8)}`,
    `Intentos: ${String(rows.length)}`,
    `En 15 s o menos: ${fastPercent.toFixed(1)} % (meta: 80 %) → ${mark(fastPercent >= 80)}`,
    `Efectividad: ${effectiveness.toFixed(1)} % (meta: 90 %) → ${mark(effectiveness >= 90)}`,
    `Tiempo mediano de los terminados: ${String(median)} s`,
    `SUS por participante: ${sus.map(([who, score]) => `${who} ${score.toFixed(1)}`).join(', ') || '—'}`,
    `SUS promedio: ${susAverage.toFixed(1)} (meta: 68) → ${mark(susAverage >= 68)}`,
  ].join('\n') + '\n',
);

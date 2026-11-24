import { type SyntheticEvent, useState } from 'react';
import { api, call } from '../../shared/api';
import type { operations } from '../../shared/api/schema';

type Report = operations['bulkOfficialPrices']['responses'][200]['content']['application/json'];
const MAX_BYTES = 1024 * 1024;
const CSV_HEADER = 'codigo_barras;precio';

function csvForRetry(original: string, errors: Report['errors']) {
  const distributed = original.split(/\r?\n/);
  const excluded = new Set(errors.map(({ row }) => row));
  const rows = distributed.filter((_, index) => excluded.has(index + 1));
  // Los valores rechazados no deben convertirse en fórmulas cuando se abre el CSV en Excel.
  const safeRows = rows.map((line) =>
    line
      .split(';')
      .slice(0, 2)
      .map((cell) => (/^[\s]*[=+@-]/.test(cell) ? `'${cell}` : cell))
      .join(';'),
  );
  return [CSV_HEADER, ...safeRows, ''].join('\r\n');
}

function readText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('No pudimos leer el archivo CSV.'));
    };
    reader.onerror = () => {
      reject(new Error('No pudimos leer el archivo CSV.'));
    };
    reader.readAsText(file);
  });
}

export function MerchantPriceUpload({
  disabled,
  onUpload,
}: {
  disabled: boolean;
  onUpload: (action: () => Promise<string>) => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [problem, setProblem] = useState('');
  const [report, setReport] = useState<{ outcome: Report; retryCsv: string } | null>(null);

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    if (!file || disabled) return;
    setProblem('');
    setReport(null);
    if (file.size > MAX_BYTES) {
      setProblem('El archivo debe pesar 1 MB o menos.');
      return;
    }
    void onUpload(async () => {
      const text = await readText(file);
      const outcome = await call(
        api.POST('/commerce/prices/bulk', {
          body: text,
          headers: { 'Content-Type': 'text/csv; charset=utf-8' },
          bodySerializer: () => text,
        }),
      );
      setReport({ outcome, retryCsv: csvForRetry(text, outcome.errors) });
      return `Filas publicadas: ${String(outcome.published)}.`;
    });
  };

  return (
    <>
      <form className="merchant-price-form" onSubmit={submit}>
        <p id="csv-format" className="muted">
          CSV UTF-8 de hasta 1.000 filas y 1 MB. Usa el encabezado <code>{CSV_HEADER}</code> y
          precios enteros sin puntos.
        </p>
        <label className="field">
          Archivo CSV
          <input
            type="file"
            accept=".csv,text/csv"
            aria-describedby="csv-format"
            disabled={disabled}
            onChange={(event) => {
              setFile(event.currentTarget.files?.[0] ?? null);
              setProblem('');
            }}
          />
        </label>
        {problem && (
          <p className="banner warn" role="alert">
            {problem}
          </p>
        )}
        <button type="submit" className="btn" disabled={!file || disabled}>
          Cargar precios
        </button>
      </form>
      {report && report.outcome.inReview.length > 0 && (
        <div className="merchant-price-form">
          <h3>
            {report.outcome.inReview.length === 1
              ? '1 fila quedó en revisión'
              : `${String(report.outcome.inReview.length)} filas quedaron en revisión`}
          </h3>
          <p className="muted">
            No había con qué comparar estos precios: un moderador los verá antes de publicarlos.
          </p>
          <ul className="merchant-price-list">
            {report.outcome.inReview.map(({ row, barcode }) => (
              <li key={row}>
                <p>
                  <strong>Fila {row}</strong> · {barcode}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
      {report && report.outcome.errors.length > 0 && (
        <div className="merchant-price-form">
          <h3>Filas con errores</h3>
          <ul className="merchant-price-list">
            {report.outcome.errors.map(({ row, barcode, message }) => (
              <li key={row}>
                <p>
                  <strong>Fila {row}</strong>
                  {barcode && ` · ${barcode}`}
                </p>
                <p>{message}</p>
              </li>
            ))}
          </ul>
          <a
            className="btn ghost"
            href={`data:text/csv;charset=utf-8,${encodeURIComponent(report.retryCsv)}`}
            download="precios-por-corregir.csv"
          >
            Descargar filas con errores
          </a>
        </div>
      )}
    </>
  );
}

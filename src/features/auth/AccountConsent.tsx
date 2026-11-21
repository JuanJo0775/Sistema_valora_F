import { Link } from 'react-router';
import { POLICY_VERSION } from '../legal/policy';
import { Field } from './Field';

// B#133: el nombre con el que la app saluda. Lo comparten el registro y /bienvenida (F#154).
export function NameField({
  value,
  onValue,
  error,
}: {
  value: string;
  onValue: (value: string) => void;
  error: string | undefined;
}) {
  return (
    <>
      <Field
        label="Tu nombre"
        autoComplete="given-name"
        maxLength={40}
        value={value}
        onValue={onValue}
        aria-describedby="nombre-privado"
        error={error}
      />
      <p id="nombre-privado" className="muted">
        Solo tú lo ves. Nunca se publica.
      </p>
    </>
  );
}

// RF-001 y Ley 1581: el aviso de privacidad y el consentimiento expreso, iguales en el registro y en
// /bienvenida (quien entró con Google). Sin la casilla marcada no se crea la cuenta.
export function PolicyConsent({
  accepted,
  onAccepted,
  error,
}: {
  accepted: boolean;
  onAccepted: (accepted: boolean) => void;
  error: string | undefined;
}) {
  return (
    <>
      <p className="muted" id="aviso-privacidad">
        Aviso de privacidad: usamos tu correo y tu nombre solo para tu cuenta y tus aportes. No
        publicamos tus datos ni los usamos para publicidad. Puedes conocerlos, corregirlos, pedir su
        supresión o revocar tu autorización cuando quieras.
      </p>
      <label className="check">
        <input
          type="checkbox"
          checked={accepted}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'error-politica' : undefined}
          onChange={(event) => {
            onAccepted(event.target.checked);
          }}
        />
        <span>
          Acepto la{' '}
          <Link to="/privacidad" target="_blank" rel="noopener">
            política de tratamiento de datos
          </Link>{' '}
          (versión {POLICY_VERSION}).
        </span>
      </label>
      {error && (
        <p id="error-politica" role="alert" className="field-error">
          {error}
        </p>
      )}
    </>
  );
}

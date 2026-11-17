import type { components } from '../../shared/api/schema';
import { formatPresentation } from './presentation';

type Presentation = components['schemas']['Product']['presentations'][number];

// Las presentaciones de un producto como fichas para elegir una (registro y canasta).
export function PresentationChoices({
  presentations,
  value,
  onChange,
}: {
  presentations: Presentation[];
  value: string;
  onChange: (presentationId: string) => void;
}) {
  return (
    <fieldset role="radiogroup" className="choices">
      <legend>Presentación</legend>
      {presentations.map((presentation) => (
        <label key={presentation.id} className="choice">
          <input
            type="radio"
            name="presentation"
            value={presentation.id}
            checked={value === presentation.id}
            onChange={() => {
              onChange(presentation.id);
            }}
          />
          {formatPresentation(presentation)}
        </label>
      ))}
    </fieldset>
  );
}

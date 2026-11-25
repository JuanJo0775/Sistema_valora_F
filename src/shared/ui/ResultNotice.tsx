import type { Ref } from 'react';

// Aviso del resultado de una acción, junto a ella. El párrafo está desde antes (región viva vacía)
// para que el lector de pantalla anuncie el texto al llegar; solo es `status` cuando tiene mensaje,
// así nunca hay dos a la vez.
export function ResultNotice({ text, ref }: { text: string; ref?: Ref<HTMLParagraphElement> }) {
  return (
    <p
      ref={ref}
      role={text ? 'status' : undefined}
      aria-live="polite"
      tabIndex={-1}
      className={text ? 'banner' : 'sr-only'}
    >
      {text}
    </p>
  );
}

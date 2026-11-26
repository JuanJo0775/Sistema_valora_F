import { PushPanel } from './PushPanel';
import { usePush } from './usePush';

// La pantalla de avisos push de «Yo» para moderadores y comercios (RF-020, RN3 y RN7).
export function AvisosPush() {
  const { status, busy, error, platform, enable, disable } = usePush();
  return (
    <PushPanel
      status={status}
      busy={busy}
      error={error}
      platform={platform}
      onEnable={enable}
      onDisable={disable}
    />
  );
}

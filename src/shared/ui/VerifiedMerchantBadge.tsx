import { ShieldCheckIcon } from './ShieldCheckIcon';

// La tienda tiene un comercio verificado por moderación. Lleva icono y texto: el sentido no depende
// solo del color (misma regla que OfficialBadge).
export function VerifiedMerchantBadge() {
  return (
    <span className="pill official">
      <ShieldCheckIcon />
      Comercio verificado
    </span>
  );
}

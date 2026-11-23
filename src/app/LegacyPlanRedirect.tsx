import { Navigate, useLocation } from 'react-router';

// /canasta/plan era la pantalla del plan de compra; ahora todo vive en /canasta. «#mis-planes» era la
// lista de planes guardados: ahora es la pestaña «Guardadas».
export function LegacyPlanRedirect() {
  const { hash } = useLocation();
  return <Navigate replace to={hash === '#mis-planes' ? '/canasta?tab=guardadas' : '/canasta'} />;
}

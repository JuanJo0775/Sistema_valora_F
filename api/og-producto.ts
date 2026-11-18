// Vista previa de /productos/:id para los rastreadores de enlaces (WhatsApp, Facebook, X, Telegram,
// LinkedIn). Ellos no ejecutan JavaScript: ven solo el HTML que llega. vercel.json les manda esta
// función (solo a ellos, por su User-Agent) y devuelve una página mínima con el nombre del producto.
// Las personas siguen recibiendo la app de siempre. Si la API tarda o falla, devuelve la vista
// previa general de Valora: compartir nunca queda sin vista previa.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Los rastreadores esperan poco: pasado este tiempo se usa la vista previa general.
const API_TIMEOUT_MS = 3500;

interface ProductPreview {
  name: string;
  brand?: string | null;
  presentations?: { quantity: number; unit: string; packCount?: number }[];
}

export const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (char) => `&#${String(char.charCodeAt(0))};`);

function describePresentation({
  quantity,
  unit,
  packCount = 1,
}: NonNullable<ProductPreview['presentations']>[number]): string {
  const size = `${String(quantity)} ${unit}`;
  return packCount > 1 ? `${String(packCount)} x ${size}` : size;
}

export function previewOf(product: ProductPreview | null): { title: string; description: string } {
  if (!product?.name) {
    return {
      title: 'Valora: compara precios de tu barrio',
      description:
        'Precios de tiendas de barrio, minimercados y supermercados de Armenia y el Quindío, reportados por la gente.',
    };
  }
  const name = [product.name, product.brand].filter(Boolean).join(' ');
  const sizes = (product.presentations ?? []).slice(0, 4).map(describePresentation);
  const forms = sizes.length > 0 ? ` (${sizes.join(', ')})` : '';
  return {
    title: `${name}: compara precios en Valora`,
    description: `Mira dónde está más barato ${name}${forms} en tiendas de barrio, minimercados y supermercados de Armenia y el Quindío.`,
  };
}

export function renderPreviewHtml(origin: string, path: string, product: ProductPreview | null) {
  const { title, description } = previewOf(product);
  const url = `${origin}${path}`;
  const image = `${origin}/og-image.png`;
  const [t, d, u, i] = [
    escapeHtml(title),
    escapeHtml(description),
    escapeHtml(url),
    escapeHtml(image),
  ];
  return `<!doctype html>
<html lang="es-CO">
<head>
<meta charset="UTF-8" />
<title>${t}</title>
<meta name="description" content="${d}" />
<link rel="canonical" href="${u}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Valora" />
<meta property="og:locale" content="es_CO" />
<meta property="og:title" content="${t}" />
<meta property="og:description" content="${d}" />
<meta property="og:url" content="${u}" />
<meta property="og:image" content="${i}" />
<meta property="og:image:type" content="image/png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="Logo de Valora: compara precios de tu barrio" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${t}" />
<meta name="twitter:description" content="${d}" />
<meta name="twitter:image" content="${i}" />
</head>
<body><a href="${u}">${t}</a></body>
</html>
`;
}

async function loadProduct(origin: string, id: string): Promise<ProductPreview | null> {
  try {
    const response = await fetch(`${origin}/v1/products/${id}`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
    return response.ok ? ((await response.json()) as ProductPreview) : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const id = url.searchParams.get('id') ?? '';
  // El origen sale de la petición: sirve igual con el dominio de Vercel que con el propio.
  const host = request.headers.get('x-forwarded-host') ?? url.host;
  const origin = `https://${host}`;
  const valid = UUID.test(id);
  const product = valid ? await loadProduct(origin, id) : null;
  return new Response(renderPreviewHtml(origin, valid ? `/productos/${id}` : '/', product), {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // Los precios no salen aquí, solo el nombre: se puede guardar un rato en el borde de Vercel.
      'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}

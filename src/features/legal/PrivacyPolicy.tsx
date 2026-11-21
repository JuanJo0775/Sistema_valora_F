import { Link } from 'react-router';
import { POLICY_EFFECTIVE, POLICY_VERSION } from './policy';
import './legal.css';
import { BackLink } from '../../shared/ui/BackLink';

// Política de tratamiento de datos personales y aviso de cookies. Cubre lo que exige el artículo 13 del
// Decreto 1377 de 2013 (compilado en el Decreto 1074 de 2015): responsable, tratamiento y finalidad,
// derechos, área de peticiones, procedimiento y vigencia. Redactada con apoyo de IA (Claude Code); el
// equipo debe revisarla antes de abrir el sistema al público (docs/privacidad.md del backend).
export function PrivacyPolicy() {
  return (
    <article className="legal">
      <BackLink fallback="/yo" />
      <h1>Política de tratamiento de datos y cookies</h1>
      <p className="muted">
        Versión {POLICY_VERSION} · vigente desde el {POLICY_EFFECTIVE}
      </p>

      <nav aria-label="Contenido de la política" className="legal-index">
        <a href="#responsable">1. Responsable</a>
        <a href="#datos">2. Datos y finalidades</a>
        <a href="#ubicacion">3. Ubicación</a>
        <a href="#cookies">4. Cookies y almacenamiento</a>
        <a href="#terceros">5. Terceros y transferencias</a>
        <a href="#derechos">6. Tus derechos</a>
        <a href="#procedimiento">7. Cómo ejercerlos</a>
        <a href="#seguridad">8. Seguridad y conservación</a>
        <a href="#menores">9. Menores de edad</a>
        <a href="#cambios">10. Vigencia y cambios</a>
      </nav>

      <section aria-labelledby="responsable">
        <h2 id="responsable">1. Responsable del tratamiento</h2>
        <p>
          Valora es un proyecto académico (Proyecto Nuclear VI: Arquitectura de Software II y
          Modelos de Calidad). El responsable del tratamiento es el equipo del proyecto Valora, en
          Armenia, Quindío (Colombia). Para cualquier petición, consulta o reclamo sobre tus datos
          usa el canal de contacto del proyecto indicado en su repositorio de GitHub
          (JuanJo0775/Sistema_valora_B).
        </p>
        <p>
          Esta política se rige por la Ley 1581 de 2012 (protección de datos personales), el Decreto
          1074 de 2015 (que compiló el Decreto 1377 de 2013) y las normas que los modifiquen.
        </p>
      </section>

      <section aria-labelledby="datos">
        <h2 id="datos">2. Qué datos tratamos y para qué</h2>
        <table>
          <caption className="sr-only">Datos personales y su finalidad</caption>
          <thead>
            <tr>
              <th scope="col">Dato</th>
              <th scope="col">Finalidad</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Correo electrónico</th>
              <td>Crear tu cuenta e iniciar sesión.</td>
            </tr>
            <tr>
              <th scope="row">Nombre que escribes</th>
              <td>Saludarte en tu propia sesión. Solo tú lo ves; nunca se publica.</td>
            </tr>
            <tr>
              <th scope="row">Contraseña</th>
              <td>
                Iniciar sesión. Solo guardamos una huella cifrada (argon2id), nunca la contraseña.
              </td>
            </tr>
            <tr>
              <th scope="row">Versión y fecha de esta política que aceptaste</th>
              <td>Dejar constancia de tu autorización.</td>
            </tr>
            <tr>
              <th scope="row">Tus aportes de precios y su identificador interno</th>
              <td>
                Evitar duplicados y abuso, calcular la confiabilidad de los reportes y moderar. En
                la aplicación pública los precios aparecen sin tu nombre ni tu correo.
              </td>
            </tr>
            <tr>
              <th scope="row">Clave seudónima de reportante</th>
              <td>
                Reputación, marcas y suspensiones sin identificarte ante otras personas ni ante el
                comercio.
              </td>
            </tr>
          </tbody>
        </table>
        <p>
          No tratamos datos sensibles (salud, origen étnico, orientación política o religiosa,
          biométricos) ni datos de menores. No vendemos tus datos ni los usamos para publicidad ni
          para perfilarte comercialmente. Tampoco guardamos tu dirección IP ni el navegador que
          usas: no hay registro de peticiones.
        </p>
        <p>
          Al crear la cuenta nos autorizas de forma previa, expresa e informada para este
          tratamiento. Para comparar precios y ver el mapa no necesitas cuenta ni nos das ningún
          dato.
        </p>
      </section>

      <section aria-labelledby="ubicacion">
        <h2 id="ubicacion">3. Tu ubicación</h2>
        <p>
          Si pulsas «Usar mi ubicación», el navegador te pide permiso y la usamos solo en ese
          momento para mostrar tiendas y precios cercanos.{' '}
          <strong>No guardamos tu ubicación</strong> ni la asociamos a tu cuenta o a tus reportes.
          Puedes negar el permiso y elegir el municipio.
        </p>
      </section>

      <section aria-labelledby="cookies">
        <h2 id="cookies">4. Cookies y almacenamiento en tu dispositivo</h2>
        <p>
          Valora usa solo lo estrictamente necesario para funcionar. No usamos cookies de analítica,
          de publicidad ni de seguimiento, ni de terceros.
        </p>
        <table>
          <caption className="sr-only">Cookies y almacenamiento local</caption>
          <thead>
            <tr>
              <th scope="col">Qué</th>
              <th scope="col">Para qué</th>
              <th scope="col">Cuánto dura</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Cookie de sesión (HttpOnly)</th>
              <td>Mantener tu sesión iniciada.</td>
              <td>Hasta que cierres sesión o venza.</td>
            </tr>
            <tr>
              <th scope="row">Cookie de protección CSRF</th>
              <td>Evitar que otro sitio actúe en tu nombre.</td>
              <td>La de tu sesión.</td>
            </tr>
            <tr>
              <th scope="row">Almacenamiento local</th>
              <td>
                Recordar tus preferencias: municipio, radio, tema claro u oscuro, si usas tu
                ubicación, la canasta y este aviso.
              </td>
              <td>Hasta que lo borres del navegador.</td>
            </tr>
            <tr>
              <th scope="row">IndexedDB y caché de la app</th>
              <td>Guardar reportes cuando no hay conexión y abrir la app sin red.</td>
              <td>Hasta que se envíen o los borres.</td>
            </tr>
          </tbody>
        </table>
        <p>
          Como son necesarias, no requieren tu aceptación; te avisamos con el aviso de la parte
          inferior. Puedes borrarlas desde los ajustes de tu navegador, pero la sesión y el modo sin
          conexión dejarán de funcionar.
        </p>
      </section>

      <section aria-labelledby="terceros">
        <h2 id="terceros">5. Terceros y transferencias</h2>
        <p>
          Para operar usamos proveedores que tratan datos por encargo nuestro y bajo nuestras
          instrucciones: Vercel (aplicación web), Render (servidor de la API) y Neon (base de
          datos), con servidores en Estados Unidos, y Supabase (fotos de productos, sin datos
          personales). Esa transmisión es necesaria para prestar el servicio y la aceptas al
          autorizar esta política. Los mapas se piden a OpenStreetMap y las fotos de algunos
          productos a Open Food Facts: tu navegador se conecta con ellos para descargarlos, y pueden
          ver tu dirección IP.
        </p>
        <p>
          Google es un proveedor de identidad opcional: solo interviene si eliges «Continuar con
          Google». En ese caso recibimos tu identificador de Google, tu correo y tu nombre, para
          crear o abrir tu cuenta. Si no usas Google, no recibimos nada de él. Google trata tus
          datos según su propia política:{' '}
          <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
            policies.google.com/privacy
          </a>
          .
        </p>
        <p>No entregamos tus datos a otras personas, salvo orden de autoridad competente.</p>
      </section>

      <section aria-labelledby="derechos">
        <h2 id="derechos">6. Tus derechos como titular</h2>
        <ul>
          <li>Conocer, actualizar y rectificar tus datos.</li>
          <li>Solicitar prueba de la autorización que diste.</li>
          <li>Ser informado, a petición tuya, del uso que se ha dado a tus datos.</li>
          <li>
            Presentar quejas ante la Superintendencia de Industria y Comercio (SIC) por infracciones
            a la ley, después de haber agotado el trámite de consulta o reclamo ante nosotros.
          </li>
          <li>Revocar la autorización y solicitar la supresión de tus datos.</li>
          <li>Acceder de forma gratuita a tus datos personales.</li>
        </ul>
      </section>

      <section aria-labelledby="procedimiento">
        <h2 id="procedimiento">7. Cómo ejercer tus derechos</h2>
        <p>
          Escribe al canal de contacto del proyecto (sección 1) indicando tu nombre, el correo de tu
          cuenta y qué pides. Responderemos así:
        </p>
        <ul>
          <li>
            <strong>Consultas:</strong> en un máximo de 10 días hábiles; si no podemos, te lo
            avisamos con el motivo y una nueva fecha, que no pasará de 5 días hábiles más.
          </li>
          <li>
            <strong>Reclamos</strong> (rectificar, actualizar, suprimir o revocar): en un máximo de
            15 días hábiles; si hace falta más tiempo, hasta 8 días hábiles más. Si el reclamo está
            incompleto, te pediremos lo que falta en 5 días.
          </li>
        </ul>
        <p>
          <strong>Eliminar tu cuenta desde la aplicación.</strong> Entra a Ajustes, abre «Opciones
          avanzadas» y elige «Eliminar mi cuenta». Tu cuenta queda programada para eliminarse a los
          10 días corridos y se cierran todas tus sesiones. En ese plazo puedes cambiar de opinión:
          inicia sesión con tu correo y tu contraseña y pulsa «Restaurar mi cuenta». Pasado el
          plazo, eliminamos de forma definitiva tu cuenta, tu correo, tu nombre, tu contraseña
          cifrada y tus sesiones.
        </p>
        <p>
          Los precios, propuestas y marcas que aportaste se conservan sin tu nombre ni tu correo y
          ya no se pueden vincular a ti: son información pública que la comunidad usa para comparar.
          También puedes pedir la supresión por el canal de contacto (sección 1). La supresión no
          procede mientras tengas un deber legal o contractual de permanecer en la base de datos.
        </p>
      </section>

      <section aria-labelledby="seguridad">
        <h2 id="seguridad">8. Seguridad y conservación</h2>
        <p>
          Protegemos tus datos con contraseñas cifradas, sesiones en cookies HttpOnly, conexión
          cifrada (HTTPS), datos personales separados del resto en la base y pruebas automáticas que
          verifican que ninguna respuesta pública traiga tu correo, tu identificador ni tu
          ubicación. Conservamos tus datos mientras tu cuenta esté activa y por el tiempo que dure
          el proyecto. Cuando eliminas tu cuenta, las copias de respaldo de la base de datos y los
          registros de envío de correo de nuestros proveedores pueden conservar tus datos por un
          plazo limitado, hasta que vence su retención, y no se usan para nada más. Ningún sistema
          es infalible; si ocurre un incidente que afecte tus datos, lo informaremos a la SIC y a
          los titulares afectados, como exige la ley.
        </p>
      </section>

      <section aria-labelledby="menores">
        <h2 id="menores">9. Menores de edad</h2>
        <p>
          Valora no está dirigida a menores de 18 años. Si eres menor, solo puedes crear una cuenta
          con la autorización de tu madre, padre o representante legal, que asume la responsabilidad
          de esta aceptación. No recopilamos datos de menores de forma intencional.
        </p>
      </section>

      <section aria-labelledby="cambios">
        <h2 id="cambios">10. Vigencia y cambios</h2>
        <p>
          Esta política rige desde el {POLICY_EFFECTIVE} y mientras exista la base de datos de
          Valora. Si la cambiamos de forma sustancial, subimos la versión y te pedimos aceptarla de
          nuevo.
        </p>
      </section>

      <p>
        <Link to="/crear-cuenta" className="btn ghost">
          Volver a crear la cuenta
        </Link>
      </p>
    </article>
  );
}

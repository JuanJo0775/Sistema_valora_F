import { useState } from 'react';
import { RadiusControl } from '../comparison/RadiusControl';
import { type Municipality, MUNICIPALITY_OPTIONS } from '../comparison/criteria';
import { readMunicipality, saveMunicipality } from '../comparison/lastMunicipality';
import { readRadius, saveRadius } from '../comparison/radius';
import { AdvancedOptions } from './AdvancedOptions';
import { NameSettings } from './NameSettings';
import { PasswordSettings } from './PasswordSettings';
import { useSession } from './session';
import { setPinShapes, usePinShapes } from '../stores/pinShapePref';
import { BackLink } from '../../shared/ui/BackLink';
import { SelectField } from '../../shared/ui/SelectField';
import { isUsabilityMode, setUsabilityMode } from '../../shared/usabilityMode';
import { SettingSwitch } from './SettingSwitch';
import { ThemeChoice } from './ThemeChoice';
import './auth.css';

// «Yo» › Ajustes: lo que se recuerda en este dispositivo. No pide cuenta.
export function Settings() {
  const [municipality, setMunicipality] = useState<Municipality>(readMunicipality);
  const [radiusKm, setRadiusKm] = useState(readRadius);
  const [testing, setTesting] = useState(isUsabilityMode);
  const pinShapes = usePinShapes();
  const { session } = useSession();
  return (
    <section className="profile">
      <div className="profile-top">
        <BackLink fallback="/yo" />
        <h1>Ajustes</h1>
      </div>
      <section className="profile-block" aria-labelledby="apariencia">
        <h2 id="apariencia" className="eyebrow">
          Apariencia
        </h2>
        <div className="profile-card profile-pad">
          <ThemeChoice />
        </div>
      </section>
      <section className="profile-block" aria-labelledby="accesibilidad">
        <h2 id="accesibilidad" className="eyebrow">
          Accesibilidad
        </h2>
        <ul className="settings-list profile-card">
          <SettingSwitch
            title="Distinguir los tipos de tienda por su forma"
            description="En el mapa, la leyenda y la lista, cada tipo suma una forma a su color: círculo, cuadrado redondeado, hexágono o estrella. Útil si te cuesta distinguir los colores."
            on={pinShapes}
            onChange={setPinShapes}
          />
        </ul>
      </section>
      <section className="profile-block" aria-labelledby="busqueda">
        <h2 id="busqueda" className="eyebrow">
          Búsqueda
        </h2>
        <div className="profile-card profile-pad">
          <SelectField
            label="Municipio"
            value={municipality}
            options={MUNICIPALITY_OPTIONS}
            onChange={(chosen) => {
              saveMunicipality(chosen);
              setMunicipality(chosen);
            }}
          />
          <RadiusControl
            radiusKm={radiusKm}
            onChange={(km) => {
              saveRadius(km);
              setRadiusKm(km);
            }}
          />
        </div>
      </section>
      {session.status === 'active' && (
        <section className="profile-block" aria-labelledby="cuenta">
          <h2 id="cuenta" className="eyebrow">
            Cuenta
          </h2>
          <div className="profile-card profile-pad">
            <NameSettings />
          </div>
        </section>
      )}
      {session.status === 'active' && (
        <section className="profile-block" aria-labelledby="seguridad">
          <h2 id="seguridad" className="eyebrow">
            Seguridad
          </h2>
          <div className="profile-card profile-pad">
            <PasswordSettings />
          </div>
        </section>
      )}
      <section className="profile-block" aria-labelledby="pruebas">
        <h2 id="pruebas" className="eyebrow">
          Pruebas del equipo
        </h2>
        <ul className="settings-list profile-card">
          {/* #28: solo para la prueba de usabilidad; se quita al cerrar la #28. */}
          <SettingSwitch
            title="Modo prueba de usabilidad"
            description="Muestra el cronómetro al registrar (EC-01). Es solo para pruebas con personas."
            on={testing}
            onChange={(on) => {
              setUsabilityMode(on);
              setTesting(on);
            }}
          />
        </ul>
      </section>
      <AdvancedOptions />
    </section>
  );
}

import { useState } from 'react';
import { Link } from 'react-router';
import { RadiusChips } from '../comparison/RadiusChips';
import { type Municipality, MUNICIPALITY_OPTIONS } from '../comparison/criteria';
import { readMunicipality, saveMunicipality } from '../comparison/lastMunicipality';
import { readRadius, saveRadius } from '../comparison/radius';
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
  return (
    <section className="profile">
      <div className="profile-top">
        <Link to="/yo" className="back-link">
          ‹ Yo
        </Link>
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
          <RadiusChips
            radiusKm={radiusKm}
            onChange={(km) => {
              saveRadius(km);
              setRadiusKm(km);
            }}
          />
        </div>
      </section>
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
    </section>
  );
}

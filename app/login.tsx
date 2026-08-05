/* LoginScreen — login.html de la demo.
   Sin contraseña: la ruta identifica al inspector en campo.
   La ruta se elige en dos pasos porque FROG las lista por CEDIS: primero la UDN,
   y con ella se consultan las rutas de ese centro (GET /frog/rutas/:udn). */

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { CEDIS_IDS, cedisLabel } from '@/api/types';
import { useRutas } from '@/lib/useRutas';
import { useSession } from '@/store/session';
import { Card, Dropdown, Field, Hero, PrimaryButton, Screen } from '@/ui';

export default function LoginScreen() {
  const { entrar } = useSession();
  const router = useRouter();
  const [udn, setUdn] = useState('');
  const [ruta, setRuta] = useState('');
  const { rutas, cargando, cargar } = useRutas();

  async function onEntrar() {
    if (!ruta) {
      Alert.alert('Falta la ruta', 'Selecciona tu CEDIS y tu número de ruta.');
      return;
    }
    await entrar(ruta);
    router.replace('/');
  }

  return (
    <Screen top>
      <Hero
        kicker="Censo Nacional"
        title="Enfriadores"
        sub="Selecciona tu CEDIS y tu ruta para comenzar."
      />

      <Card>
        <Field label="CEDIS" required>
          <Dropdown
            value={udn}
            options={CEDIS_IDS}
            label={cedisLabel}
            onChange={(id) => {
              setUdn(id);
              setRuta(''); // otra UDN, otras rutas: la elegida ya no aplica
            }}
            placeholder="— Selecciona tu CEDIS —"
          />
        </Field>

        <Field label="Ruta" required>
          <Dropdown
            value={ruta}
            options={rutas}
            onChange={setRuta}
            onOpen={() => cargar(udn)}
            loading={cargando}
            disabled={!udn}
            placeholder={udn ? '— Selecciona tu ruta —' : 'Elige primero un CEDIS'}
            vacio="FROG no tiene rutas para este CEDIS."
          />
        </Field>

        <PrimaryButton onPress={onEntrar}>Entrar</PrimaryButton>
      </Card>
    </Screen>
  );
}

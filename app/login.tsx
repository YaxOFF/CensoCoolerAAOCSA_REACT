/* LoginScreen — login.html de la demo.
   Sin contraseña: la ruta identifica al inspector en campo. */

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { useCatalogos } from '@/store/catalogos';
import { useSession } from '@/store/session';
import { Card, Chip, Field, Hero, Input, Muted, PrimaryButton, Screen } from '@/ui';

export default function LoginScreen() {
  const { entrar } = useSession();
  const catalogos = useCatalogos();
  const router = useRouter();
  const [ruta, setRuta] = useState('');

  async function onEntrar() {
    if (!ruta.trim()) {
      Alert.alert('Falta la ruta', 'Captura tu número de ruta.');
      return;
    }
    await entrar(ruta);
    router.replace('/');
  }

  return (
    <Screen>
      <Hero
        kicker="Censo Nacional"
        title="Enfriadores"
        sub="Ingresa tu número de ruta para comenzar."
      />

      <Card>
        <Field label="Ruta" required>
          <Input
            value={ruta}
            onChangeText={setRuta}
            placeholder="Ej. R-101"
            onSubmitEditing={onEntrar}
          />
        </Field>
        <PrimaryButton onPress={onEntrar}>Entrar</PrimaryButton>

        {catalogos.rutas.length > 0 && (
          <>
            <Muted style={{ marginTop: 16, fontSize: 12 }}>Rutas disponibles:</Muted>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {catalogos.rutas.map((r) => (
                <Chip key={r} label={r} onPress={() => setRuta(r)} />
              ))}
            </View>
          </>
        )}
      </Card>
    </Screen>
  );
}

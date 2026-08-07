/* ResultScreen — result.html de la demo.
   §5 y §6: muestra lo que devolvió FROG y pide la validación que define el status. */

import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { oDash } from '@/lib/format';
import { resolverStatus } from '@/lib/rules';
import { useDraft } from '@/store/draft';
import { colors, radius } from '@/theme';
import { Badge, Card, H2, Hero, KeyValues, Muted, PrimaryButton, Screen, Segmented } from '@/ui';

export default function ResultScreen() {
  const { draft, actualizar } = useDraft();
  const router = useRouter();
  const [validacion, setValidacion] = useState<'ok' | 'fix' | null>(null);

  // Sin draft (p. ej. recarga en caliente): se vuelve a la búsqueda.
  if (!draft) return <Redirect href="/search" />;

  function validar(key: string) {
    const v = key as 'ok' | 'fix';
    setValidacion(v);
    actualizar({ status: resolverStatus(true, v) });
  }

  const listo = draft.esNuevo || validacion !== null;

  // FROG distingue razón social (RAZONSOCIAL → nombreCliente) de nombre comercial
  // (DENCOMERCIAL): el inspector reconoce la tienda por el comercial, no por el fiscal.
  // El mock no trae la fila cruda, así que se cae a la razón social.
  const denComercial = draft.frog?.DENCOMERCIAL?.trim() || draft.nombreCliente;

  return (
    <Screen>
      <Hero kicker="Paso 1 de 3" title="Resultado" />

      {/* Ruta y nombre comercial arriba de todo: es lo que el inspector necesita
          confirmar de un vistazo antes de mirar cualquier otro dato. */}
      <Card style={s.destacado}>
        <Text style={s.etiqueta}>Ruta</Text>
        <Text style={s.ruta}>{oDash(draft.ruta)}</Text>
        <View style={s.linea} />
        <Text style={s.etiqueta}>Cliente</Text>
        <Text style={s.cliente}>{oDash(denComercial)}</Text>
      </Card>

      <Card>
        <Badge text={draft.status ?? 'Encontrado en FROG'} />
        <H2>{draft.esNuevo ? 'Serie no encontrada' : 'Equipo localizado'}</H2>

        <KeyValues
          rows={[
            ['N° Serie', draft.numeroSerie],
            ['Cliente', oDash(draft.nombreCliente)],
            ['N° Cliente', oDash(draft.numeroCliente)],
            ['Dirección', oDash(draft.direccion)],
            ['CEDIS', oDash(draft.cedis)],
            ['Marca / Modelo', oDash(`${draft.marca} ${draft.modelo}`.trim())],
            ['Tipo', oDash(draft.tipo)],
          ]}
        />

        {draft.esNuevo ? (
          <Muted>
            La serie no existe en FROG. Se registrará como equipo NUEVO y todos los campos estarán
            abiertos para captura.
          </Muted>
        ) : (
          <>
            <Muted style={{ fontWeight: '600', marginBottom: 10 }}>
              ¿La información recuperada es correcta?
            </Muted>
            <Segmented
              value={validacion}
              onChange={validar}
              options={[
                { key: 'ok', label: 'Sí, correcta' },
                { key: 'fix', label: 'No, corregir' },
              ]}
            />
          </>
        )}

        {listo && (
          <PrimaryButton onPress={() => router.push('/censo/form')} style={{ marginTop: 20 }}>
            Continuar al censo
          </PrimaryButton>
        )}
      </Card>
    </Screen>
  );
}

const s = StyleSheet.create({
  destacado: { paddingVertical: 22 },
  etiqueta: {
    color: colors.text2,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  // Tabular para que los dígitos de la ruta no bailen de ancho.
  ruta: {
    color: colors.text,
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  linea: {
    height: 1,
    backgroundColor: colors.line,
    marginVertical: 16,
    borderRadius: radius.pill,
  },
  cliente: { color: colors.text, fontSize: 24, fontWeight: '700', letterSpacing: -0.4, marginTop: 2 },
});

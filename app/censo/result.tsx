/* ResultScreen — result.html de la demo.
   §5 y §6: muestra lo que devolvió FROG y pide la validación que define el status. */

import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { oDash } from '@/lib/format';
import { resolverStatus } from '@/lib/rules';
import { useDraft } from '@/store/draft';
import { colors, radius, tint } from '@/theme';
import { Badge, Card, H2, Hero, KeyValues, Muted, PrimaryButton, Screen } from '@/ui';

export default function ResultScreen() {
  const { draft, actualizar } = useDraft();
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
    <View style={s.pantalla}>
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

          {draft.esNuevo && (
            <Muted>
              La serie no existe en FROG. Se registrará como equipo NUEVO y todos los campos estarán
              abiertos para captura.
            </Muted>
          )}
        </Card>
      </Screen>

      {/* §5: la validación y el avance viven en una barra fija abajo. Al final de
          la ficha el inspector tenía que adivinar que había que bajar para
          contestar, y es la única decisión que la pantalla le pide. */}
      <View style={[s.barra, { paddingBottom: insets.bottom + 12 }]}>
        {!draft.esNuevo && (
          <>
            <Text style={s.pregunta}>¿La información recuperada es correcta?</Text>
            <View style={s.opciones}>
              <Opcion
                label="Sí, correcta"
                icon="checkmark-circle"
                color={colors.green}
                activa={validacion === 'ok'}
                onPress={() => validar('ok')}
              />
              <Opcion
                label="No, corregir"
                icon="create"
                color={colors.amber}
                activa={validacion === 'fix'}
                onPress={() => validar('fix')}
              />
            </View>
          </>
        )}

        {listo && (
          <PrimaryButton
            onPress={() => router.push('/censo/form')}
            style={{ marginTop: draft.esNuevo ? 0 : 10 }}
          >
            Continuar al censo
          </PrimaryButton>
        )}
      </View>
    </View>
  );
}

/* Botón de la validación. Va aquí y no en src/ui porque el color por opción
   (verde = aceptar, ámbar = corregir) solo tiene sentido en esta pregunta;
   <Segmented> sigue siendo el control neutro para el resto de la app. */
function Opcion({
  label,
  icon,
  color,
  activa,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  activa: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.opcion,
        { borderColor: color, backgroundColor: activa ? color : tint(color) },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Ionicons name={icon} size={20} color={activa ? colors.card : color} />
      <Text style={[s.opcionTexto, { color: activa ? colors.card : color }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.bg },
  // La barra no se superpone al scroll: es hermana del <Screen>, así el contenido
  // nunca queda tapado y no hace falta un espaciador al final de la ficha.
  barra: {
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingHorizontal: 16,
    paddingTop: 12,
    // Sombra hacia arriba: separa la barra del contenido que pasa por debajo.
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -3 },
    elevation: 12,
  },
  destacado: { paddingVertical: 22 },
  pregunta: { color: colors.text, fontSize: 14, fontWeight: '700', marginBottom: 10 },
  opciones: { flexDirection: 'row', gap: 10 },
  opcion: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: radius.control,
    borderWidth: 1.5,
  },
  opcionTexto: { fontSize: 15, fontWeight: '700' },
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

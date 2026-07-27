/* FormScreen — form.html de la demo. El corazón del censo.

   Reglas que se aplican aquí (todas viven en src/lib/rules.ts, esto solo las cablea):
     §6    CORRECTO deja los datos de FROG bloqueados; CORRECCIÓN y NUEVO los abren.
     §12.1 El estado del enfriador siempre está habilitado y es obligatorio.
     §12.2 En Piso fuerza cliente = BODEGA.
     §12.3 Al guardar se registran GPS, fecha, hora y usuario. */

import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import type { EstadoEnfriador, Foto, Gps, TipoFoto } from '@/api/types';
import { esFotoMock, obtenerGps, tomarFoto } from '@/lib/device';
import { fmtCoord } from '@/lib/format';
import { aplicarEnPiso, camposEditables, validarDraft } from '@/lib/rules';
import { useCatalogos } from '@/store/catalogos';
import { useDraft } from '@/store/draft';
import { useRecords } from '@/store/records';
import { useSession } from '@/store/session';
import { colors, radius } from '@/theme';
import {
  Badge,
  Card,
  Field,
  GhostButton,
  H2,
  Hero,
  Input,
  Muted,
  Note,
  PrimaryButton,
  Screen,
  Section,
  Select,
} from '@/ui';

const TIPOS_FOTO: TipoFoto[] = ['Frontal', 'Placa', 'Fachada'];
const TINTES: Record<TipoFoto, string> = {
  Frontal: colors.blue,
  Placa: colors.purple,
  Fachada: colors.amber,
};

export default function FormScreen() {
  const { draft, actualizar, setUltimo, limpiar } = useDraft();
  const { guardar, registros } = useRecords();
  const { usuario } = useSession();
  const catalogos = useCatalogos();
  const router = useRouter();

  const [estado, setEstado] = useState<EstadoEnfriador | ''>('');
  const [observaciones, setObservaciones] = useState('');
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [gps, setGps] = useState<Gps | null>(null);
  const [ubicando, setUbicando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  // Cliente previo a activar En Piso, para poder restaurarlo (§12.2).
  const [previoCliente, setPrevioCliente] = useState<{
    numeroCliente: string;
    nombreCliente: string;
  } | null>(null);

  if (!draft) return <Redirect href="/search" />;

  const editable = camposEditables(draft.status);
  const clienteBloqueado = !editable || estado === 'En Piso';

  function cambiarEstado(nuevo: EstadoEnfriador) {
    if (!draft) return;
    const r = aplicarEnPiso(
      nuevo,
      { numeroCliente: draft.numeroCliente, nombreCliente: draft.nombreCliente },
      previoCliente
    );
    setEstado(nuevo);
    setPrevioCliente(r.previo);
    actualizar(r.patch);
  }

  async function capturarGps() {
    setUbicando(true);
    setGps(await obtenerGps(registros.length));
    setUbicando(false);
  }

  async function capturarFoto(tipo: TipoFoto) {
    const existente = fotos.find((f) => f.tipo === tipo);
    if (existente) {
      setFotos(fotos.filter((f) => f.tipo !== tipo)); // segundo toque = quitar
      return;
    }
    const foto = await tomarFoto(tipo);
    if (foto.uri) setFotos([...fotos, foto]);
  }

  async function onGuardar() {
    if (!draft) return;
    const error = validarDraft({ ...draft, estadoEnfriador: estado });
    if (error) {
      Alert.alert('Falta información', error);
      return;
    }

    setGuardando(true);
    try {
      // §12.3: si el usuario no capturó ubicación, se obtiene automáticamente al guardar.
      const ubicacion = gps ?? (await obtenerGps(registros.length));

      const rec = await guardar({
        numeroSerie: draft.numeroSerie,
        numeroCliente: draft.numeroCliente,
        nombreCliente: draft.nombreCliente,
        direccion: draft.direccion,
        cedis: draft.cedis || 'Sin CEDIS',
        ruta: draft.ruta || '—',
        marca: draft.marca,
        modelo: draft.modelo,
        tipo: draft.tipo,
        status: draft.status!,
        estadoEnfriador: estado as EstadoEnfriador,
        observaciones: observaciones.trim(),
        lat: ubicacion.lat,
        lng: ubicacion.lng,
        fecha: new Date().toISOString(),
        usuario,
        // La subida de las evidencias la hace la capa api: cuelgan del censo ya creado.
        fotos,
        frog: draft.frog,
      });

      setUltimo(rec);
      limpiar();
      router.replace('/censo/done');
    } catch (e) {
      Alert.alert('No se pudo guardar', e instanceof Error ? e.message : 'Error desconocido.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Screen>
      <Hero kicker="Paso 2 de 3" title="Formulario" />

      <Card>
        <Badge text={draft.status ?? ''} />
        <H2>Datos del cliente y equipo</H2>
        {!editable && (
          <Muted style={{ marginBottom: 12 }}>
            La información se validó como correcta, por eso está bloqueada (§6).
          </Muted>
        )}

        <View style={s.grid2}>
          <Field label="N° Cliente" style={s.col}>
            <Input
              value={draft.numeroCliente}
              onChangeText={(t) => actualizar({ numeroCliente: t })}
              editable={!clienteBloqueado}
            />
          </Field>
          <Field label="Nombre cliente" style={s.col}>
            <Input
              value={draft.nombreCliente}
              onChangeText={(t) => actualizar({ nombreCliente: t })}
              editable={!clienteBloqueado}
              autoCapitalize="words"
            />
          </Field>
        </View>

        <Field label="Dirección">
          <Input
            value={draft.direccion}
            onChangeText={(t) => actualizar({ direccion: t })}
            editable={editable}
            autoCapitalize="words"
          />
        </Field>

        <View style={s.grid2}>
          <Field label="CEDIS" style={s.col}>
            <Input value={draft.cedis} onChangeText={(t) => actualizar({ cedis: t })} editable={editable} autoCapitalize="words" />
          </Field>
          <Field label="Ruta" style={s.col}>
            <Input value={draft.ruta} onChangeText={(t) => actualizar({ ruta: t })} editable={editable} />
          </Field>
        </View>

        <View style={s.grid2}>
          <Field label="N° Serie" style={s.col}>
            <Input value={draft.numeroSerie} onChangeText={(t) => actualizar({ numeroSerie: t })} editable={editable} />
          </Field>
          <Field label="Marca" style={s.col}>
            <Input value={draft.marca} onChangeText={(t) => actualizar({ marca: t })} editable={editable} autoCapitalize="words" />
          </Field>
        </View>

        <Field label="Modelo">
          <Input value={draft.modelo} onChangeText={(t) => actualizar({ modelo: t })} editable={editable} />
        </Field>

        <Field label="Tipo de enfriador">
          <Select
            value={draft.tipo}
            options={catalogos.tipos}
            onChange={(t) => actualizar({ tipo: t })}
            disabled={!editable}
          />
        </Field>
      </Card>

      <Card>
        <Section>Preguntas del censo</Section>

        <Field label="Estado del enfriador" required>
          <Select value={estado} options={catalogos.estadosEnfriador} onChange={cambiarEstado} />
        </Field>

        {estado === 'En Piso' && (
          <Note>"En Piso": el cliente se asigna automáticamente a BODEGA.</Note>
        )}

        <Field label="Observaciones">
          <Input
            value={observaciones}
            onChangeText={setObservaciones}
            placeholder="Ej. Falta parrilla, equipo desconectado…"
            multiline
            autoCapitalize="sentences"
          />
        </Field>

        <Field label="Evidencia fotográfica">
          <View style={s.fotos}>
            {TIPOS_FOTO.map((tipo) => {
              const foto = fotos.find((f) => f.tipo === tipo);
              return (
                <Pressable key={tipo} style={[s.foto, !!foto && s.fotoLlena]} onPress={() => capturarFoto(tipo)}>
                  {foto && !esFotoMock(foto.uri) && (
                    <Image source={{ uri: foto.uri }} style={StyleSheet.absoluteFill} />
                  )}
                  {foto && esFotoMock(foto.uri) && (
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: TINTES[tipo] }]} />
                  )}
                  {!foto && <Ionicons name="camera-outline" size={24} color={colors.text2} />}
                  <Text style={[s.fotoLabel, !!foto && { color: '#fff' }]}>{tipo}</Text>
                  {!!foto && (
                    <View style={s.fotoCheck}>
                      <Ionicons name="checkmark" size={12} color="#fff" />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
          <Muted style={{ fontSize: 12, marginTop: 6 }}>Toca de nuevo una foto para reemplazarla.</Muted>
        </Field>

        <Field label="Ubicación GPS">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <GhostButton onPress={capturarGps} disabled={ubicando} icon={ubicando ? undefined : 'location-outline'}>
              {ubicando ? 'Obteniendo…' : 'Obtener ubicación'}
            </GhostButton>
            <Text style={[s.gps, gps && { color: colors.green, fontWeight: '600' }]}>
              {gps ? `${fmtCoord(gps.lat)}, ${fmtCoord(gps.lng)}${gps.mock ? ' (simulada)' : ''}` : 'Sin capturar'}
            </Text>
          </View>
          <Muted style={{ fontSize: 12, marginTop: 6 }}>
            Si no la capturas, se obtiene automáticamente al guardar (§12.3).
          </Muted>
        </Field>

        <PrimaryButton onPress={onGuardar} loading={guardando}>
          Guardar censo
        </PrimaryButton>
      </Card>
    </Screen>
  );
}

const s = StyleSheet.create({
  grid2: { flexDirection: 'row', gap: 12 },
  col: { flex: 1 },
  fotos: { flexDirection: 'row', gap: 10 },
  foto: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: radius.input,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.line,
    backgroundColor: colors.card2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    overflow: 'hidden',
  },
  fotoLlena: { borderStyle: 'solid', borderColor: colors.green },
  fotoLabel: { fontSize: 11, color: colors.text2, fontWeight: '600' },
  fotoCheck: {
    position: 'absolute',
    top: 4,
    right: 6,
    backgroundColor: colors.green,
    borderRadius: 9,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gps: { fontSize: 13, color: colors.text2 },
});

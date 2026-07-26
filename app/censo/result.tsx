/* ResultScreen — result.html de la demo.
   §5 y §6: muestra lo que devolvió FROG y pide la validación que define el status. */

import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';

import { oDash } from '@/lib/format';
import { resolverStatus } from '@/lib/rules';
import { useDraft } from '@/store/draft';
import { Badge, Card, H2, KeyValues, Muted, PrimaryButton, Screen, Segmented } from '@/ui';

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

  return (
    <Screen>
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

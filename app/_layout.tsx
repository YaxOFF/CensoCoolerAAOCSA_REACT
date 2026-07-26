/* Layout raíz: providers globales, stack de navegación y guard de sesión.
   Equivale a requireRuta() de la demo: sin ruta capturada, todo redirige a /login. */

import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DraftProvider } from '@/store/draft';
import { RecordsProvider } from '@/store/records';
import { SessionProvider, useSession } from '@/store/session';
import { colors } from '@/theme';
import { Loading } from '@/ui';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <RecordsProvider>
          <DraftProvider>
            {/* "auto": los iconos de la barra siguen el tema del teléfono
                (sistema oscuro ⇒ iconos claros, y al revés). */}
            <StatusBar style="auto" />
            <Navegacion />
          </DraftProvider>
        </RecordsProvider>
      </SessionProvider>
    </SafeAreaProvider>
  );
}

function Navegacion() {
  const { ruta, cargando } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (cargando) return;
    const enLogin = segments[0] === 'login';
    if (!ruta && !enLogin) router.replace('/login');
    if (ruta && enLogin) router.replace('/');
  }, [ruta, cargando, segments, router]);

  if (cargando) return <Loading text="Abriendo censo…" />;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerTintColor: colors.blue,
        headerTitleStyle: { color: colors.text, fontWeight: '700' },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="censo/result" options={{ title: 'Resultado' }} />
      <Stack.Screen name="censo/form" options={{ title: 'Formulario de censo' }} />
      <Stack.Screen name="censo/done" options={{ title: 'Censo guardado', headerBackVisible: false }} />
      <Stack.Screen name="report" options={{ title: 'Reporte corporativo' }} />
    </Stack>
  );
}

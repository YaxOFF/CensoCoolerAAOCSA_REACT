/* Tab bar de la demo: Inicio · Censar · Historial · Panel. */

import { Tabs } from 'expo-router';
import { Text, type ColorValue } from 'react-native';

import { colors } from '@/theme';

function Icono({ emoji, color }: { emoji: string; color: ColorValue }) {
  return <Text style={{ fontSize: 20, color }}>{emoji}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerTitleStyle: { color: colors.text, fontWeight: '700' },
        tabBarActiveTintColor: colors.blue,
        tabBarInactiveTintColor: colors.text2,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.line },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          headerShown: false,
          tabBarIcon: ({ color }) => <Icono emoji="🏠" color={color} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Censar',
          headerTitle: 'Buscar enfriador',
          tabBarIcon: ({ color }) => <Icono emoji="◎" color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Historial',
          tabBarIcon: ({ color }) => <Icono emoji="🗂" color={color} />,
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Panel',
          headerTitle: 'Dashboard',
          tabBarIcon: ({ color }) => <Icono emoji="📊" color={color} />,
        }}
      />
    </Tabs>
  );
}

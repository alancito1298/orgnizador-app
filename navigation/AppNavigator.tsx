import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS } from '../src/theme';

import HomeScreen from '../src/screens/home/HomeScreen';
import CursosScreen from '../src/screens/cursos/CursosScreen';
import CursoDetalleScreen from '../src/screens/cursos/CursoDetalleScreen';
import AgendaScreen from '../src/screens/agenda/AgendaScreen';
import HorariosScreen from '../src/screens/horarios/HorariosScreen';
import BottomNav from '../src/components/shared/BottomNav';

export type AppStackParamList = {
  Home: undefined;
  Cursos: undefined;
  CursoDetalle: { cursoId: number; curso?: any };
  Agenda: undefined;
  Horario: undefined;
  Perfil: undefined;
};

// Wrapper que agrega el BottomNav flotante por encima de cada pantalla
function withBottomNav(Screen: React.ComponentType<any>, route: string) {
  return function WrappedScreen(props: any) {
    return (
      <View style={{ flex: 1 }}>
        <Screen {...props} />
        <BottomNav activeRoute={route} />
      </View>
    );
  };
}

// Placeholders para próximas secciones
function Placeholder({ name }: { name: string }) {
  return (
    <View style={styles.placeholder}>
      <Ionicons name="construct-outline" size={48} color={COLORS.secondary} />
      <Text style={styles.placeholderText}>{name}</Text>
      <Text style={styles.placeholderSub}>Próximamente...</Text>
    </View>
  );
}

const Stack = createNativeStackNavigator<AppStackParamList>();

export default function AppNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen
        name="Home"
        component={withBottomNav(HomeScreen, 'Home')}
      />
      <Stack.Screen
        name="Cursos"
        component={withBottomNav(CursosScreen, 'Cursos')}
      />
      <Stack.Screen
        name="CursoDetalle"
        component={withBottomNav(CursoDetalleScreen, 'Cursos')}
      />
      <Stack.Screen
        name="Agenda"
        component={withBottomNav(AgendaScreen, 'Agenda')}
      />
      <Stack.Screen
        name="Horario"
        component={withBottomNav(HorariosScreen, 'Horario')}
      />
      <Stack.Screen
        name="Perfil"
        component={withBottomNav(
          () => <Placeholder name="Perfil" />, 'Perfil'
        )}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    gap: 12,
  },
  placeholderText: { fontSize: 20, fontWeight: '800', color: COLORS.onSurface },
  placeholderSub: { fontSize: 14, color: COLORS.secondary, fontWeight: '500' },
});

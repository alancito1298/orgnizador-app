import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { apiFetch } from '../../api/client';
import { COLORS, RADIUS, SPACING } from '../../theme';

interface AgendaItem { id: number; fecha: string; descripcion: string; }

interface BottomNavProps {
  activeRoute: string;
}

export default function BottomNav({ activeRoute }: BottomNavProps) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [modalNotif, setModalNotif] = useState(false);
  const [modalIngreso, setModalIngreso] = useState(false);
  const [eventosHoy, setEventosHoy] = useState<AgendaItem[]>([]);
  const [eventosMañana, setEventosMañana] = useState<AgendaItem[]>([]);
  const [ingresoVisto, setIngresoVisto] = useState(false);

  useEffect(() => {
    const fetchAgenda = async () => {
      try {
        const data = await apiFetch<AgendaItem[]>('/agenda', { auth: true });
        if (!Array.isArray(data)) return;

        const hoy = new Date();
        const mañana = new Date();
        mañana.setDate(mañana.getDate() + 1);
        const toKey = (d: Date) => d.toISOString().split('T')[0];

        const hoyItems = data.filter(i => i.fecha.split('T')[0] === toKey(hoy));
        const mañanaItems = data.filter(i => i.fecha.split('T')[0] === toKey(mañana));

        setEventosHoy(hoyItems);
        setEventosMañana(mañanaItems);

        if (hoyItems.length > 0 && !ingresoVisto) {
          setModalIngreso(true);
          setIngresoVisto(true);
        }
      } catch { /* silencioso */ }
    };
    fetchAgenda();
  }, []);

  const totalNotif = eventosHoy.length + eventosMañana.length;
  const canGoBack = navigation.canGoBack();

  return (
    <>
      {/* ── PILL FLOTANTE ── */}
      <View style={[pill.wrapper, { bottom: insets.bottom + 12 }]}>
        <View style={pill.pill}>

          {/* Back */}
          <TouchableOpacity
            style={[pill.btn, !canGoBack && pill.btnDisabled]}
            onPress={() => navigation.goBack()}
            disabled={!canGoBack}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={22} color={canGoBack ? COLORS.secondary : COLORS.border} />
          </TouchableOpacity>

          {/* Home (activo con inset) */}
          <TouchableOpacity
            style={[pill.btn, activeRoute === 'Home' && pill.btnActive]}
            onPress={() => navigation.navigate('Home' as never)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={activeRoute === 'Home' ? 'home' : 'home-outline'}
              size={22}
              color={COLORS.accent}
            />
          </TouchableOpacity>

          {/* 🤖 IA (placeholder) */}
          <TouchableOpacity style={pill.btn} activeOpacity={0.8}>
            <Text style={pill.emoji}>🤖</Text>
          </TouchableOpacity>

          {/* 🔔 Notificaciones */}
          <TouchableOpacity
            style={pill.btn}
            onPress={() => setModalNotif(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="notifications-outline" size={22} color={COLORS.secondary} />
            {totalNotif > 0 && (
              <View style={pill.badge}>
                <Text style={pill.badgeText}>{totalNotif}</Text>
              </View>
            )}
          </TouchableOpacity>

        </View>
      </View>

      {/* ── MODAL NOTIFICACIONES ── */}
      <Modal visible={modalNotif} transparent animationType="slide" onRequestClose={() => setModalNotif(false)}>
        <View style={modal.overlay}>
          <View style={modal.sheet}>
            <View style={modal.header}>
              <View style={modal.titleRow}>
                <Ionicons name="notifications" size={20} color={COLORS.accent} />
                <Text style={modal.title}>Notificaciones</Text>
              </View>
              <TouchableOpacity onPress={() => setModalNotif(false)}>
                <Ionicons name="close" size={22} color={COLORS.secondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {eventosHoy.length > 0 && (
                <View style={modal.group}>
                  <Text style={modal.groupLabel}>📅 Hoy</Text>
                  {eventosHoy.map(e => (
                    <View key={e.id} style={modal.eventCard}>
                      <Text style={modal.eventText}>{e.descripcion}</Text>
                    </View>
                  ))}
                </View>
              )}

              {eventosMañana.length > 0 && (
                <View style={modal.group}>
                  <Text style={[modal.groupLabel, { color: COLORS.secondary }]}>📅 Mañana</Text>
                  {eventosMañana.map(e => (
                    <View key={e.id} style={[modal.eventCard, { backgroundColor: '#f9fafb' }]}>
                      <Text style={[modal.eventText, { color: COLORS.secondary }]}>{e.descripcion}</Text>
                    </View>
                  ))}
                </View>
              )}

              {totalNotif === 0 && (
                <Text style={modal.empty}>No hay eventos para hoy ni mañana</Text>
              )}
            </ScrollView>

            <TouchableOpacity style={modal.closeBtn} onPress={() => setModalNotif(false)}>
              <Text style={modal.closeBtnText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── MODAL AUTOMÁTICO AL INGRESAR ── */}
      <Modal visible={modalIngreso} transparent animationType="fade" onRequestClose={() => setModalIngreso(false)}>
        <View style={modal.centeredOverlay}>
          <View style={modal.centeredSheet}>
            <View style={modal.header}>
              <View style={modal.titleRow}>
                <Ionicons name="calendar" size={18} color={COLORS.accent} />
                <Text style={modal.title}>Eventos de hoy</Text>
              </View>
              <TouchableOpacity onPress={() => setModalIngreso(false)}>
                <Ionicons name="close" size={22} color={COLORS.secondary} />
              </TouchableOpacity>
            </View>

            <Text style={modal.subtitle}>
              Tenés {eventosHoy.length} evento{eventosHoy.length > 1 ? 's' : ''} agendado{eventosHoy.length > 1 ? 's' : ''} para hoy
            </Text>

            <View style={modal.group}>
              {eventosHoy.map(e => (
                <View key={e.id} style={modal.eventCardRow}>
                  <Text style={modal.bulletDot}>•</Text>
                  <Text style={modal.eventText}>{e.descripcion}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity style={modal.closeBtn} onPress={() => setModalIngreso(false)}>
              <Text style={modal.closeBtnText}>Entendido</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const pill = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0, right: 0,
    alignItems: 'center',
    zIndex: 50,
    pointerEvents: 'box-none',
  } as any,
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f5f3ff',
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    // Sombra neumorphic idéntica al web
    shadowColor: '#A3B1C6',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 12,
  },
  btn: {
    padding: 10,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  btnActive: {
    // Inset neumorphic (active home)
    backgroundColor: '#ebe9f8',
    shadowColor: '#B8C6D9',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 0,
  },
  btnDisabled: { opacity: 0.3 },
  emoji: { fontSize: 20, lineHeight: 24 },
  badge: {
    position: 'absolute', top: 4, right: 4,
    backgroundColor: '#ef4444',
    width: 16, height: 16, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
});

const modal = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
    paddingHorizontal: SPACING.md,
    paddingBottom: 96,
  },
  centeredOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },
  sheet: {
    backgroundColor: '#f5f3ff',
    borderRadius: RADIUS.xxl,
    padding: SPACING.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 20,
    maxHeight: '70%',
  },
  centeredSheet: {
    backgroundColor: '#f5f3ff',
    borderRadius: RADIUS.xxl,
    padding: SPACING.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.md,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 17, fontWeight: '800', color: COLORS.accent },
  subtitle: { fontSize: 12, color: COLORS.secondary, marginBottom: SPACING.md },
  group: { marginBottom: SPACING.md, gap: SPACING.sm },
  groupLabel: { fontSize: 11, fontWeight: '800', color: COLORS.accent, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  eventCard: {
    backgroundColor: 'rgba(124,58,237,0.07)', borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md, paddingVertical: 10,
  },
  eventCardRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  bulletDot: { color: COLORS.accent, fontWeight: '800', fontSize: 16, lineHeight: 20 },
  eventText: { fontSize: 13, color: COLORS.onSurface, lineHeight: 18, flex: 1, fontWeight: '500' },
  empty: { textAlign: 'center', color: COLORS.secondary, fontSize: 13, paddingVertical: SPACING.xl },
  closeBtn: {
    marginTop: SPACING.sm,
    paddingVertical: 11,
    borderRadius: RADIUS.lg,
    backgroundColor: '#ebe9f8',
    alignItems: 'center',
    shadowColor: '#A3B1C6',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 3,
  },
  closeBtnText: { fontSize: 13, fontWeight: '800', color: COLORS.accent },
});

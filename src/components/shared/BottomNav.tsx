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
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { apiFetch } from '../../api/client';
import { COLORS, RADIUS, SPACING, NEU } from '../../theme';
import { useNotifStore } from '../../store/notifStore';

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
  const { seenIds, isLoaded, loadSeen, markAsSeen, ingresoVisto, setIngresoVisto } = useNotifStore();

  useEffect(() => {
    if (!isLoaded) {
      loadSeen();
    }
  }, [isLoaded, loadSeen]);

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
  }, [ingresoVisto, setIngresoVisto]);

  const todosEventos = [...eventosHoy, ...eventosMañana];
  const eventosNoVistos = todosEventos.filter(i => !seenIds.includes(i.id));
  const totalNoVistos = eventosNoVistos.length;
  const canGoBack = navigation.canGoBack();

  const handleOpenNotif = () => {
    setModalNotif(true);
    if (todosEventos.length > 0) {
      markAsSeen(todosEventos.map(e => e.id));
    }
  };

  const handleCloseIngreso = () => {
    setModalIngreso(false);
    if (eventosHoy.length > 0) {
      markAsSeen(eventosHoy.map(e => e.id));
    }
  };

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
            <Ionicons name="arrow-back" size={26} color={canGoBack ? COLORS.secondary : COLORS.border} />
          </TouchableOpacity>

          {/* Home (activo con inset) */}
          <TouchableOpacity
            style={[pill.btn, activeRoute === 'Home' && pill.btnActive]}
            onPress={() => navigation.navigate('Home' as never)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={activeRoute === 'Home' ? 'home' : 'home-outline'}
              size={26}
              color={COLORS.accent}
            />
          </TouchableOpacity>

          {/* 🤖 Asistente Pedagógico IA */}
          <TouchableOpacity
            style={[pill.btn, activeRoute === 'ChatbotIA' && pill.btnActive]}
            onPress={() => navigation.navigate('ChatbotIA' as never)}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name="robot-outline"
              size={26}
              color={activeRoute === 'ChatbotIA' ? COLORS.accent : COLORS.secondary}
            />
          </TouchableOpacity>

          {/* 🔔 Notificaciones */}
          <TouchableOpacity
            style={pill.btn}
            onPress={handleOpenNotif}
            activeOpacity={0.8}
          >
            <Ionicons name="notifications-outline" size={26} color={COLORS.secondary} />
            {totalNoVistos > 0 && (
              <View style={pill.badge}>
                <Text style={pill.badgeText}>{totalNoVistos}</Text>
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
              {todosEventos.length === 0 ? (
                <Text style={modal.empty}>No tienes recordatorios próximos</Text>
              ) : (
                <>
                  {eventosHoy.length > 0 && (
                    <View style={modal.group}>
                      <Text style={modal.groupLabel}>📅 Hoy</Text>
                      {eventosHoy.map(item => (
                        <View key={item.id} style={modal.eventCard}>
                          <View style={modal.eventCardRow}>
                            <Text style={modal.bulletDot}>•</Text>
                            <Text style={modal.eventText}>{item.descripcion}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}

                  {eventosMañana.length > 0 && (
                    <View style={modal.group}>
                      <Text style={modal.groupLabel}>⏰ Mañana</Text>
                      {eventosMañana.map(item => (
                        <View key={item.id} style={modal.eventCard}>
                          <View style={modal.eventCardRow}>
                            <Text style={modal.bulletDot}>•</Text>
                            <Text style={modal.eventText}>{item.descripcion}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </>
              )}
            </ScrollView>

            <TouchableOpacity style={modal.closeBtn} onPress={() => setModalNotif(false)}>
              <Text style={modal.closeBtnText}>Entendido</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── MODAL INGRESO AUTOMÁTICO ── */}
      <Modal visible={modalIngreso} transparent animationType="fade" onRequestClose={handleCloseIngreso}>
        <View style={modal.centeredOverlay}>
          <View style={modal.centeredSheet}>
            <View style={modal.header}>
              <View style={modal.titleRow}>
                <Ionicons name="calendar" size={20} color={COLORS.accent} />
                <Text style={modal.title}>Recordatorio de Hoy</Text>
              </View>
              <TouchableOpacity onPress={handleCloseIngreso}>
                <Ionicons name="close" size={22} color={COLORS.secondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 220 }}>
              <View style={modal.group}>
                {eventosHoy.map(item => (
                  <View key={item.id} style={modal.eventCard}>
                    <View style={modal.eventCardRow}>
                      <Text style={modal.bulletDot}>•</Text>
                      <Text style={modal.eventText}>{item.descripcion}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>

            <TouchableOpacity style={modal.closeBtn} onPress={handleCloseIngreso}>
              <Text style={modal.closeBtnText}>¡Entendido!</Text>
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
    gap: 8,
    borderRadius: RADIUS.full,
    paddingHorizontal: 20,
    paddingVertical: 10,
    ...NEU.raisedPill,
  },
  btn: {
    width: 50,
    height: 50,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  btnActive: {
    ...NEU.insetPressed,
    elevation: 0,
  },
  btnDisabled: { opacity: 0.3 },
  badge: {
    position: 'absolute', top: 3, right: 3,
    backgroundColor: '#ef4444',
    width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
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

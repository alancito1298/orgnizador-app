import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Share,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';

import { getToken } from '../../api/client';
import { COLORS, RADIUS, SPACING, NEU } from '../../theme';

interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
}

const PROMPTS_SUGERIDOS = [
  '📝 Secuencia didáctica de 3 clases',
  '📝 Crear evaluación con 5 preguntas',
  '💡 Dinámica corta para iniciar clase',
  '♿ Idea para adaptación curricular',
];

const CHAT_STORAGE_KEY = 'chat_historial_ia_mobile';

export default function ChatbotScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);

  const [mensajes, setMensajes] = useState<Message[]>([
    {
      id: '1',
      sender: 'bot',
      text: '¡Hola, docente! 👋 Soy tu **Asistente Pedagógico IA**.\n\n¿En qué puedo ayudarte hoy? Puedo crear secuencias didácticas, armar evaluaciones, buscar actividades o sugerir dinámicas para el aula.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [cargando, setCargando] = useState(false);
  const [cargadoInicial, setCargadoInicial] = useState(false);

  // Cargar historial guardado en SecureStore
  useEffect(() => {
    const cargarHistorial = async () => {
      try {
        const guardado = await SecureStore.getItemAsync(CHAT_STORAGE_KEY);
        if (guardado) {
          const parsed = JSON.parse(guardado);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMensajes(parsed);
          }
        }
      } catch (e) {
        console.error('Error cargando historial de chat:', e);
      } finally {
        setCargadoInicial(true);
      }
    };
    cargarHistorial();
  }, []);

  // Guardar mensajes automáticamente en cada cambio
  useEffect(() => {
    if (!cargadoInicial) return;
    const guardar = async () => {
      try {
        if (mensajes.length > 0) {
          await SecureStore.setItemAsync(CHAT_STORAGE_KEY, JSON.stringify(mensajes));
        }
      } catch (e) {
        console.error('Error guardando historial de chat:', e);
      }
    };
    guardar();
  }, [mensajes, cargadoInicial]);

  // Auto-scroll al final en cada mensaje
  useEffect(() => {
    const timer = setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 150);
    return () => clearTimeout(timer);
  }, [mensajes, cargando]);

  const vaciarChat = () => {
    Alert.alert(
      'Vaciar conversación',
      '¿Estás seguro de que querés borrar todos los mensajes de esta sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Vaciar',
          style: 'destructive',
          onPress: async () => {
            const msjInicial: Message[] = [
              {
                id: Date.now().toString(),
                sender: 'bot',
                text: '¡Hola, docente! 👋 Soy tu **Asistente Pedagógico IA**.\n\n¿En qué puedo ayudarte hoy? Puedo crear secuencias didácticas, armar evaluaciones, buscar actividades o sugerir dinámicas para el aula.',
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              },
            ];
            setMensajes(msjInicial);
            try {
              await SecureStore.setItemAsync(CHAT_STORAGE_KEY, JSON.stringify(msjInicial));
            } catch (e) {
              console.error(e);
            }
          },
        },
      ]
    );
  };

  const copiarOCompartir = async (texto: string) => {
    try {
      await Share.share({
        message: texto,
        title: 'Respuesta Asistente Pedagógico IA',
      });
    } catch {
      // cancelado
    }
  };

  const enviarMensaje = async (textoEnviar?: string) => {
    const texto = (textoEnviar || input).trim();
    if (!texto || cargando) return;

    const nuevoMensajeUsuario: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: texto,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMensajes((prev) => [...prev, nuevoMensajeUsuario]);
    if (!textoEnviar) setInput('');
    setCargando(true);

    try {
      const token = await getToken();
      const res = await fetch('https://www.organizadordocente.com/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ prompt: texto }),
      });

      const data = await res.json();
      const respuestaTexto = data.response || data.error || 'No se pudo obtener respuesta del asistente.';

      setMensajes((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'bot',
          text: respuestaTexto,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err: any) {
      console.error('Error enviando consulta IA:', err);
      setMensajes((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'bot',
          text: '⚠️ Ocurrió un error al conectar con el Asistente Pedagógico. Verificá tu conexión a internet o intentá nuevamente en unos instantes.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setCargando(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* ── HEADER ── */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <TouchableOpacity
            style={s.backBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={22} color={COLORS.accent} />
          </TouchableOpacity>
          <View style={s.botIconBox}>
            <MaterialCommunityIcons name="robot-outline" size={22} color={COLORS.accent} />
          </View>
          <View>
            <View style={s.titleRow}>
              <Text style={s.headerTitle}>Asistente Pedagógico IA</Text>
              <View style={s.plusBadge}>
                <Text style={s.plusBadgeText}>PLUS</Text>
              </View>
            </View>
            <Text style={s.headerSub}>Secuencias, exámenes e ideas de clase</Text>
          </View>
        </View>

        <TouchableOpacity
          style={s.trashBtn}
          onPress={vaciarChat}
          activeOpacity={0.7}
        >
          <Ionicons name="trash-outline" size={20} color={COLORS.secondary} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
      >
        {/* ── LISTA DE MENSAJES ── */}
        <ScrollView
          ref={scrollViewRef}
          style={s.chatList}
          contentContainerStyle={[s.chatListContent, { paddingBottom: insets.bottom + 90 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {mensajes.map((msg) => {
            const esUsuario = msg.sender === 'user';
            return (
              <View
                key={msg.id}
                style={[s.msgWrapper, esUsuario ? s.msgWrapperUser : s.msgWrapperBot]}
              >
                <View style={[s.msgBubble, esUsuario ? s.msgBubbleUser : s.msgBubbleBot]}>
                  <Text style={[s.msgText, esUsuario ? s.msgTextUser : s.msgTextBot]}>
                    {msg.text}
                  </Text>

                  {!esUsuario && (
                    <TouchableOpacity
                      style={s.copyBtn}
                      onPress={() => copiarOCompartir(msg.text)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="share-outline" size={13} color={COLORS.accent} />
                      <Text style={s.copyBtnText}>Copiar / Compartir</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={s.msgTimestamp}>{msg.timestamp}</Text>
              </View>
            );
          })}

          {cargando && (
            <View style={s.loadingBubble}>
              <ActivityIndicator size="small" color={COLORS.accent} />
              <Text style={s.loadingText}>Pensando respuesta pedagógica...</Text>
            </View>
          )}
        </ScrollView>

        {/* ── PROMPTS RÁPIDOS (Si la conversación es breve) ── */}
        {mensajes.length <= 2 && !cargando && (
          <View style={s.promptsContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.promptsScroll}>
              {PROMPTS_SUGERIDOS.map((prompt, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={s.promptChip}
                  onPress={() => enviarMensaje(prompt)}
                  activeOpacity={0.75}
                >
                  <Text style={s.promptChipText}>{prompt}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── BARRA DE ENTRADA / INPUT ── */}
        <View style={[s.inputContainer, { paddingBottom: insets.bottom + 70 }]}>
          <View style={s.inputPill}>
            <TextInput
              style={s.input}
              placeholder="Escribí tu consulta pedagógica..."
              placeholderTextColor={COLORS.secondary}
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={2500}
              editable={!cargando}
            />
            <TouchableOpacity
              style={[s.sendBtn, (!input.trim() || cargando) && s.sendBtnDisabled]}
              onPress={() => enviarMensaje()}
              disabled={!input.trim() || cargando}
              activeOpacity={0.8}
            >
              <Ionicons
                name="arrow-up"
                size={18}
                color={input.trim() && !cargando ? '#ffffff' : COLORS.secondary}
              />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    ...NEU.raisedCard,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderTopWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(124,58,237,0.1)',
    backgroundColor: '#f5f3ff',
    borderRadius: 0,
    borderBottomLeftRadius: RADIUS.xl,
    borderBottomRightRadius: RADIUS.xl,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  backBtn: {
    padding: 6,
    borderRadius: RADIUS.md,
    ...NEU.inset,
  },
  botIconBox: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...NEU.inset,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.accent,
    letterSpacing: -0.2,
  },
  plusBadge: {
    backgroundColor: '#ede9fe',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.2)',
  },
  plusBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: COLORS.accent,
    letterSpacing: 0.5,
  },
  headerSub: {
    fontSize: 11,
    color: COLORS.secondary,
    fontWeight: '500',
  },
  trashBtn: {
    padding: 8,
    borderRadius: RADIUS.md,
    ...NEU.inset,
  },

  // Mensajes
  chatList: {
    flex: 1,
  },
  chatListContent: {
    padding: SPACING.md,
    gap: 12,
  },
  msgWrapper: {
    maxWidth: '86%',
  },
  msgWrapperUser: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  msgWrapperBot: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  msgBubble: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: RADIUS.xl,
  },
  msgBubbleUser: {
    backgroundColor: COLORS.accent,
    borderBottomRightRadius: 4,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  msgBubbleBot: {
    ...NEU.raisedCard,
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.1)',
  },
  msgText: {
    fontSize: 13,
    lineHeight: 19,
  },
  msgTextUser: {
    color: '#ffffff',
    fontWeight: '600',
  },
  msgTextBot: {
    color: COLORS.onSurface,
    fontWeight: '500',
  },
  msgTimestamp: {
    fontSize: 9,
    color: COLORS.secondary,
    fontWeight: '600',
    marginTop: 3,
    marginHorizontal: 4,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(124,58,237,0.06)',
    alignSelf: 'flex-start',
  },
  copyBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.accent,
  },

  loadingBubble: {
    ...NEU.raisedCard,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderRadius: RADIUS.xl,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.15)',
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.accent,
  },

  // Prompts rápidos
  promptsContainer: {
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(124,58,237,0.08)',
  },
  promptsScroll: {
    paddingHorizontal: SPACING.md,
    gap: 8,
  },
  promptChip: {
    backgroundColor: '#ede9fe',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.2)',
  },
  promptChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.accent,
  },

  // Input
  inputContainer: {
    paddingHorizontal: SPACING.md,
    paddingTop: 8,
    backgroundColor: '#f5f3ff',
    borderTopWidth: 1,
    borderTopColor: 'rgba(124,58,237,0.12)',
  },
  inputPill: {
    ...NEU.inset,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ebe8f7',
    borderRadius: RADIUS.full,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  input: {
    flex: 1,
    fontSize: 13,
    color: COLORS.onSurface,
    fontWeight: '600',
    maxHeight: 100,
    paddingVertical: 6,
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  sendBtnDisabled: {
    backgroundColor: 'rgba(124,58,237,0.2)',
  },
});

// Design tokens — mantiene la paleta violeta del web

export const COLORS = {
  // Acento principal (violeta)
  accent: '#7c3aed',
  accentLight: '#ede9fe',

  // Fondos
  background: '#f5f3ff',
  surface: '#ffffff',
  inputBg: '#f8f7ff',

  // Texto
  onSurface: '#1e1b4b',
  secondary: '#6b7280',

  // Bordes
  border: 'rgba(124,58,237,0.12)',
  borderLight: 'rgba(124,58,237,0.06)',

  // Estados
  error: '#ef4444',
  success: '#10b981',

  // Separador
  divider: 'rgba(124,58,237,0.15)',
};

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const FONT_SIZE = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 18,
  xl: 22,
  xxl: 28,
};

// Sombras y estilos neumórficos fieles al web (#E0E5EC / #f5f3ff con sombras #A3B1C6 y brillos #FFFFFF)
export const NEU = {
  // Sombra elevada principal (tarjetas, botones destacados, contenedores)
  raised: {
    backgroundColor: '#f5f3ff',
    shadowColor: '#9aa9bf',
    shadowOffset: { width: 4, height: 5 },
    shadowOpacity: 0.55,
    shadowRadius: 8,
    elevation: 4,
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderTopColor: '#ffffff',
    borderLeftColor: '#ffffff',
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderBottomColor: 'rgba(163,177,198,0.35)',
    borderRightColor: 'rgba(163,177,198,0.35)',
  },

  // Sombra elevada para cards compactas (cursos, menú items)
  raisedCard: {
    backgroundColor: '#f5f3ff',
    shadowColor: '#9aa9bf',
    shadowOffset: { width: 3, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 6,
    elevation: 3,
    borderTopWidth: 1.2,
    borderLeftWidth: 1.2,
    borderTopColor: '#ffffff',
    borderLeftColor: '#ffffff',
    borderBottomWidth: 0.8,
    borderRightWidth: 0.8,
    borderBottomColor: 'rgba(163,177,198,0.3)',
    borderRightColor: 'rgba(163,177,198,0.3)',
  },

  // Sombra para píldora flotante (BottomNav, etc.)
  raisedPill: {
    backgroundColor: '#f5f3ff',
    shadowColor: '#9aa9bf',
    shadowOffset: { width: 5, height: 6 },
    shadowOpacity: 0.65,
    shadowRadius: 10,
    elevation: 6,
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderTopColor: '#ffffff',
    borderLeftColor: '#ffffff',
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderBottomColor: 'rgba(163,177,198,0.4)',
    borderRightColor: 'rgba(163,177,198,0.4)',
  },

  // Efecto hendido / bajorrelieve (para contenedores de íconos, badges y botones activos)
  inset: {
    backgroundColor: '#ebe7f8',
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderTopColor: '#c5d0df',
    borderLeftColor: '#c5d0df',
    borderBottomWidth: 1.2,
    borderRightWidth: 1.2,
    borderBottomColor: '#ffffff',
    borderRightColor: '#ffffff',
  },

  // Inset para botones activos (Home activo en BottomNav)
  insetPressed: {
    backgroundColor: '#ebe9f8',
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderTopColor: '#B8C6D9',
    borderLeftColor: '#B8C6D9',
    borderBottomWidth: 1.5,
    borderRightWidth: 1.5,
    borderBottomColor: '#FFFFFF',
    borderRightColor: '#FFFFFF',
  },
};


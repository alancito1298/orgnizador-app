import React, { useRef, useState } from 'react';
import { LayoutChangeEvent, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useKeyboard } from '../../hooks/useKeyboard';

interface KeyboardModalContainerProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Contenedor para el overlay de `<Modal>` que adapta automáticamente su
 * espacio inferior cuando se abre el teclado virtual en Android (incluyendo
 * edge-to-edge en React Native 0.86+) e iOS, evitando doble compensación si
 * el sistema operativo ya redimensionó la ventana del modal.
 */
export const KeyboardModalContainer: React.FC<KeyboardModalContainerProps> = ({
  children,
  style,
}) => {
  const { keyboardHeight, isKeyboardVisible } = useKeyboard();
  const baseHeightRef = useRef<number>(0);
  const [currentHeight, setCurrentHeight] = useState<number>(0);

  const handleLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h <= 0) return;
    setCurrentHeight(h);
    if (!isKeyboardVisible || h > baseHeightRef.current) {
      baseHeightRef.current = h;
    }
  };

  // Si la ventana del modal ya se achicó por el teclado (p.ej. adjustResize nativo),
  // descontamos esa reducción para no duplicar el padding inferior.
  const baseHeight = baseHeightRef.current || currentHeight;
  const shrunkBy =
    baseHeight > 0 && currentHeight > 0 ? Math.max(0, baseHeight - currentHeight) : 0;
  const effectiveKeyboardPadding = isKeyboardVisible
    ? Math.max(0, keyboardHeight - shrunkBy)
    : 0;

  return (
    <View
      onLayout={handleLayout}
      style={[
        styles.base,
        style,
        effectiveKeyboardPadding > 0 ? { paddingBottom: effectiveKeyboardPadding } : null,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    flex: 1,
  },
});

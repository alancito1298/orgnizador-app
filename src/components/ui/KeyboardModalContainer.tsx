import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle, useWindowDimensions } from 'react-native';
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
 *
 * En lugar de sumar ciegamente la altura del teclado, mide dónde termina
 * realmente el contenedor en pantalla y sólo agrega el padding necesario
 * para que el contenido quede pegado justo encima del teclado (sin huecos).
 */
export const KeyboardModalContainer: React.FC<KeyboardModalContainerProps> = ({
  children,
  style,
}) => {
  const { keyboardHeight, keyboardScreenY, isKeyboardVisible } = useKeyboard();
  const { height: windowHeight } = useWindowDimensions();
  const ref = useRef<React.ComponentRef<typeof View>>(null);
  const [containerBottom, setContainerBottom] = useState<number>(0);

  const measure = useCallback(() => {
    ref.current?.measureInWindow((_x: number, y: number, _w: number, h: number) => {
      if (h > 0) setContainerBottom(y + h);
    });
  }, []);

  // Re-medimos cada vez que cambia el teclado (el SO puede redimensionar la
  // ventana antes o después del evento, según el dispositivo).
  useEffect(() => {
    measure();
    const t = setTimeout(measure, 80);
    return () => clearTimeout(t);
  }, [keyboardHeight, keyboardScreenY, windowHeight, measure]);

  // Borde superior del teclado: usamos screenY si viene informado; si no,
  // lo estimamos a partir de la altura de la ventana.
  const keyboardTop =
    keyboardScreenY > 0 ? keyboardScreenY : windowHeight - keyboardHeight;

  const effectiveKeyboardPadding =
    isKeyboardVisible && containerBottom > 0
      ? Math.max(0, Math.round(containerBottom - keyboardTop))
      : 0;

  return (
    <View
      ref={ref}
      onLayout={measure}
      style={[
        styles.base,
        style,
        // Con el teclado abierto, todo formulario se apoya directamente sobre
        // el teclado: alineado abajo y sin padding inferior extra del overlay.
        isKeyboardVisible
          ? { justifyContent: 'flex-end', paddingBottom: effectiveKeyboardPadding }
          : null,
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

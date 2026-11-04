import { useEffect, useState } from 'react';
import { Keyboard, KeyboardEvent, Platform, useWindowDimensions } from 'react-native';

export interface KeyboardState {
  keyboardHeight: number;
  /** Coordenada Y (en pantalla) del borde superior del teclado. 0 si no hay teclado. */
  keyboardScreenY: number;
  isKeyboardVisible: boolean;
  /** Altura disponible estimada en pantalla descontando el teclado */
  availableHeight: number;
  dismissKeyboard: () => void;
}

export function useKeyboard(): KeyboardState {
  const { height: windowHeight } = useWindowDimensions();
  const [keyboardHeight, setKeyboardHeight] = useState<number>(() => {
    const metrics = Keyboard.metrics?.();
    return metrics?.height ?? 0;
  });
  const [keyboardScreenY, setKeyboardScreenY] = useState<number>(() => {
    const metrics = Keyboard.metrics?.();
    return metrics?.screenY ?? 0;
  });

  useEffect(() => {
    const metrics = Keyboard.metrics?.();
    if (metrics && metrics.height > 0) {
      setKeyboardHeight(metrics.height);
      setKeyboardScreenY(metrics.screenY ?? 0);
    }

    const onShow = (e: KeyboardEvent) => {
      const h = e.endCoordinates?.height ?? 0;
      setKeyboardHeight(h);
      setKeyboardScreenY(e.endCoordinates?.screenY ?? 0);
    };

    const onHide = () => {
      setKeyboardHeight(0);
      setKeyboardScreenY(0);
    };

    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      onShow
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      onHide
    );
    // En iOS/Android también escuchamos didShow/didHide como respaldo
    const didShowSub =
      Platform.OS === 'ios' ? Keyboard.addListener('keyboardDidShow', onShow) : null;
    const didHideSub =
      Platform.OS === 'ios' ? Keyboard.addListener('keyboardDidHide', onHide) : null;

    return () => {
      showSub.remove();
      hideSub.remove();
      didShowSub?.remove();
      didHideSub?.remove();
    };
  }, []);

  const isKeyboardVisible = keyboardHeight > 0;
  const availableHeight = Math.max(
    240,
    windowHeight - keyboardHeight - (Platform.OS === 'ios' ? 44 : 28)
  );

  return {
    keyboardHeight,
    keyboardScreenY,
    isKeyboardVisible,
    availableHeight,
    dismissKeyboard: Keyboard.dismiss,
  };
}

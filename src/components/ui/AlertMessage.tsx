import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RADIUS } from '../../theme';

interface AlertMessageProps {
  type: 'error' | 'success';
  message: string;
}

export default function AlertMessage({ type, message }: AlertMessageProps) {
  const isError = type === 'error';

  return (
    <View style={[styles.container, isError ? styles.errorBg : styles.successBg]}>
      <Ionicons
        name={isError ? 'alert-circle' : 'checkmark-circle'}
        size={18}
        color={isError ? '#b91c1c' : '#065f46'}
        style={styles.icon}
      />
      <Text style={[styles.text, isError ? styles.errorText : styles.successText]}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    gap: 8,
  },
  errorBg: {
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderColor: 'rgba(239,68,68,0.3)',
  },
  successBg: {
    backgroundColor: 'rgba(16,185,129,0.08)',
    borderColor: 'rgba(16,185,129,0.3)',
  },
  icon: {
    flexShrink: 0,
  },
  text: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  errorText: {
    color: '#b91c1c',
  },
  successText: {
    color: '#065f46',
  },
});

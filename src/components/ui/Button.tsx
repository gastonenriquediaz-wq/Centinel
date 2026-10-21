import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacityProps,
} from 'react-native';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'outline';
}

export const Button: React.FC<ButtonProps> = ({
  title,
  loading = false,
  variant = 'primary',
  disabled,
  style,
  ...props
}) => {
  const isActionDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[
        styles.base,
        styles[variant],
        isActionDisabled && styles.disabled,
        style,
      ]}
      disabled={isActionDisabled}
      activeOpacity={0.8}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'outline' || variant === 'secondary' ? '#1E3A8A' : '#FFFFFF'}
        />
      ) : (
        <Text
          style={[
            styles.text,
            styles[`${variant}Text`],
            isActionDisabled && styles.disabledText,
          ]}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  primary: {
    backgroundColor: '#1E3A8A',
  },
  secondary: {
    backgroundColor: '#E2E8F0',
  },
  danger: {
    backgroundColor: '#DC2626',
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#1E3A8A',
  },
  disabled: {
    opacity: 0.6,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
  },
  primaryText: {
    color: '#FFFFFF',
  },
  secondaryText: {
    color: '#0F172A',
  },
  dangerText: {
    color: '#FFFFFF',
  },
  outlineText: {
    color: '#1E3A8A',
  },
  disabledText: {
    color: '#94A3B8',
  },
});

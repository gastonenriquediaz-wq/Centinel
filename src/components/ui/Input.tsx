import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TextInputProps,
} from 'react-native';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  rightAccessory?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  rightAccessory,
  style,
  ...props
}) => {
  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      {rightAccessory ? (
        <View
          style={[
            styles.inputWithAccessoryWrapper,
            error ? styles.inputError : null,
          ]}
        >
          <TextInput
            style={[styles.inputInner, style]}
            placeholderTextColor="#94A3B8"
            {...props}
          />
          <View style={styles.accessoryWrapper}>{rightAccessory}</View>
        </View>
      ) : (
        <TextInput
          style={[
            styles.input,
            error ? styles.inputError : null,
            style,
          ]}
          placeholderTextColor="#94A3B8"
          {...props}
        />
      )}
      {helperText && !error ? <Text style={styles.helperText}>{helperText}</Text> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#334155',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#0F172A',
  },
  inputWithAccessoryWrapper: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputInner: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#0F172A',
  },
  accessoryWrapper: {
    paddingRight: 12,
    paddingLeft: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  helperText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  inputError: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 12,
    marginTop: 4,
  },
});

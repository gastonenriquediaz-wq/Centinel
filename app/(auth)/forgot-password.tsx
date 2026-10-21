import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { AuthService } from '../../src/services/auth.service';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleReset = async () => {
    setErrorMessage(null);

    if (!email.trim()) {
      setErrorMessage('Por favor, ingresá tu correo electrónico.');
      return;
    }

    try {
      setLoading(true);
      await AuthService.resetPassword(email);
      setSuccess(true);
    } catch (error: any) {
      setErrorMessage(
        error.message || 'No se pudo enviar el correo de recuperación. Verificá la dirección ingresada.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardView}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Card style={styles.card}>
          <Text style={styles.title}>Recuperar Contraseña</Text>
          <Text style={styles.description}>
            Ingresá el correo electrónico registrado con tu cuenta institucional. Te enviaremos un enlace seguro para restablecer tu contraseña.
          </Text>

          {success ? (
            <View style={styles.successBox}>
              <Text style={styles.successTitle}>Correo Enviado</Text>
              <Text style={styles.successText}>
                Si la dirección está registrada, recibirás instrucciones para crear una nueva contraseña. Revisá tu bandeja de entrada o spam.
              </Text>
              <Button
                title="Volver al inicio de sesión"
                variant="primary"
                onPress={() => router.replace('/(auth)/login')}
                style={styles.backButton}
              />
            </View>
          ) : (
            <>
              {errorMessage && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              )}

              <Input
                label="Correo electrónico"
                placeholder="ejemplo@correo.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Button
                title="Enviar enlace de recuperación"
                onPress={handleReset}
                loading={loading}
                style={styles.submitButton}
              />

              <Button
                title="Volver"
                variant="outline"
                onPress={() => router.back()}
                style={styles.cancelButton}
              />
            </>
          )}
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  submitButton: {
    marginTop: 8,
  },
  cancelButton: {
    marginTop: 12,
  },
  backButton: {
    marginTop: 16,
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderColor: '#F87171',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#991B1B',
    fontSize: 13,
  },
  successBox: {
    backgroundColor: '#ECFDF5',
    borderColor: '#6EE7B7',
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
  },
  successTitle: {
    color: '#065F46',
    fontWeight: '700',
    fontSize: 15,
    marginBottom: 6,
    textAlign: 'center',
  },
  successText: {
    color: '#047857',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
});

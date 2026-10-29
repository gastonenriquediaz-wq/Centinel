import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { AuthService } from '../../src/services/auth.service';
import { useAuthStore } from '../../src/store/auth.store';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusBlockedInfo, setStatusBlockedInfo] = useState<string | null>(null);

  const { setSession, setProfile } = useAuthStore();

  const handleLogin = async () => {
    setErrorMessage(null);
    setStatusBlockedInfo(null);

    if (!email.trim() || !password) {
      setErrorMessage('Por favor, ingresá tu correo y contraseña.');
      return;
    }

    try {
      setLoading(true);
      const { session, profile, institution } = await AuthService.signIn(email, password);

      // Verificación de estado de cuenta (RF-07 y RF-08)
      if (profile.account_status !== 'approved') {
        // Cerrar la sesión de auth para no dejarla abierta
        await AuthService.signOut();

        if (profile.account_status === 'pending') {
          setStatusBlockedInfo(
            'Tu cuenta se encuentra PENDIENTE de aprobación por las autoridades de tu institución. Podrás ingresar una vez que sea habilitada.'
          );
        } else if (profile.account_status === 'rejected') {
          setStatusBlockedInfo(
            'Tu solicitud de registro ha sido RECHAZADA por las autoridades institucionales.'
          );
        } else if (profile.account_status === 'suspended') {
          setStatusBlockedInfo(
            'Tu cuenta ha sido SUSPENDIDA temporalmente por las autoridades de la institución.'
          );
        } else if (profile.account_status === 'inactive') {
          setStatusBlockedInfo(
            'Esta cuenta se encuentra DESACTIVADA. Comunicate con las autoridades de tu colegio.'
          );
        }
        return;
      }

      // Cuenta aprobada: guardar en store global
      setSession(session);
      setProfile(profile, institution);

      // Redirigir según rol
      if (profile.role === 'student') {
        router.replace('/(student)');
      } else if (profile.role === 'authority') {
        router.replace('/(authority)');
      }
    } catch (error: any) {
      const msg = error.message || 'Error al iniciar sesión.';
      if (msg.includes('Invalid login credentials')) {
        setErrorMessage('Correo electrónico o contraseña incorrectos.');
      } else {
        setErrorMessage(msg);
      }
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
        <View style={styles.header}>
          <Text style={styles.appTitle}>Centinel</Text>
          <Text style={styles.appSubtitle}>
            Canal de Comunicación y Convivencia Escolar
          </Text>
        </View>

        <Card style={styles.card}>
          <Text style={styles.formTitle}>Iniciar sesión</Text>

          {statusBlockedInfo && (
            <View style={styles.alertBoxWarning}>
              <Text style={styles.alertTitleWarning}>Cuenta no habilitada</Text>
              <Text style={styles.alertTextWarning}>{statusBlockedInfo}</Text>
            </View>
          )}

          {errorMessage && (
            <View style={styles.alertBoxError}>
              <Text style={styles.alertTextError}>{errorMessage}</Text>
            </View>
          )}

          <Input
            label="Correo electrónico"
            placeholder="ejemplo@correo.com"
            helperText="Usá el correo registrado en tu cuenta."
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Input
            label="Contraseña"
            placeholder="Ingresá tu contraseña"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            rightAccessory={
              <TouchableOpacity
                onPress={() => setShowPassword((prev) => !prev)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={22}
                  color="#64748B"
                />
              </TouchableOpacity>
            }
          />

          <View style={styles.forgotPasswordRow}>
            <TouchableOpacity
              onPress={() => router.push('/(auth)/forgot-password')}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.forgotPasswordText}>¿Olvidaste tu contraseña?</Text>
            </TouchableOpacity>
          </View>

          <Button
            title="Ingresar"
            onPress={handleLogin}
            loading={loading}
            style={styles.loginButton}
          />

          <View style={styles.dividerBox}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>¿Sos estudiante nuevo?</Text>
            <View style={styles.dividerLine} />
          </View>

          <Button
            title="Registrarse con código QR"
            variant="secondary"
            icon={<Ionicons name="qr-code-outline" size={18} color="#0F172A" />}
            onPress={() => router.push('/(auth)/register')}
            style={styles.registerButton}
          />
        </Card>

        <View style={styles.footerNotice}>
          <Text style={styles.noticeText}>
            El registro requiere un código QR institucional y la aprobación de una autoridad educativa.
          </Text>
          <Text style={styles.noticeSubtext}>
            Proyecto de grado · Universidad Católica de Salta
          </Text>
        </View>
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
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  appTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1E3A8A',
    letterSpacing: 0.5,
  },
  appSubtitle: {
    fontSize: 14,
    color: '#475569',
    marginTop: 4,
    textAlign: 'center',
  },
  card: {
    padding: 24,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 20,
    textAlign: 'center',
  },
  loginButton: {
    marginTop: 4,
  },
  forgotPasswordRow: {
    alignItems: 'flex-end',
    marginTop: -4,
    marginBottom: 18,
  },
  forgotPasswordText: {
    color: '#2563EB',
    fontSize: 14,
    fontWeight: '500',
  },
  dividerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#CBD5E1',
  },
  dividerText: {
    fontSize: 12,
    color: '#64748B',
    paddingHorizontal: 10,
    fontWeight: '500',
  },
  registerButton: {
    backgroundColor: '#F1F5F9',
    borderColor: '#94A3B8',
    borderWidth: 1,
  },
  alertBoxError: {
    backgroundColor: '#FEF2F2',
    borderColor: '#F87171',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  alertTextError: {
    color: '#991B1B',
    fontSize: 14,
    lineHeight: 20,
  },
  alertBoxWarning: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FCD34D',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  alertTitleWarning: {
    color: '#92400E',
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 4,
  },
  alertTextWarning: {
    color: '#B45309',
    fontSize: 13,
    lineHeight: 18,
  },
  footerNotice: {
    marginTop: 20,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  noticeText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 8,
  },
  noticeSubtext: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    fontWeight: '500',
  },
});

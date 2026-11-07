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
  TextInput,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../src/components/ui/Button';
import { AuthService } from '../../src/services/auth.service';
import { useAuthStore } from '../../src/store/auth.store';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusBlockedInfo, setStatusBlockedInfo] = useState<string | null>(null);

  const { setSession, setProfile, sessionTimeoutMessage, setSessionTimeoutMessage } = useAuthStore();
  const insets = useSafeAreaInsets();

  const handleLogin = async () => {
    setErrorMessage(null);
    setStatusBlockedInfo(null);
    setSessionTimeoutMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage('Por favor, ingresá tu correo y contraseña.');
      return;
    }

    try {
      setLoading(true);
      const { session, profile, institution, course } = await AuthService.signIn(email, password);

      // Verificación de estado de cuenta (RF-07 y RF-08)
      if (profile.account_status !== 'approved') {
        // Cerrar la sesión de auth para no dejarla abierta
        await AuthService.signOut();

        if (profile.account_status === 'pending') {
          const pendingMsg =
            'Tu registro está pendiente de confirmación por una autoridad escolar. Debés esperar la aprobación de tu colegio antes de poder ingresar a la aplicación.';
          setStatusBlockedInfo(pendingMsg);
          Alert.alert('Cuenta pendiente de aprobación', pendingMsg, [{ text: 'Entendido' }]);
        } else if (profile.account_status === 'rejected') {
          const rejectedMsg =
            'Tu solicitud de registro ha sido RECHAZADA por las autoridades institucionales.';
          setStatusBlockedInfo(rejectedMsg);
          Alert.alert('Acceso no permitido', rejectedMsg, [{ text: 'Entendido' }]);
        } else if (profile.account_status === 'suspended') {
          const suspendedMsg =
            'Tu cuenta ha sido SUSPENDIDA temporalmente por las autoridades de la institución educativa. Por favor, acercate a Preceptoría o Dirección.';
          setStatusBlockedInfo(suspendedMsg);
          Alert.alert('Cuenta suspendida', suspendedMsg, [{ text: 'Entendido' }]);
        } else if (profile.account_status === 'inactive') {
          const inactiveMsg =
            'Esta cuenta se encuentra DESACTIVADA. Comunicate con las autoridades de tu colegio.';
          setStatusBlockedInfo(inactiveMsg);
          Alert.alert('Cuenta inactiva', inactiveMsg, [{ text: 'Entendido' }]);
        }
        return;
      }

      // Cuenta aprobada: guardar en store global
      setSession(session);
      setProfile(profile, institution, course);

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
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* Elementos decorativos de fondo (ondas suaves celestes) */}
      <View style={styles.bgDecorTopRight} pointerEvents="none" />
      <View style={styles.bgDecorTopLeft} pointerEvents="none" />
      <View style={styles.bgDecorBottom} pointerEvents="none" />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top, 24) + 16,
            paddingBottom: Math.max(insets.bottom, 20) + 16,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Cabecera institucional con logo y título */}
        <View style={styles.header}>
          <Image
            source={require('../../assets/icon.png')}
            style={styles.logoImage}
            resizeMode="cover"
          />
          <View style={styles.verticalDivider} />
          <View style={styles.headerTextGroup}>
            <Text style={styles.appTitle}>Centinel</Text>
            <Text style={styles.appSubtitle}>
              Canal de Comunicación y{'\n'}Convivencia Escolar
            </Text>
          </View>
        </View>

        {/* Tarjeta de Inicio de Sesión */}
        <View style={styles.card}>
          <Text style={styles.formTitle}>Iniciar sesión</Text>

          {sessionTimeoutMessage && (
            <View style={styles.alertBoxWarning}>
              <Ionicons
                name="shield-checkmark-outline"
                size={18}
                color="#B45309"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.alertTextWarning}>{sessionTimeoutMessage}</Text>
            </View>
          )}

          {statusBlockedInfo && (
            <View style={styles.alertBoxWarning}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                <Ionicons
                  name="time-outline"
                  size={18}
                  color="#92400E"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.alertTitleWarning}>Esperando aprobación escolar</Text>
              </View>
              <Text style={styles.alertTextWarning}>{statusBlockedInfo}</Text>
            </View>
          )}

          {errorMessage && (
            <View style={styles.alertBoxError}>
              <Text style={styles.alertTextError}>{errorMessage}</Text>
            </View>
          )}

          {/* Campo: Correo electrónico */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Correo electrónico</Text>
            <View style={styles.inputContainer}>
              <Ionicons
                name="mail-outline"
                size={20}
                color="#2563EB"
                style={styles.inputLeftIcon}
              />
              <TextInput
                style={styles.textInputField}
                placeholder="ejemplo@correo.com"
                placeholderTextColor="#94A3B8"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <Text style={styles.helperText}>Usá el correo registrado en tu cuenta.</Text>
          </View>

          {/* Campo: Contraseña */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Contraseña</Text>
            <View style={styles.inputContainer}>
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color="#64748B"
                style={styles.inputLeftIcon}
              />
              <TextInput
                style={styles.textInputField}
                placeholder="Ingresá tu contraseña"
                placeholderTextColor="#94A3B8"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                onPress={() => setShowPassword((prev) => !prev)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                activeOpacity={0.7}
                style={styles.eyeIconBtn}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
              >
                <Ionicons
                  name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                  size={22}
                  color="#64748B"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Enlace: Olvidaste tu contraseña */}
          <View style={styles.forgotPasswordRow}>
            <TouchableOpacity
              onPress={() => router.push('/(auth)/forgot-password')}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.forgotPasswordText}>¿Olvidaste tu contraseña?</Text>
            </TouchableOpacity>
          </View>

          {/* Botón: Ingresar */}
          <Button
            title="Ingresar"
            onPress={handleLogin}
            loading={loading}
            style={styles.loginButton}
          />

          {/* Separador */}
          <View style={styles.dividerBox}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>¿Sos estudiante nuevo?</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Botón: Registrarse con código QR */}
          <TouchableOpacity
            style={styles.qrButton}
            onPress={() => router.push('/(auth)/register')}
            activeOpacity={0.7}
          >
            <Ionicons name="qr-code-outline" size={20} color="#1E3A8A" style={styles.qrIcon} />
            <Text style={styles.qrButtonText}>Registrarse con código QR</Text>
          </TouchableOpacity>
        </View>

        {/* Pie de pantalla / avisos */}
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
    backgroundColor: '#F8FAFC',
    position: 'relative',
  },
  bgDecorTopRight: {
    position: 'absolute',
    top: -60,
    right: -40,
    width: 240,
    height: 180,
    borderRadius: 100,
    backgroundColor: '#DBEAFE',
    opacity: 0.5,
    transform: [{ rotate: '-15deg' }, { scaleX: 1.4 }],
  },
  bgDecorTopLeft: {
    position: 'absolute',
    top: -40,
    left: -60,
    width: 200,
    height: 160,
    borderRadius: 90,
    backgroundColor: '#EFF6FF',
    opacity: 0.7,
    transform: [{ rotate: '20deg' }, { scaleX: 1.3 }],
  },
  bgDecorBottom: {
    position: 'absolute',
    bottom: -70,
    left: -30,
    right: -30,
    height: 150,
    borderRadius: 100,
    backgroundColor: '#DBEAFE',
    opacity: 0.45,
    transform: [{ rotate: '-3deg' }],
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  logoImage: {
    width: 68,
    height: 68,
    borderRadius: 18,
  },
  verticalDivider: {
    width: 1.5,
    height: 48,
    backgroundColor: '#CBD5E1',
    marginHorizontal: 14,
  },
  headerTextGroup: {
    justifyContent: 'center',
  },
  appTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1E3A8A',
    letterSpacing: -0.5,
  },
  appSubtitle: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
    fontWeight: '500',
    marginTop: 2,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 4,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
  },
  inputLeftIcon: {
    marginRight: 8,
  },
  textInputField: {
    flex: 1,
    fontSize: 15,
    color: '#0F172A',
    height: '100%',
  },
  eyeIconBtn: {
    padding: 4,
  },
  helperText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  forgotPasswordRow: {
    alignItems: 'flex-end',
    marginTop: 2,
    marginBottom: 18,
  },
  forgotPasswordText: {
    color: '#1E3A8A',
    fontSize: 13.5,
    fontWeight: '600',
  },
  loginButton: {
    borderRadius: 12,
    paddingVertical: 13,
    backgroundColor: '#1E3A8A',
  },
  dividerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    fontSize: 12.5,
    color: '#64748B',
    paddingHorizontal: 10,
    fontWeight: '500',
  },
  qrButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#1E3A8A',
    borderRadius: 12,
    paddingVertical: 12,
  },
  qrIcon: {
    marginRight: 8,
  },
  qrButtonText: {
    color: '#1E3A8A',
    fontSize: 14.5,
    fontWeight: '700',
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
    textAlign: 'justify',
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
    textAlign: 'justify',
  },
  footerNotice: {
    marginTop: 20,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  noticeText: {
    fontSize: 12.5,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 6,
  },
  noticeSubtext: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    fontWeight: '500',
  },
});

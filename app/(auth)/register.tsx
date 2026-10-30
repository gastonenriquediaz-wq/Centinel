import React, { useState, useEffect } from 'react';
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
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Card } from '../../src/components/ui/Card';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { CoursesService } from '../../src/services/courses.service';
import { supabase } from '../../src/services/supabase';
import { QRValidationResult } from '../../src/types/database.types';

export default function StudentRegisterScreen() {
  const [permission, requestPermission] = useCameraPermissions();

  // Fases: 'scan' (escanear QR) | 'form' (completar datos) | 'success' (aviso de pendiente)
  const [phase, setPhase] = useState<'scan' | 'form' | 'success'>('scan');
  const [qrToken, setQrToken] = useState<string>('');
  const [manualTokenInput, setManualTokenInput] = useState<string>('');
  const [qrInfo, setQrInfo] = useState<QRValidationResult | null>(null);
  const [scanned, setScanned] = useState(false);
  const [validating, setValidating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Protección contra ataques de fuerza bruta / adivinación de códigos
  const [failedAttempts, setFailedAttempts] = useState<number>(0);
  const [lockoutRemaining, setLockoutRemaining] = useState<number>(0);

  // Temporizador para el desbloqueo tras superar el límite de intentos
  useEffect(() => {
    if (lockoutRemaining <= 0) return;
    const interval = setInterval(() => {
      setLockoutRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutRemaining]);

  // Formulario
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dni, setDni] = useState('');
  const [birthDate, setBirthDate] = useState(''); // YYYY-MM-DD
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [registering, setRegistering] = useState(false);

  // Validar token QR o código alfanumérico con protección contra adivinación
  const handleValidateToken = async (token: string) => {
    if (lockoutRemaining > 0) {
      Alert.alert(
        'Límite de intentos alcanzado',
        `Por seguridad, debés esperar ${lockoutRemaining} segundos antes de volver a ingresar otro código.`
      );
      return;
    }

    const trimmed = token.trim();
    if (!trimmed) {
      setErrorMessage('Ingresá o escaneá un código QR o alfanumérico válido.');
      return;
    }

    try {
      setValidating(true);
      setErrorMessage(null);

      const result = await CoursesService.validateQRToken(trimmed);
      if (!result.valid) {
        const nextFailed = failedAttempts + 1;
        setScanned(false);

        if (nextFailed >= 5) {
          setFailedAttempts(0);
          setLockoutRemaining(60);
          setErrorMessage(
            'Has superado el límite de 5 intentos erróneos. Por seguridad contra adivinación de códigos, el ingreso se encuentra bloqueado por 60 segundos.'
          );
          Alert.alert(
            'Límite de seguridad alcanzado',
            'Demasiados intentos fallidos. Por protección de la institución escolar, debés esperar 60 segundos para volver a intentar.'
          );
        } else {
          setFailedAttempts(nextFailed);
          const remaining = 5 - nextFailed;
          setErrorMessage(
            `${result.error || 'Código no válido o expirado.'} (Intentos restantes: ${remaining})`
          );
        }
        return;
      }

      // Validación exitosa: reiniciar contador de fallos
      setFailedAttempts(0);
      setLockoutRemaining(0);
      setQrToken(result.token_for_registration || trimmed);
      setQrInfo(result);
      setPhase('form');
    } catch (err: any) {
      const nextFailed = failedAttempts + 1;
      setScanned(false);
      if (nextFailed >= 5) {
        setFailedAttempts(0);
        setLockoutRemaining(60);
        setErrorMessage(
          'Has superado el límite de 5 intentos erróneos. Ingreso bloqueado temporalmente por 60 segundos.'
        );
      } else {
        setFailedAttempts(nextFailed);
        setErrorMessage(err.message || 'Error al validar el código.');
      }
    } finally {
      setValidating(false);
    }
  };

  const onBarcodeScanned = ({ data }: { data: string }) => {
    if (scanned || validating) return;
    setScanned(true);
    handleValidateToken(data);
  };

  // Enviar formulario de registro (RF-05)
  const handleRegister = async () => {
    setErrorMessage(null);

    if (!firstName.trim() || !lastName.trim()) {
      setErrorMessage('Ingresá tu nombre y apellido reales.');
      return;
    }

    const cleanDni = dni.trim().replace(/\D/g, '');
    if (cleanDni.length < 7 || cleanDni.length > 9) {
      setErrorMessage('Ingresá un DNI válido (entre 7 y 9 dígitos sin puntos).');
      return;
    }

    if (!birthDate.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate.trim())) {
      setErrorMessage('Ingresá tu fecha de nacimiento en formato AAAA-MM-DD (ej: 2008-05-14).');
      return;
    }

    if (!email.trim() || !password) {
      setErrorMessage('Ingresá correo electrónico y contraseña.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Las contraseñas no coinciden.');
      return;
    }

    try {
      setRegistering(true);

      // 1. Crear usuario en Supabase Auth
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
      });

      if (authErr) {
        if (authErr.message.includes('already registered')) {
          throw new Error('El correo electrónico ya se encuentra registrado.');
        }
        throw authErr;
      }

      if (!authData.user) {
        throw new Error('No se pudo crear la cuenta de usuario.');
      }

      // 2. Completar perfil en PostgreSQL via RPC atómica
      const regResult = await CoursesService.completeRegistration({
        userId: authData.user.id,
        token: qrToken,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        dni: cleanDni,
        birthDate: birthDate.trim(),
      });

      if (!regResult.success) {
        throw new Error(regResult.error || 'Error al registrar los datos del estudiante.');
      }

      // Desconectar sesión automática para exigir aprobación posterior (RF-07)
      await supabase.auth.signOut();
      setPhase('success');
    } catch (err: any) {
      const msg = err.message || 'Error al completar el registro.';
      setErrorMessage(msg);
      Alert.alert('No se pudo registrar', msg);
    } finally {
      setRegistering(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardView}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* FASE 1: ESCANEAR O INGRESAR QR */}
        {phase === 'scan' && (
          <Card style={styles.card}>
            <Text style={styles.title}>Incorporación de Estudiante</Text>
            <Text style={styles.subtitle}>
              Escaneá el código QR generado por una autoridad para tu curso o ingresá el código de invitación.
            </Text>

            {errorMessage && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            {/* Visor de Cámara */}
            <View style={styles.cameraBox}>
              {!permission?.granted ? (
                <View style={styles.permissionBox}>
                  <Text style={styles.permissionText}>
                    Se requiere permiso de cámara para escanear el código QR institucional.
                  </Text>
                  <Button
                    title="Permitir Cámara"
                    onPress={requestPermission}
                    style={styles.permissionBtn}
                  />
                </View>
              ) : (
                <CameraView
                  style={StyleSheet.absoluteFill}
                  barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                  onBarcodeScanned={scanned ? undefined : onBarcodeScanned}
                />
              )}
            </View>

            {validating && (
              <View style={styles.validatingRow}>
                <Text style={styles.validatingText}>Verificando código con el colegio...</Text>
              </View>
            )}

            {/* Alternativa de ingreso manual (código alfanumérico de 10 caracteres o token QR) */}
            <View style={styles.manualSection}>
              <Text style={styles.manualLabel}>¿Tenés el código alfanumérico del curso o del QR?</Text>
              <Input
                placeholder="Ej: 7K8M9P2R4X o código QR"
                value={manualTokenInput}
                onChangeText={setManualTokenInput}
                autoCapitalize="characters"
                editable={lockoutRemaining === 0}
              />
              {lockoutRemaining > 0 ? (
                <View style={styles.lockoutBadge}>
                  <Text style={styles.lockoutText}>
                    Bloqueo temporal de seguridad: reintento en {lockoutRemaining}s
                  </Text>
                </View>
              ) : failedAttempts > 0 ? (
                <Text style={styles.attemptsText}>
                  Intentos fallidos: {failedAttempts}/5 (máximo 5 antes del bloqueo)
                </Text>
              ) : null}
              <Button
                title={lockoutRemaining > 0 ? `Bloqueado (${lockoutRemaining}s)` : "Validar Código Manualmente"}
                variant="secondary"
                onPress={() => handleValidateToken(manualTokenInput)}
                loading={validating}
                disabled={lockoutRemaining > 0}
              />
            </View>

            <Button
              title="Volver al Inicio"
              variant="outline"
              onPress={() => router.back()}
              style={styles.backButton}
            />
          </Card>
        )}

        {/* FASE 2: FORMULARIO DE DATOS REALES (RF-05) */}
        {phase === 'form' && qrInfo && (
          <Card style={styles.card}>
            <View style={styles.instBanner}>
              <Text style={styles.instLabel}>Institución:</Text>
              <Text style={styles.instName}>{qrInfo.institution_name}</Text>
              <Text style={styles.courseBadge}>Curso: {qrInfo.course_name}</Text>
            </View>

            <Text style={styles.formTitle}>Completar Registro</Text>
            <Text style={styles.formSub}>
              Ingresá tus datos reales. Esta cuenta deberá ser aprobada por una autoridad de tu colegio.
            </Text>

            {errorMessage && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            <Input
              label="Nombre(s) *"
              placeholder="Ej: Juan Martín"
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
            />

            <Input
              label="Apellido(s) *"
              placeholder="Ej: Gómez"
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="words"
            />

            <Input
              label="Documento Nacional de Identidad (DNI) *"
              placeholder="Ej: 45123456 (sin puntos)"
              value={dni}
              onChangeText={setDni}
              keyboardType="numeric"
            />

            <Input
              label="Fecha de Nacimiento (AAAA-MM-DD) *"
              placeholder="Ej: 2008-04-20"
              value={birthDate}
              onChangeText={setBirthDate}
            />

            <Input
              label="Correo electrónico *"
              placeholder="tucorreo@ejemplo.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Input
              label="Contraseña *"
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <Input
              label="Confirmar contraseña *"
              placeholder="Repetí la contraseña"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />

            <Button
              title="Enviar Solicitud de Registro"
              onPress={handleRegister}
              loading={registering}
              style={styles.submitButton}
            />

            <Button
              title="Cancelar"
              variant="outline"
              onPress={() => {
                setPhase('scan');
                setScanned(false);
                setErrorMessage(null);
              }}
              style={styles.cancelBtn}
            />
          </Card>
        )}

        {/* FASE 3: AVISO DE SOLICITUD PENDIENTE */}
        {phase === 'success' && (
          <Card style={styles.card}>
            <View style={styles.successIconBox}>
              <Text style={styles.checkIcon}>✓</Text>
            </View>
            <Text style={styles.successTitle}>Solicitud Enviada</Text>
            <Text style={styles.successBody}>
              Tu solicitud de registro ha sido vinculada al curso solicitado en tu institución.
            </Text>
            <View style={styles.infoAlert}>
              <Text style={styles.infoAlertTitle}>Cuenta en estado Pendiente (RF-07)</Text>
              <Text style={styles.infoAlertText}>
                Las autoridades del colegio (director o vicedirector) verificarán tus datos en los registros institucionales para habilitar tu acceso.
              </Text>
            </View>

            <Button
              title="Ir a Iniciar Sesión"
              onPress={() => router.replace('/(auth)/login')}
              style={styles.backToLoginBtn}
            />
          </Card>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 16,
    flexGrow: 1,
    justifyContent: 'center',
  },
  card: {
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'justify',
    marginBottom: 16,
    lineHeight: 18,
  },
  cameraBox: {
    width: '100%',
    height: 240,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    marginBottom: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionBox: {
    padding: 20,
    alignItems: 'center',
  },
  permissionText: {
    color: '#FFFFFF',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
  },
  permissionBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  validatingRow: {
    padding: 10,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  validatingText: {
    color: '#1E3A8A',
    fontSize: 13,
    fontWeight: '600',
  },
  manualSection: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 14,
    marginBottom: 12,
  },
  manualLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
    textAlign: 'center',
  },
  lockoutBadge: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#F87171',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    alignItems: 'center',
  },
  lockoutText: {
    color: '#991B1B',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  attemptsText: {
    color: '#D97706',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  backButton: {
    marginTop: 8,
  },
  instBanner: {
    backgroundColor: '#EFF6FF',
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: 16,
    alignItems: 'center',
  },
  instLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  instName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E3A8A',
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 4,
  },
  courseBadge: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1D4ED8',
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  formSub: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 16,
    lineHeight: 16,
    textAlign: 'justify',
  },
  submitButton: {
    marginTop: 10,
  },
  cancelBtn: {
    marginTop: 8,
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderColor: '#F87171',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
  },
  errorText: {
    color: '#991B1B',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'justify',
  },
  successIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  checkIcon: {
    fontSize: 32,
    color: '#166534',
    fontWeight: '800',
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  successBody: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'justify',
    lineHeight: 20,
    marginBottom: 20,
  },
  infoAlert: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FCD34D',
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    marginBottom: 24,
  },
  infoAlertTitle: {
    color: '#92400E',
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 4,
  },
  infoAlertText: {
    color: '#B45309',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'justify',
  },
  backToLoginBtn: {
    width: '100%',
  },
});

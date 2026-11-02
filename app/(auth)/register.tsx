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
  TextInput,
  ActivityIndicator,
  Modal,
  PanResponder,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Card } from '../../src/components/ui/Card';
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

  // Protección contra intentos fallidos
  const [failedAttempts, setFailedAttempts] = useState<number>(0);
  const [lockoutRemaining, setLockoutRemaining] = useState<number>(0);

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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [registering, setRegistering] = useState(false);

  // Modal para selección de fecha de nacimiento
  const [dateModalVisible, setDateModalVisible] = useState(false);
  const [tempDay, setTempDay] = useState<number>(0); // 0 muestra "00"
  const [tempMonth, setTempMonth] = useState<string>('05');
  const [tempYear, setTempYear] = useState<number>(2000);

  const MONTHS = [
    { label: 'Enero', value: '01' },
    { label: 'Febrero', value: '02' },
    { label: 'Marzo', value: '03' },
    { label: 'Abril', value: '04' },
    { label: 'Mayo', value: '05' },
    { label: 'Junio', value: '06' },
    { label: 'Julio', value: '07' },
    { label: 'Agosto', value: '08' },
    { label: 'Septiembre', value: '09' },
    { label: 'Octubre', value: '10' },
    { label: 'Noviembre', value: '11' },
    { label: 'Diciembre', value: '12' },
  ];

  const getDaysInMonth = (monthStr: string, yearNum: number) => {
    const m = parseInt(monthStr, 10);
    if (isNaN(m) || m < 1 || m > 12) return 31;
    return new Date(yearNum || 2000, m, 0).getDate();
  };

  const dayRef = React.useRef(tempDay);
  dayRef.current = tempDay;
  const yearRef = React.useRef(tempYear);
  yearRef.current = tempYear;
  const monthRef = React.useRef(tempMonth);
  monthRef.current = tempMonth;

  // Desplazamiento gestual para Día (deslizar abajo incrementa, deslizar arriba decrementa)
  const dayPanResponder = React.useMemo(() => {
    let startVal = 0;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 2,
      onPanResponderGrant: () => {
        startVal = dayRef.current;
      },
      onPanResponderMove: (_, gesture) => {
        const step = 12; // píxeles por unidad
        const diff = Math.floor(gesture.dy / step);
        const maxDays = getDaysInMonth(monthRef.current, yearRef.current);
        let target = (startVal === 0 ? 1 : startVal) + diff;
        if (target < 1) target = 1;
        if (target > maxDays) target = maxDays;
        setTempDay(target);
      },
    });
  }, []);

  // Desplazamiento gestual para Año (deslizar abajo incrementa, deslizar arriba decrementa)
  const yearPanResponder = React.useMemo(() => {
    let startVal = 2000;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 2,
      onPanResponderGrant: () => {
        startVal = yearRef.current;
      },
      onPanResponderMove: (_, gesture) => {
        const step = 8; // píxeles por año
        const diff = Math.floor(gesture.dy / step);
        const currentYear = new Date().getFullYear();
        const minYear = currentYear - 100;
        let target = startVal + diff;
        if (target < minYear) target = minYear;
        if (target > currentYear) target = currentYear;
        setTempYear(target);
      },
    });
  }, []);

  const openDateModal = () => {
    if (birthDate) {
      const parts = birthDate.split('-');
      if (parts.length === 3) {
        setTempYear(parseInt(parts[0], 10) || 2000);
        setTempMonth(parts[1] || '05');
        setTempDay(parseInt(parts[2], 10) || 0);
      }
    } else {
      setTempDay(0); // Inicia en 00
      setTempMonth('05');
      setTempYear(2000); // Inicia en 2000
    }
    setDateModalVisible(true);
  };

  const handleSelectMonth = (monthVal: string) => {
    setTempMonth(monthVal);
    const maxDays = getDaysInMonth(monthVal, tempYear);
    if (tempDay > maxDays) {
      setTempDay(maxDays);
    }
  };

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
            'Has superado el límite de 5 intentos erróneos. El ingreso se encuentra bloqueado por 60 segundos.'
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

  const handleConfirmDate = () => {
    const currentYear = new Date().getFullYear();
    const minYear = currentYear - 100;
    const maxDays = getDaysInMonth(tempMonth, tempYear);

    if (tempDay === 0 || tempDay < 1 || tempDay > maxDays) {
      Alert.alert(
        'Día requerido',
        `Por favor seleccioná un día válido entre 1 y ${maxDays} desplazando el control o usando las flechas.`
      );
      return;
    }

    if (tempYear < minYear || tempYear > currentYear) {
      Alert.alert(
        'Año inválido',
        `El año de nacimiento debe estar entre ${minYear} y ${currentYear} (la edad no puede superar los 100 años ni ser una fecha futura).`
      );
      return;
    }

    const formattedDay = tempDay.toString().padStart(2, '0');
    const isoDate = `${tempYear}-${tempMonth}-${formattedDay}`;
    setBirthDate(isoDate);
    setDateModalVisible(false);
  };

  const formatDisplayBirthDate = (isoStr: string) => {
    if (!isoStr) return '';
    try {
      const [y, m, d] = isoStr.split('-');
      const monthObj = MONTHS.find((item) => item.value === m);
      const mName = monthObj ? monthObj.label.toLowerCase() : m;
      return `${parseInt(d, 10)} de ${mName} de ${y}`;
    } catch {
      return isoStr;
    }
  };

  // Enviar formulario de registro
  const handleRegister = async () => {
    setErrorMessage(null);

    if (!firstName.trim() || !lastName.trim()) {
      setErrorMessage('Ingresá tu nombre y apellido reales.');
      Alert.alert('Campo requerido', 'Ingresá tu nombre y apellido reales.');
      return;
    }

    const cleanDni = dni.trim().replace(/\D/g, '');
    if (cleanDni.length < 7 || cleanDni.length > 9) {
      setErrorMessage('Ingresá un DNI válido (entre 7 y 9 dígitos sin puntos).');
      Alert.alert('DNI inválido', 'Ingresá un DNI válido (entre 7 y 9 dígitos sin puntos).');
      return;
    }

    if (!birthDate.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate.trim())) {
      setErrorMessage('Seleccioná tu fecha de nacimiento.');
      Alert.alert('Fecha de nacimiento requerida', 'Por favor seleccioná tu fecha de nacimiento.');
      return;
    }

    if (!email.trim() || !password) {
      setErrorMessage('Ingresá correo electrónico y contraseña.');
      Alert.alert('Campos requeridos', 'Ingresá correo electrónico y contraseña.');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('La contraseña debe tener al menos 8 caracteres.');
      Alert.alert('Contraseña débil', 'La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Las contraseñas no coinciden.');
      Alert.alert('Contraseñas no coinciden', 'Por favor verificá que ambas contraseñas sean iguales.');
      return;
    }

    try {
      setRegistering(true);

      // 1. Crear usuario en Supabase Auth
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
      });

      // Detección precisa de correo electrónico duplicado
      if (authErr) {
        const errLower = authErr.message.toLowerCase();
        if (
          errLower.includes('already registered') ||
          errLower.includes('already exists') ||
          errLower.includes('user already exists') ||
          authErr.status === 422
        ) {
          const msg = 'El correo electrónico ya se encuentra en uso por otro usuario.';
          setErrorMessage(msg);
          Alert.alert('No se puede registrar', msg);
          return;
        }
        throw authErr;
      }

      // En Supabase con "prevent user enumeration", si el email ya existe retorna identities vacío
      if (authData.user && authData.user.identities && authData.user.identities.length === 0) {
        const msg = 'El correo electrónico ya se encuentra en uso por otro usuario.';
        setErrorMessage(msg);
        Alert.alert('No se puede registrar', msg);
        return;
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
        await supabase.auth.signOut();

        const errMsg = regResult.error || '';
        if (
          errMsg.toLowerCase().includes('documento') ||
          errMsg.toLowerCase().includes('dni') ||
          errMsg.toLowerCase().includes('registrado')
        ) {
          const msg = 'El Documento Nacional de Identidad (DNI) ya se encuentra en uso por otro usuario.';
          setErrorMessage(msg);
          Alert.alert('No se puede registrar', msg);
          return;
        }

        throw new Error(errMsg || 'Error al registrar los datos del estudiante.');
      }

      // Desconectar sesión automática para exigir aprobación posterior por autoridad escolar
      await supabase.auth.signOut();
      setPhase('success');
    } catch (err: any) {
      await supabase.auth.signOut().catch(() => {});
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
      <Stack.Screen
        options={{
          title: 'Registro de Estudiante',
          headerStyle: { backgroundColor: '#1E3A8A' },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: '700' },
        }}
      />

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
                <ActivityIndicator size="small" color="#1E3A8A" style={{ marginRight: 8 }} />
                <Text style={styles.validatingText}>Verificando código con el colegio...</Text>
              </View>
            )}

            <View style={styles.manualSection}>
              <Text style={styles.manualLabel}>¿Tenés el código alfanumérico del curso o del QR?</Text>
              <TextInput
                style={styles.manualInput}
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

        {/* FASE 2: FORMULARIO DE REGISTRO (IDENTICO AL MOCKUP) */}
        {phase === 'form' && qrInfo && (
          <View style={styles.formContainer}>
            {/* Banner Superior de Institución y Código Validado */}
            <View style={styles.topBannerCard}>
              {/* Badge superior Código validado */}
              <View style={styles.validBadgeRow}>
                <View style={styles.validBadge}>
                  <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
                  <Text style={styles.validBadgeText}>Código validado</Text>
                </View>
              </View>

              {/* Institución y Curso */}
              <View style={styles.instRow}>
                <View style={styles.schoolIconWrap}>
                  <Ionicons name="business-outline" size={24} color="#1E3A8A" />
                </View>
                <View style={styles.instTextCol}>
                  <Text style={styles.instLabel}>Institución:</Text>
                  <Text style={styles.instName}>{qrInfo.institution_name}</Text>
                  <Text style={styles.courseBadge}>Curso: {qrInfo.course_name}</Text>
                </View>
              </View>

              {/* Línea divisoria */}
              <View style={styles.bannerDivider} />

              {/* Mensaje de vinculación automática */}
              <View style={styles.bannerNoticeRow}>
                <Ionicons name="information-circle-outline" size={16} color="#2563EB" />
                <Text style={styles.bannerNoticeText}>
                  Estos datos se asociaron automáticamente al código utilizado.
                </Text>
              </View>
            </View>

            {/* Cabecera del Formulario */}
            <Text style={styles.formMainTitle}>Completar registro</Text>
            <Text style={styles.formSubtitle}>
              Ingresá tus datos reales. La cuenta quedará pendiente de aprobación por una autoridad educativa de tu colegio.
            </Text>

            {errorMessage && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            {/* Campos del Formulario con Íconos */}

            {/* Nombre(s) */}
            <Text style={styles.fieldLabel}>Nombre(s) *</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={18} color="#64748B" style={styles.fieldIcon} />
              <TextInput
                style={styles.fieldInput}
                placeholder="Ej.: Juan Martín"
                placeholderTextColor="#94A3B8"
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
              />
            </View>

            {/* Apellido(s) */}
            <Text style={styles.fieldLabel}>Apellido(s) *</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={18} color="#64748B" style={styles.fieldIcon} />
              <TextInput
                style={styles.fieldInput}
                placeholder="Ej.: Gómez"
                placeholderTextColor="#94A3B8"
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
              />
            </View>

            {/* Documento Nacional de Identidad (DNI) */}
            <Text style={styles.fieldLabel}>Documento Nacional de Identidad (DNI) *</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="id-card-outline" size={18} color="#64748B" style={styles.fieldIcon} />
              <TextInput
                style={styles.fieldInput}
                placeholder="Ej.: 45123456 (sin puntos)"
                placeholderTextColor="#94A3B8"
                value={dni}
                onChangeText={setDni}
                keyboardType="numeric"
              />
            </View>

            {/* Fecha de nacimiento */}
            <Text style={styles.fieldLabel}>Fecha de nacimiento *</Text>
            <TouchableOpacity
              style={styles.inputContainer}
              onPress={openDateModal}
              activeOpacity={0.7}
            >
              <Ionicons name="calendar-outline" size={18} color="#64748B" style={styles.fieldIcon} />
              <Text style={[styles.fieldInput, !birthDate && styles.placeholderText]}>
                {birthDate ? formatDisplayBirthDate(birthDate) : 'Seleccionar fecha'}
              </Text>
            </TouchableOpacity>

            {/* Correo electrónico */}
            <Text style={styles.fieldLabel}>Correo electrónico *</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={18} color="#64748B" style={styles.fieldIcon} />
              <TextInput
                style={styles.fieldInput}
                placeholder="tucorreo@ejemplo.com"
                placeholderTextColor="#94A3B8"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            <Text style={styles.helperText}>
              Usá un correo al que tengas acceso. Lo necesitarás para iniciar sesión y recuperar tu contraseña.
            </Text>

            {/* Contraseña */}
            <Text style={styles.fieldLabel}>Contraseña *</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={18} color="#64748B" style={styles.fieldIcon} />
              <TextInput
                style={styles.fieldInput}
                placeholder="Mínimo 8 caracteres"
                placeholderTextColor="#94A3B8"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#64748B"
                />
              </TouchableOpacity>
            </View>

            {/* Confirmar contraseña */}
            <Text style={styles.fieldLabel}>Confirmar contraseña *</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={18} color="#64748B" style={styles.fieldIcon} />
              <TextInput
                style={styles.fieldInput}
                placeholder="Repetí la contraseña"
                placeholderTextColor="#94A3B8"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#64748B"
                />
              </TouchableOpacity>
            </View>

            {/* Botones de acción */}
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleRegister}
              disabled={registering}
            >
              {registering ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.submitBtnText}>Enviar solicitud de registro</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => {
                setPhase('scan');
                setScanned(false);
                setErrorMessage(null);
              }}
              disabled={registering}
            >
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>

            {/* Nota final */}
            <View style={styles.footerNoteRow}>
              <Ionicons name="information-circle-outline" size={16} color="#64748B" />
              <Text style={styles.footerNoteText}>
                La solicitud será revisada por una autoridad educativa antes de habilitar el acceso.
              </Text>
            </View>
          </View>
        )}

        {/* FASE 3: AVISO DE SOLICITUD PENDIENTE */}
        {phase === 'success' && (
          <Card style={styles.card}>
            <View style={styles.successIconBox}>
              <Ionicons name="checkmark-circle" size={48} color="#16A34A" />
            </View>
            <Text style={styles.successTitle}>Solicitud Enviada</Text>
            <Text style={styles.successBody}>
              Tu solicitud de registro ha sido vinculada al curso solicitado en tu institución.
            </Text>
            <View style={styles.infoAlert}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <Ionicons name="time-outline" size={18} color="#92400E" style={{ marginRight: 6 }} />
                <Text style={styles.infoAlertTitle}>Cuenta pendiente de aprobación</Text>
              </View>
              <Text style={styles.infoAlertText}>
                Las autoridades del colegio verificarán tus datos en los registros institucionales para habilitar tu acceso. Cuando intentés ingresar, la app te notificará si la cuenta continúa en revisión.
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

      {/* Modal para selección interactiva de fecha de nacimiento */}
      <Modal
        visible={dateModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Fecha de nacimiento</Text>
              <TouchableOpacity
                onPress={() => setDateModalVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Ingresá tu día, mes y año de nacimiento:
            </Text>

            <View style={styles.dateInputsRow}>
              {/* Selector táctil de Día */}
              <View style={styles.dateColDay}>
                <Text style={styles.dateInputLabel}>Día</Text>
                <View style={styles.stepperContainer}>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => {
                      const maxDays = getDaysInMonth(tempMonth, tempYear);
                      setTempDay((prev) => (prev === 0 ? 1 : Math.min(maxDays, prev + 1)));
                    }}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    activeOpacity={0.6}
                  >
                    <Ionicons name="chevron-up" size={18} color="#1E3A8A" />
                  </TouchableOpacity>

                  <View {...dayPanResponder.panHandlers} style={styles.stepperValueBox}>
                    <Text style={styles.stepperValueText}>
                      {tempDay === 0 ? '00' : tempDay.toString().padStart(2, '0')}
                    </Text>
                    <Text style={styles.stepperDragHint}>↕ deslizar</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => {
                      setTempDay((prev) => Math.max(1, (prev === 0 ? 1 : prev) - 1));
                    }}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    activeOpacity={0.6}
                  >
                    <Ionicons name="chevron-down" size={18} color="#1E3A8A" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Selector de Mes (Cuadrícula de 12 meses) */}
              <View style={styles.dateColMonth}>
                <Text style={styles.dateInputLabel}>Mes</Text>
                <View style={styles.monthChipsWrap}>
                  {MONTHS.map((m) => {
                    const isSelected = tempMonth === m.value;
                    return (
                      <TouchableOpacity
                        key={m.value}
                        style={[styles.monthChip, isSelected && styles.monthChipSelected]}
                        onPress={() => handleSelectMonth(m.value)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.monthChipText, isSelected && styles.monthChipTextSelected]}>
                          {m.label.substring(0, 3)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Selector táctil de Año */}
              <View style={styles.dateColYear}>
                <Text style={styles.dateInputLabel}>Año</Text>
                <View style={styles.stepperContainer}>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => {
                      const currentYear = new Date().getFullYear();
                      setTempYear((prev) => Math.min(currentYear, prev + 1));
                    }}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    activeOpacity={0.6}
                  >
                    <Ionicons name="chevron-up" size={18} color="#1E3A8A" />
                  </TouchableOpacity>

                  <View {...yearPanResponder.panHandlers} style={styles.stepperValueBox}>
                    <Text style={styles.stepperValueText}>{tempYear}</Text>
                    <Text style={styles.stepperDragHint}>↕ deslizar</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => {
                      const currentYear = new Date().getFullYear();
                      const minYear = currentYear - 100;
                      setTempYear((prev) => Math.max(minYear, prev - 1));
                    }}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    activeOpacity={0.6}
                  >
                    <Ionicons name="chevron-down" size={18} color="#1E3A8A" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setDateModalVisible(false)}
              >
                <Text style={styles.modalCancelBtnText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleConfirmDate}
              >
                <Text style={styles.modalConfirmBtnText}>Confirmar fecha</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  formContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  topBannerCard: {
    backgroundColor: '#F0F7FF',
    borderWidth: 1,
    borderColor: '#D0E3F7',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  validBadgeRow: {
    alignItems: 'center',
    marginBottom: 12,
  },
  validBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    gap: 6,
  },
  validBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#15803D',
  },
  instRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  schoolIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#E0EDFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  instTextCol: {
    flex: 1,
  },
  instLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  instName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0F172A',
    lineHeight: 20,
  },
  courseBadge: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
    marginTop: 2,
  },
  bannerDivider: {
    height: 1,
    backgroundColor: '#DCEBFA',
    marginVertical: 12,
  },
  bannerNoticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bannerNoticeText: {
    flex: 1,
    fontSize: 12,
    color: '#475569',
    fontStyle: 'italic',
  },
  formMainTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 4,
  },
  formSubtitle: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
    marginTop: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  fieldIcon: {
    marginRight: 8,
  },
  fieldInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
  },
  placeholderText: {
    color: '#94A3B8',
  },
  helperText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    lineHeight: 16,
  },
  submitBtn: {
    backgroundColor: '#1E3A8A',
    borderRadius: 10,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  cancelBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#1E3A8A',
    borderRadius: 10,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cancelBtnText: {
    color: '#1E3A8A',
    fontSize: 15,
    fontWeight: '700',
  },
  footerNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
    marginTop: 4,
  },
  footerNoteText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    flex: 1,
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
    marginBottom: 16,
  },
  permissionBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  permissionText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 14,
    marginBottom: 12,
  },
  permissionBtn: {
    minWidth: 160,
  },
  validatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  validatingText: {
    fontSize: 13,
    color: '#1E3A8A',
    fontWeight: '600',
  },
  manualSection: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 16,
  },
  manualLabel: {
    fontSize: 13,
    color: '#334155',
    marginBottom: 8,
    fontWeight: '600',
  },
  manualInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#0F172A',
    marginBottom: 10,
  },
  lockoutBadge: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
  },
  lockoutText: {
    color: '#B91C1C',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
  attemptsText: {
    fontSize: 12,
    color: '#D97706',
    marginBottom: 8,
    textAlign: 'center',
    fontWeight: '500',
  },
  backButton: {
    marginTop: 12,
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderColor: '#F87171',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 13,
    textAlign: 'center',
  },
  successIconBox: {
    alignItems: 'center',
    marginBottom: 12,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  successBody: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  infoAlert: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FCD34D',
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
  },
  infoAlertTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#92400E',
  },
  infoAlertText: {
    fontSize: 13,
    color: '#B45309',
    lineHeight: 18,
  },
  backToLoginBtn: {
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 380,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 14,
  },
  dateInputsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  dateColDay: {
    width: 66,
  },
  dateColMonth: {
    flex: 1,
  },
  dateColYear: {
    width: 76,
  },
  dateInputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
    textAlign: 'center',
  },
  stepperContainer: {
    alignItems: 'center',
    gap: 3,
  },
  stepperBtn: {
    width: '100%',
    height: 30,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValueBox: {
    width: '100%',
    height: 52,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  stepperValueText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  stepperDragHint: {
    fontSize: 9,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 1,
  },
  monthChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    justifyContent: 'center',
  },
  monthChip: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
  },
  monthChipSelected: {
    backgroundColor: '#1E3A8A',
    borderColor: '#1E3A8A',
  },
  monthChipText: {
    fontSize: 10,
    color: '#475569',
  },
  monthChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  modalCancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  modalConfirmBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: '#1E3A8A',
  },
  modalConfirmBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});

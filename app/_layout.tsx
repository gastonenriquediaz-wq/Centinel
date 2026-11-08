import React, { useEffect, useRef, useCallback } from 'react';
import { Alert, Platform, AppState, AppStateStatus, View } from 'react-native';
import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '../src/store/auth.store';
import { AuthService } from '../src/services/auth.service';
import { supabase } from '../src/services/supabase';

// Tiempo máximo de inactividad antes del auto-logout (5 minutos = 300.000 ms)
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;

// Polyfill de Alert.alert para navegadores Web
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  Alert.alert = (title: string, message?: string, buttons?: any[]) => {
    const fullText = [title, message].filter(Boolean).join('\n\n');
    if (!buttons || buttons.length === 0) {
      window.alert(fullText);
      return;
    }
    if (buttons.length === 1) {
      window.alert(fullText);
      buttons[0]?.onPress?.();
      return;
    }
    const cancelBtn = buttons.find((b) => b.style === 'cancel');
    const confirmBtn = buttons.find((b) => b.style !== 'cancel') || buttons[buttons.length - 1];
    const confirmed = window.confirm(fullText);
    if (confirmed) {
      confirmBtn?.onPress?.();
    } else {
      cancelBtn?.onPress?.();
    }
  };
}

export default function RootLayout() {
  const segments = useSegments();
  const {
    setSession,
    setProfile,
    setLoading,
    reset,
    profile,
    session,
    isLoading,
    setSessionTimeoutMessage,
  } = useAuthStore();

  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const appStateRef = useRef<AppStateStatus>((AppState.currentState as AppStateStatus) || 'active');
  const backgroundTimeRef = useRef<number | null>(null);

  // Función para cerrar la sesión por inactividad
  const logoutDueToInactivity = useCallback(async () => {
    if (!useAuthStore.getState().session) return;

    try {
      await AuthService.signOut();
    } catch {}

    reset();
    setSessionTimeoutMessage(
      'Tu sesión se cerró automáticamente tras 5 minutos de inactividad para proteger tu privacidad.'
    );
    router.replace('/(auth)/login');
  }, [reset, setSessionTimeoutMessage]);

  // Reiniciar el contador de inactividad de 5 minutos
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }

    // Solo activamos temporizador si hay una sesión activa
    if (useAuthStore.getState().session) {
      inactivityTimerRef.current = setTimeout(() => {
        logoutDueToInactivity();
      }, INACTIVITY_TIMEOUT_MS);
    }
  }, [logoutDueToInactivity]);

  // Detector de toque global para reiniciar inactividad
  const handleTouchActivity = () => {
    resetInactivityTimer();
  };

  // Escuchar cuando la app pasa a segundo plano o vuelve al primer plano
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const currentSession = useAuthStore.getState().session;

      // 1. Cuando la app pasa a segundo plano (background) o pantalla bloqueada
      if (
        appStateRef.current === 'active' &&
        (nextAppState === 'background' || nextAppState === 'inactive')
      ) {
        if (currentSession) {
          backgroundTimeRef.current = Date.now();
        }
        if (inactivityTimerRef.current) {
          clearTimeout(inactivityTimerRef.current);
        }
      }

      // 2. Cuando la app vuelve al primer plano (active)
      if (appStateRef.current !== 'active' && nextAppState === 'active') {
        if (currentSession && backgroundTimeRef.current !== null) {
          const elapsed = Date.now() - backgroundTimeRef.current;
          backgroundTimeRef.current = null;

          const { isNativeDialogOpen, suppressAutoLogoutUntil } = useAuthStore.getState();
          const isDialogProtected = isNativeDialogOpen || Date.now() <= suppressAutoLogoutUntil;

          if (elapsed >= INACTIVITY_TIMEOUT_MS && !isDialogProtected) {
            logoutDueToInactivity();
            appStateRef.current = nextAppState;
            return;
          }
        }
        // Si regresó dentro de la ventana de 5 minutos, reactivamos el temporizador de interacción
        if (currentSession) {
          resetInactivityTimer();
        }
      }

      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [logoutDueToInactivity, resetInactivityTimer]);

  // Gestionar el temporizador cuando cambia el estado de sesión
  useEffect(() => {
    if (session) {
      resetInactivityTimer();
    } else {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      backgroundTimeRef.current = null;
    }
    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [session, resetInactivityTimer]);

  // Guarda global de navegación reactiva por roles y estado de cuenta
  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inStudentGroup = segments[0] === '(student)';
    const inAuthorityGroup = segments[0] === '(authority)';

    if (!session || !profile || profile.account_status !== 'approved') {
      if (inStudentGroup || inAuthorityGroup) {
        router.replace('/(auth)/login');
      }
    } else {
      if (inAuthGroup) {
        if (profile.role === 'student') {
          router.replace('/(student)');
        } else if (profile.role === 'authority') {
          router.replace('/(authority)');
        }
      } else if (inStudentGroup && profile.role !== 'student') {
        router.replace('/(authority)');
      } else if (inAuthorityGroup && profile.role !== 'authority') {
        router.replace('/(student)');
      }
    }
  }, [session, profile, segments, isLoading]);

  useEffect(() => {
    // 1. Verificar sesión persistida
    const initAuth = async () => {
      try {
        setLoading(true);
        const session = await AuthService.getSession();
        if (session?.user) {
          try {
            const { profile: userProfile, institution, course } = await AuthService.getProfile(
              session.user.id
            );
            if (userProfile.account_status === 'approved') {
              setSession(session);
              setProfile(userProfile, institution, course);
              if (userProfile.role === 'student') {
                router.replace('/(student)');
              } else if (userProfile.role === 'authority') {
                router.replace('/(authority)');
              }
              return;
            } else {
              // Si la cuenta no está aprobada, limpiar sesión
              await AuthService.signOut();
              reset();
              router.replace('/(auth)/login');
              return;
            }
          } catch {
            reset();
            router.replace('/(auth)/login');
            return;
          }
        }
        reset();
        router.replace('/(auth)/login');
      } catch {
        reset();
        router.replace('/(auth)/login');
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // 2. Suscribirse a cambios de estado de autenticación de Supabase
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        // Solo limpiamos el store; la guarda reactiva de navegación redirigirá a /(auth)/login
        // únicamente si el usuario estaba dentro de /(student) o /(authority), evitando
        // expulsar al estudiante de /(auth)/register tras completar su registro.
        reset();
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <View
        style={{ flex: 1 }}
        onStartShouldSetResponderCapture={() => {
          handleTouchActivity();
          return false; // Permite que los toques sigan fluyendo normalmente a los botones e inputs
        }}
      >
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: '#1E3A8A' },
            headerTintColor: '#FFFFFF',
            headerTitleStyle: { fontWeight: 'bold' },
          }}
        >
          {/* Rutas de Autenticación */}
          <Stack.Screen
            name="(auth)/login"
            options={{ title: 'Centinel - Acceso', headerShown: false }}
          />
          <Stack.Screen
            name="(auth)/register"
            options={{ title: 'Registro de Estudiante', headerShown: true }}
          />
          <Stack.Screen
            name="(auth)/forgot-password"
            options={{ title: 'Recuperar acceso', headerShown: true }}
          />

          {/* Rutas de Estudiante */}
          <Stack.Screen
            name="(student)/index"
            options={{ title: 'Centinel', headerShown: true }}
          />
          <Stack.Screen
            name="(student)/reports/index"
            options={{ title: 'Mis reportes', headerShown: true }}
          />
          <Stack.Screen
            name="(student)/reports/new"
            options={{ title: 'Nuevo reporte', headerShown: false }}
          />
          <Stack.Screen
            name="(student)/reports/[id]/index"
            options={{ title: 'Detalle de Reporte', headerShown: true }}
          />
          <Stack.Screen
            name="(student)/reports/[id]/chat"
            options={{ title: 'Comunicación con Autoridades', headerShown: true }}
          />
          <Stack.Screen
            name="(student)/education/index"
            options={{ title: 'Módulo Educativo', headerShown: true }}
          />
          <Stack.Screen
            name="(student)/education/[id]"
            options={{ title: 'Módulo Educativo', headerShown: true }}
          />

          {/* Rutas de Autoridad Educativa */}
          <Stack.Screen
            name="(authority)/index"
            options={{ title: 'Centinel', headerShown: true }}
          />
          <Stack.Screen
            name="(authority)/reports/index"
            options={{ title: 'Reportes recibidos', headerShown: true }}
          />
          <Stack.Screen
            name="(authority)/reports/[id]/index"
            options={{ title: 'Detalle del reporte', headerShown: true }}
          />
          <Stack.Screen
            name="(authority)/reports/[id]/chat"
            options={{ title: 'Comunicación con Estudiante', headerShown: true }}
          />
          <Stack.Screen
            name="(authority)/reports/[id]/link-case"
            options={{ title: 'Vincular a caso existente', headerShown: true }}
          />
          <Stack.Screen
            name="(authority)/cases/index"
            options={{ title: 'Casos y Protocolos', headerShown: true }}
          />
          <Stack.Screen
            name="(authority)/cases/new"
            options={{ title: 'Crear caso', headerShown: true }}
          />
          <Stack.Screen
            name="(authority)/cases/[id]/index"
            options={{ title: 'Expediente de Caso', headerShown: true }}
          />
          <Stack.Screen
            name="(authority)/cases/[id]/history"
            options={{ title: 'Historial de operaciones', headerShown: true }}
          />
          <Stack.Screen
            name="(authority)/cases/[id]/acts/new"
            options={{ title: 'Registrar actuación en el caso', headerShown: true }}
          />
          <Stack.Screen
            name="(authority)/cases/[id]/acts/[actId]"
            options={{ title: 'Detalle de la Actuación', headerShown: true }}
          />
          <Stack.Screen
            name="(authority)/courses/index"
            options={{ title: 'Cursos y Códigos QR/Alfanuméricos', headerShown: true }}
          />
          <Stack.Screen
            name="(authority)/courses/new"
            options={{ title: 'Nuevo Curso', headerShown: true }}
          />
          <Stack.Screen
            name="(authority)/courses/[id]/qr"
            options={{ title: 'Código QR de Curso', headerShown: true }}
          />
          <Stack.Screen
            name="(authority)/courses/[id]/code"
            options={{ title: 'Código de Registro', headerShown: true }}
          />
          <Stack.Screen
            name="(authority)/courses/[id]/students"
            options={{ title: 'Estudiantes del Curso', headerShown: true }}
          />
          <Stack.Screen
            name="(authority)/requests/index"
            options={{ title: 'Solicitudes de Registro', headerShown: true }}
          />
          <Stack.Screen
            name="(authority)/statistics/index"
            options={{ title: 'Estadísticas de Convivencia', headerShown: true }}
          />
          <Stack.Screen
            name="(authority)/education/index"
            options={{ title: 'Módulo Educativo y Preventivo', headerShown: true }}
          />
          <Stack.Screen
            name="(authority)/education/[id]"
            options={{ title: 'Módulo Educativo y Preventivo', headerShown: true }}
          />

          <Stack.Screen
            name="index"
            options={{ headerShown: false }}
          />
        </Stack>
      </View>
    </SafeAreaProvider>
  );
}

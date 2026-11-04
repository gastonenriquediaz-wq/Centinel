import React, { useEffect } from 'react';
import { Alert, Platform } from 'react-native';
import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '../src/store/auth.store';
import { AuthService } from '../src/services/auth.service';
import { supabase } from '../src/services/supabase';

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
  const { setSession, setProfile, setLoading, reset, profile, session, isLoading } = useAuthStore();

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
        reset();
        router.replace('/(auth)/login');
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#1E3A8A' },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      >
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
        <Stack.Screen
          name="(student)/index"
          options={{ title: 'Centinel', headerShown: true }}
        />
        <Stack.Screen
          name="(authority)/index"
          options={{ title: 'Centinel', headerShown: true }}
        />
        <Stack.Screen
          name="index"
          options={{ headerShown: false }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}

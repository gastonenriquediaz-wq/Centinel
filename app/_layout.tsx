import React, { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '../src/store/auth.store';
import { AuthService } from '../src/services/auth.service';
import { supabase } from '../src/services/supabase';

export default function RootLayout() {
  const { setSession, setProfile, setLoading, reset, profile } = useAuthStore();

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
          options={{ title: 'Centinel - Panel de Autoridad', headerShown: true }}
        />
        <Stack.Screen
          name="index"
          options={{ headerShown: false }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}

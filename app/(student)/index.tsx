import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { useAuthStore } from '../../src/store/auth.store';
import { AuthService } from '../../src/services/auth.service';
import { supabase } from '../../src/services/supabase';
import { Course } from '../../src/types/database.types';

export default function StudentDashboard() {
  const { profile, institution, course: storedCourse, reset } = useAuthStore();
  const [course, setCourse] = useState<Course | null>(storedCourse);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (storedCourse) {
      setCourse(storedCourse);
      return;
    }
    if (profile?.course_id) {
      supabase
        .from('courses')
        .select('*')
        .eq('id', profile.course_id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setCourse(data);
          }
        });
    }
  }, [profile?.course_id, storedCourse]);

  const handleLogout = async () => {
    try {
      await AuthService.signOut();
    } finally {
      reset();
      router.replace('/(auth)/login');
    }
  };

  const courseDisplay = course
    ? `${course.year}° Año ${course.division}`
    : 'Curso asignado';

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Centinel',
          headerRight: () => (
            <View style={styles.headerAvatar}>
              <Ionicons name="person" size={16} color="#FFFFFF" />
            </View>
          ),
        }}
      />
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingBottom: Math.max(insets.bottom, 24) + 40 },
        ]}
      >
        {/* Contenedor de bienvenida */}
        <Card style={styles.welcomeCard}>
          <Text style={styles.roleBadge}>ESTUDIANTE</Text>
          <Text style={styles.userName}>
            ¡Hola, {profile?.first_name} {profile?.last_name}!
          </Text>
          <Text style={styles.institutionName}>
            {institution?.name || 'Institución educativa'}
          </Text>
          <Text style={styles.courseText}>{courseDisplay}</Text>
        </Card>

        {/* Accesos rápidos de Reportes */}
        <Card style={styles.actionCard}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardIconCircle}>
              <Ionicons name="megaphone" size={22} color="#1E3A8A" />
            </View>
            <View style={styles.cardHeaderTextCol}>
              <Text style={styles.sectionTitle}>Comunicación y reportes</Text>
              <Text style={styles.actionDesc}>
                Si estás atravesando o presencias una situación de hostigamiento o conflicto, podés comunicarla de forma confidencial.
              </Text>
            </View>
          </View>
          <View style={styles.actionButtons}>
            <Button
              title="Crear reporte"
              icon={<Ionicons name="add" size={20} color="#FFFFFF" />}
              onPress={() => router.push('/(student)/reports/new')}
              style={styles.primaryActionButton}
            />
            <Button
              title="Mis reportes"
              variant="outline"
              icon={<Text style={styles.buttonEmojiIcon}>📋</Text>}
              onPress={() => router.push('/(student)/reports')}
              style={styles.secondaryActionButton}
            />
          </View>
        </Card>

        {/* Acceso al Módulo Educativo */}
        <Card style={styles.actionCard}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardIconCircle}>
              <Ionicons name="book-outline" size={22} color="#0284C7" />
            </View>
            <View style={styles.cardHeaderTextCol}>
              <Text style={styles.sectionTitle}>Aprender y prevenir</Text>
              <Text style={styles.actionDesc}>
                Información clara y orientativa sobre acoso escolar, ciberacoso, convivencia y cuándo pedir ayuda.
              </Text>
            </View>
          </View>
          <Button
            title="Ir al módulo educativo"
            variant="outline"
            icon={<Text style={styles.buttonEmojiIcon}>📜</Text>}
            onPress={() => router.push('/(student)/education')}
            style={styles.educationButton}
          />
        </Card>

        {/* Privacidad y ayuda */}
        <Card style={styles.infoCard}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardIconCircle}>
              <Ionicons name="shield-checkmark" size={22} color="#1E3A8A" />
            </View>
            <View style={styles.cardHeaderTextCol}>
              <Text style={styles.sectionTitle}>Privacidad y ayuda</Text>
              <Text style={styles.infoText}>
                Tus reportes son confidenciales. Solo vos y las autoridades educativas autorizadas de tu institución pueden consultar tus comunicaciones.
              </Text>
            </View>
          </View>
          <View style={styles.urgentNoticeBox}>
            <Text style={styles.noteText}>
              ⚠️ En situaciones de riesgo físico inmediato o urgencias graves, comunícate de inmediato con las líneas 911 o 102.
            </Text>
          </View>
        </Card>

        {/* Cerrar sesión */}
        <Button
          title="Cerrar sesión"
          variant="outline"
          icon={<Ionicons name="log-out-outline" size={18} color="#1E3A8A" />}
          onPress={handleLogout}
          style={styles.logoutButton}
        />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#F8FAFC',
    flexGrow: 1,
  },
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  welcomeCard: {
    padding: 20,
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    marginBottom: 16,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#1E3A8A',
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  userName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  institutionName: {
    fontSize: 14,
    color: '#1E3A8A',
    fontWeight: '600',
  },
  courseText: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
    fontWeight: '500',
  },
  actionCard: {
    padding: 20,
    marginBottom: 16,
    borderColor: '#E2E8F0',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  cardIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  cardHeaderTextCol: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  actionDesc: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    lineHeight: 18,
    textAlign: 'justify',
  },
  actionButtons: {
    gap: 10,
  },
  primaryActionButton: {
    width: '100%',
  },
  secondaryActionButton: {
    width: '100%',
  },
  educationButton: {
    width: '100%',
    borderColor: '#1E3A8A',
  },
  buttonEmojiIcon: {
    fontSize: 16,
  },
  infoCard: {
    padding: 20,
    marginBottom: 20,
    borderColor: '#E2E8F0',
  },
  infoText: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    lineHeight: 18,
    textAlign: 'justify',
  },
  urgentNoticeBox: {
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
  },
  noteText: {
    fontSize: 12,
    color: '#B91C1C',
    lineHeight: 16,
    fontWeight: '500',
    textAlign: 'justify',
  },
  logoutButton: {
    marginTop: 'auto',
    marginBottom: 8,
  },
});

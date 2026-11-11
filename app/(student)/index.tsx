import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal } from 'react-native';
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
  const [profileModalVisible, setProfileModalVisible] = useState(false);
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
            <TouchableOpacity
              onPress={() => setProfileModalVisible(true)}
              activeOpacity={0.7}
              style={styles.headerAvatar}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="person" size={16} color="#FFFFFF" />
            </TouchableOpacity>
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

      {/* Modal de Perfil del Estudiante */}
      <Modal
        visible={profileModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setProfileModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.profileModalCard}>
            {/* Cabecera del modal */}
            <View style={styles.profileModalHeader}>
              <View style={styles.profileAvatarCircle}>
                <Ionicons name="person" size={32} color="#1E3A8A" />
              </View>
              <Text style={styles.profileModalTitle}>Perfil del Estudiante</Text>
              <Text style={styles.profileModalRole}>ESTUDIANTE</Text>
            </View>

            {/* Campos de información estilizados */}
            <View style={styles.profileInfoList}>
              <View style={styles.profileInfoItem}>
                <View style={styles.profileInfoIconWrap}>
                  <Ionicons name="person-outline" size={18} color="#1E3A8A" />
                </View>
                <View style={styles.profileInfoTextCol}>
                  <Text style={styles.profileInfoLabel}>Nombre y apellido</Text>
                  <Text style={styles.profileInfoValue}>
                    {profile?.first_name} {profile?.last_name}
                  </Text>
                </View>
              </View>

              <View style={styles.profileInfoItem}>
                <View style={styles.profileInfoIconWrap}>
                  <Ionicons name="id-card-outline" size={18} color="#1E3A8A" />
                </View>
                <View style={styles.profileInfoTextCol}>
                  <Text style={styles.profileInfoLabel}>Documento (DNI)</Text>
                  <Text style={styles.profileInfoValue}>
                    {profile?.dni || 'Sin registrar'}
                  </Text>
                </View>
              </View>

              <View style={styles.profileInfoItem}>
                <View style={styles.profileInfoIconWrap}>
                  <Ionicons name="school-outline" size={18} color="#1E3A8A" />
                </View>
                <View style={styles.profileInfoTextCol}>
                  <Text style={styles.profileInfoLabel}>Curso y división</Text>
                  <Text style={styles.profileInfoValue}>{courseDisplay}</Text>
                </View>
              </View>

              <View style={styles.profileInfoItem}>
                <View style={styles.profileInfoIconWrap}>
                  <Ionicons name="business-outline" size={18} color="#1E3A8A" />
                </View>
                <View style={styles.profileInfoTextCol}>
                  <Text style={styles.profileInfoLabel}>Institución escolar</Text>
                  <Text style={styles.profileInfoValue}>
                    {institution?.name || 'Colegio Secundario Modelo de Salta'}
                  </Text>
                </View>
              </View>

              <View style={styles.profileInfoItemLast}>
                <View style={styles.profileInfoIconWrap}>
                  <Ionicons name="shield-checkmark-outline" size={18} color="#16A34A" />
                </View>
                <View style={styles.profileInfoTextCol}>
                  <Text style={styles.profileInfoLabel}>Estado de cuenta</Text>
                  <Text style={[styles.profileInfoValue, { color: '#16A34A', fontWeight: '700' }]}>
                    Aprobada y activa
                  </Text>
                </View>
              </View>
            </View>

            {/* Botón de cerrar modal */}
            <Button
              title="Entendido"
              onPress={() => setProfileModalVisible(false)}
              style={styles.profileModalCloseBtn}
            />
          </View>
        </View>
      </Modal>
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
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  actionDesc: {
    fontSize: 15,
    color: '#64748B',
    marginTop: 4,
    lineHeight: 21,
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
    fontSize: 15,
    color: '#64748B',
    marginTop: 4,
    lineHeight: 21,
    textAlign: 'justify',
  },
  urgentNoticeBox: {
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
  },
  noteText: {
    fontSize: 14,
    color: '#B91C1C',
    lineHeight: 19,
    fontWeight: '500',
    textAlign: 'justify',
  },
  logoutButton: {
    marginTop: 'auto',
    marginBottom: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  profileModalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  profileModalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  profileAvatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EFF6FF',
    borderWidth: 2,
    borderColor: '#BFDBFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  profileModalTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  profileModalRole: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1E3A8A',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    letterSpacing: 0.5,
  },
  profileInfoList: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 20,
  },
  profileInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 12,
  },
  profileInfoItemLast: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  profileInfoIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfoTextCol: {
    flex: 1,
  },
  profileInfoLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 1,
  },
  profileInfoValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  profileModalCloseBtn: {
    backgroundColor: '#1E3A8A',
    borderRadius: 10,
    paddingVertical: 12,
  },
});

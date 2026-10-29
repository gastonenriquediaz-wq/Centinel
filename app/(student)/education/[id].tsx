import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '../../../src/components/ui/Card';
import { Button } from '../../../src/components/ui/Button';
import { EDUCATIONAL_TOPICS, EducationalTopic, EducationalSection } from '../../../src/data/educationalContent';

export default function EducationTopicDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  const topic = EDUCATIONAL_TOPICS.find((t: EducationalTopic) => t.id === id);

  if (!topic) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>No se encontró el contenido solicitado.</Text>
        <Button
          title="Volver a Educación"
          onPress={() => router.replace('/(student)/education')}
          style={styles.backButton}
        />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingBottom: Math.max(insets.bottom, 24) + 20 },
      ]}
    >
      <Stack.Screen
        options={{
          title: topic.title,
          headerBackTitle: 'Temas',
        }}
      />

      {/* Encabezado e Introducción */}
      <Card style={styles.headerCard}>
        <View style={styles.titleRow}>
          <Text style={styles.headerIcon}>{topic.icon}</Text>
          <Text style={styles.titleText}>{topic.title}</Text>
        </View>
        <Text style={styles.introText}>{topic.intro}</Text>
      </Card>

      {/* Secciones del tema */}
      {topic.sections.map((sec: EducationalSection, index: number) => (
        <Card key={index} style={styles.sectionCard}>
          <Text style={styles.sectionSubtitle}>{sec.subtitle}</Text>
          <Text style={styles.sectionBody}>{sec.body}</Text>

          {/* Lista de ejemplos si existen */}
          {sec.examples && sec.examples.length > 0 && (
            <View style={styles.listContainer}>
              <Text style={styles.listHeader}>Ejemplos habituales:</Text>
              {sec.examples.map((ex: string, exIdx: number) => (
                <View key={exIdx} style={styles.bulletItem}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.bulletText}>{ex}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Lista de recomendaciones si existen */}
          {sec.recommendations && sec.recommendations.length > 0 && (
            <View style={styles.listContainer}>
              <Text style={styles.listHeader}>
                {sec.recommendationsHeader || 'Pautas recomendadas:'}
              </Text>
              {sec.recommendations.map((rec: string, recIdx: number) => (
                <View key={recIdx} style={styles.bulletItem}>
                  <Text style={styles.bulletDotCheck}>✓</Text>
                  <Text style={styles.bulletText}>{rec}</Text>
                </View>
              ))}
            </View>
          )}
        </Card>
      ))}

      {/* Consejo o mensaje clave al pie */}
      <Card style={styles.keyAdviceCard}>
        <Text style={styles.keyAdviceTitle}>💡 Recordatorio Clave</Text>
        <Text style={styles.keyAdviceText}>{topic.keyAdvice}</Text>
      </Card>

      <Button
        title="Volver al Listado de Temas"
        variant="outline"
        onPress={() => router.back()}
        style={styles.bottomBackButton}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#F8FAFC',
    flexGrow: 1,
    gap: 14,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    fontWeight: '600',
    marginBottom: 12,
  },
  backButton: {
    minWidth: 160,
  },
  navBackButton: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  headerCard: {
    padding: 18,
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  headerIcon: {
    fontSize: 26,
  },
  titleText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    flex: 1,
  },
  introText: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 22,
  },
  sectionCard: {
    padding: 16,
    borderColor: '#E2E8F0',
  },
  sectionSubtitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E3A8A',
    marginBottom: 8,
  },
  sectionBody: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 21,
  },
  listContainer: {
    marginTop: 12,
    gap: 6,
  },
  listHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bulletDot: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '900',
    lineHeight: 20,
  },
  bulletDotCheck: {
    fontSize: 13,
    color: '#16A34A',
    fontWeight: '900',
    lineHeight: 20,
  },
  bulletText: {
    flex: 1,
    fontSize: 13,
    color: '#1E293B',
    lineHeight: 20,
  },
  keyAdviceCard: {
    padding: 16,
    backgroundColor: '#FEFCE8',
    borderColor: '#FEF08A',
  },
  keyAdviceTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#854D0E',
    marginBottom: 6,
  },
  keyAdviceText: {
    fontSize: 13,
    color: '#713F12',
    lineHeight: 19,
    fontStyle: 'italic',
  },
  bottomBackButton: {
    marginTop: 8,
    marginBottom: 20,
  },
});

import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '../../../src/components/ui/Card';
import { EDUCATIONAL_TOPICS, EducationalTopic } from '../../../src/data/educationalContent';

export default function EducationHomeScreen() {
  const insets = useSafeAreaInsets();

  const renderItem = ({ item }: { item: EducationalTopic }) => (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => router.push(`/(student)/education/${item.id}` as any)}
      style={styles.touchable}
    >
      <Card style={styles.topicCard}>
        <View style={styles.cardContent}>
          <View style={[styles.iconContainer, { backgroundColor: item.iconBg || '#EFF6FF' }]}>
            <Text style={styles.iconText}>{item.icon}</Text>
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.topicTitle}>{item.title}</Text>
            <Text style={styles.topicDescription}>{item.shortDescription}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
        </View>
      </Card>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Módulo Educativo',
          headerBackTitle: 'Inicio',
        }}
      />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Información y prevención</Text>
        <Text style={styles.headerSubtitle}>
          Guías orientativas sobre convivencia, cuidado digital y canales de ayuda escolar
        </Text>
      </View>

      <FlatList
        data={EDUCATIONAL_TOPICS}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: Math.max(insets.bottom, 24) + 20 },
        ]}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    lineHeight: 18,
    textAlign: 'justify',
  },
  listContent: {
    padding: 16,
    gap: 10,
  },
  touchable: {
    marginBottom: 4,
  },
  topicCard: {
    padding: 16,
    borderRadius: 14,
    borderColor: '#E2E8F0',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 26,
  },
  textContainer: {
    flex: 1,
  },
  topicTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 3,
  },
  topicDescription: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
    textAlign: 'justify',
  },
});

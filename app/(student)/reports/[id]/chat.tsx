import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useAuthStore } from '../../../../src/store/auth.store';
import { MessagesService } from '../../../../src/services/messages.service';
import { ReportsService } from '../../../../src/services/reports.service';
import { Report, ReportMessage } from '../../../../src/types/database.types';

export default function StudentReportChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuthStore();
  const [report, setReport] = useState<Report | null>(null);
  const [messages, setMessages] = useState<ReportMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (id) {
      loadInitialData();
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    // Suscripción Realtime
    const unsubscribe = MessagesService.subscribeToMessages(id as string, (newMsg: ReportMessage) => {
      setMessages((prev) => {
        // Evitar duplicados si ya fue agregado por el sender
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });

      // Si el mensaje es de la autoridad, marcar como leído
      if (profile?.id && newMsg.sender_id !== profile.id) {
        MessagesService.markMessagesAsRead(id as string, profile.id);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [id, profile?.id]);

  const loadInitialData = async () => {
    try {
      const [repRes, msgRes] = await Promise.all([
        ReportsService.getReportDetails(id as string),
        MessagesService.getMessages(id as string),
      ]);

      if (repRes.data) {
        setReport(repRes.data);
      }
      if (msgRes.data) {
        setMessages(msgRes.data);
      }

      if (profile?.id) {
        MessagesService.markMessagesAsRead(id as string, profile.id);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || !profile?.id || !id || sending) return;
    const textToSend = inputText.trim();
    setInputText('');
    setSending(true);

    try {
      const { data, error } = await MessagesService.sendMessage(
        id as string,
        profile.id,
        'student',
        textToSend
      );

      if (data) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.id)) return prev;
          return [...prev, data];
        });
      }
    } finally {
      setSending(false);
    }
  };

  const isClosedOrFinalized =
    report?.status === 'closed_no_case' || report?.status === 'finalized';

  const formatMessageTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <Stack.Screen
        options={{
          title: 'Comunicación con Autoridades',
          headerBackTitle: 'Reporte',
        }}
      />

      {/* Cabecera del reporte en el chat */}
      <View style={styles.chatHeader}>
        <Text style={styles.chatHeaderTitle} numberOfLines={1}>
          Situación: {report?.situation_type || 'Cargando...'}
        </Text>
        <Text style={styles.chatHeaderSubtitle}>
          Canal directo y confidencial con el equipo directivo
        </Text>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#1E3A8A" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={styles.emptyMessagesContainer}>
              <Text style={styles.emptyMessagesIcon}>💬</Text>
              <Text style={styles.emptyMessagesTitle}>Canal de Mensajería</Text>
              <Text style={styles.emptyMessagesText}>
                Puedes utilizar este espacio para brindar información adicional a los directivos o responder a sus consultas sobre el reporte.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isMe = item.sender_id === profile?.id;
            return (
              <View
                style={[
                  styles.messageRow,
                  isMe ? styles.messageRowMe : styles.messageRowOther,
                ]}
              >
                <View
                  style={[
                    styles.messageBubble,
                    isMe ? styles.messageBubbleMe : styles.messageBubbleOther,
                  ]}
                >
                  <Text style={[styles.senderName, isMe ? styles.senderNameMe : styles.senderNameOther]}>
                    {isMe ? 'Tú (Estudiante)' : 'Equipo Directivo'}
                  </Text>
                  <Text style={[styles.messageText, isMe ? styles.messageTextMe : styles.messageTextOther]}>
                    {item.content}
                  </Text>
                  <View style={styles.metaRow}>
                    <Text style={[styles.messageTime, isMe ? styles.messageTimeMe : styles.messageTimeOther]}>
                      {formatMessageTime(item.created_at)}
                    </Text>
                    {isMe && (
                      <Text style={styles.readCheck}>
                        {item.read_at ? ' ✓✓' : ' ✓'}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Barra de entrada o aviso de canal cerrado */}
      {isClosedOrFinalized ? (
        <View style={styles.closedNoticeBox}>
          <Text style={styles.closedNoticeText}>
            🔒 Este reporte se encuentra cerrado o finalizado. El canal de comunicación ha pasado a modo de solo lectura.
          </Text>
        </View>
      ) : (
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            placeholder="Escribe un mensaje confidencial..."
            placeholderTextColor="#94A3B8"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!inputText.trim() || sending) && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.sendButtonText}>➤</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  chatHeader: {
    backgroundColor: '#EFF6FF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#DBEAFE',
  },
  chatHeaderTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E3A8A',
  },
  chatHeaderSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesList: {
    padding: 16,
    paddingBottom: 20,
    flexGrow: 1,
    gap: 12,
  },
  emptyMessagesContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    marginTop: 60,
  },
  emptyMessagesIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyMessagesTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  emptyMessagesText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  messageRow: {
    flexDirection: 'row',
  },
  messageRowMe: {
    justifyContent: 'flex-end',
  },
  messageRowOther: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  messageBubbleMe: {
    backgroundColor: '#1E3A8A',
    borderBottomRightRadius: 2,
  },
  messageBubbleOther: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderBottomLeftRadius: 2,
  },
  senderName: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  senderNameMe: {
    color: '#93C5FD',
  },
  senderNameOther: {
    color: '#D97706',
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  messageTextMe: {
    color: '#FFFFFF',
  },
  messageTextOther: {
    color: '#0F172A',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  messageTime: {
    fontSize: 10,
  },
  messageTimeMe: {
    color: '#BFDBFE',
  },
  messageTimeOther: {
    color: '#94A3B8',
  },
  readCheck: {
    fontSize: 10,
    color: '#93C5FD',
    fontWeight: '800',
  },
  closedNoticeBox: {
    backgroundColor: '#F1F5F9',
    padding: 16,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  closedNoticeText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 10,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 10,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 14,
    color: '#0F172A',
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1E3A8A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#94A3B8',
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});

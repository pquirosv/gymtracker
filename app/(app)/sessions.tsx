import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '../../supabase/auth-context'
import { supabase } from '../../supabase/supabase'

type WorkoutSessionListItem = {
  id: string
  started_at: string
}

const PAGE_SIZE = 10

const sessionDateFormatter = new Intl.DateTimeFormat('es-MX', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

export default function SessionsScreen() {
  const router = useRouter()
  const { session } = useAuth()
  const [sessions, setSessions] = useState<WorkoutSessionListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  useEffect(() => {
    const userId = session?.user.id

    if (!userId) {
      setSessions([])
      setTotalCount(0)
      setLoading(false)
      return
    }

    let isMounted = true

    const loadSessions = async () => {
      setLoading(true)
      setError('')

      const from = (currentPage - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      const sessionsResult = await supabase
        .from('workout_sessions')
        .select('id, started_at', { count: 'exact' })
        .eq('user_id', userId)
        .order('started_at', { ascending: false })
        .range(from, to)
        .returns<WorkoutSessionListItem[]>()

      if (!isMounted) {
        return
      }

      if (sessionsResult.error) {
        setSessions([])
        setTotalCount(0)
        setError('No se pudieron cargar tus sesiones.')
        setLoading(false)
        return
      }

      setSessions(sessionsResult.data ?? [])
      setTotalCount(sessionsResult.count ?? 0)
      setLoading(false)
    }

    loadSessions()

    return () => {
      isMounted = false
    }
  }, [currentPage, session?.user.id])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const hasPreviousPage = currentPage > 1
  const hasNextPage = currentPage < totalPages

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back()
      return
    }

    router.replace('/')
  }

  if (loading) {
    return (
      <View style={styles.centeredScreen}>
        <Text style={styles.loadingTitle}>Cargando sesiones</Text>
        <Text style={styles.loadingText}>Consultando tu historial completo.</Text>
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.centeredScreen}>
        <View style={styles.errorCard}>
          <Text style={styles.sectionTitle}>Error al cargar</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={handleGoBack}>
            <Text style={styles.primaryButtonText}>Volver</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
        <Text style={styles.backButtonText}>Volver</Text>
      </TouchableOpacity>

      <Text style={styles.pageTitle}>Sesiones</Text>
      <Text style={styles.pageSubtitle}>Aquí puedes revisar todas tus sesiones registradas.</Text>

      <View style={styles.section}>
        {sessions.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.emptyStateText}>Todavía no has registrado sesiones.</Text>
          </View>
        ) : (
          <>
            {sessions.map((workoutSession) => (
              <TouchableOpacity
                key={workoutSession.id}
                style={styles.sessionCard}
                onPress={() => router.push(`/workout-session/${workoutSession.id}`)}
              >
                <Text style={styles.sessionDate}>{formatSessionDate(workoutSession.started_at)}</Text>
              </TouchableOpacity>
            ))}

            <View style={styles.paginationRow}>
              <TouchableOpacity
                style={[styles.paginationButton, !hasPreviousPage && styles.paginationButtonDisabled]}
                disabled={!hasPreviousPage}
                onPress={() => setCurrentPage((page) => Math.max(1, page - 1))}
              >
                <Text
                  style={[
                    styles.paginationButtonText,
                    !hasPreviousPage && styles.paginationButtonTextDisabled,
                  ]}
                >
                  Anterior
                </Text>
              </TouchableOpacity>

              <Text style={styles.paginationText}>Página {currentPage}</Text>

              <TouchableOpacity
                style={[styles.paginationButton, !hasNextPage && styles.paginationButtonDisabled]}
                disabled={!hasNextPage}
                onPress={() => setCurrentPage((page) => page + 1)}
              >
                <Text
                  style={[styles.paginationButtonText, !hasNextPage && styles.paginationButtonTextDisabled]}
                >
                  Siguiente
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </ScrollView>
  )
}

function formatSessionDate(startedAt: string) {
  return sessionDateFormatter.format(new Date(startedAt))
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f3f6f8',
  },
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  centeredScreen: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f3f6f8',
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 20,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#e2e8f0',
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  pageSubtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: '#475569',
    marginBottom: 28,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  sessionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  sessionDate: {
    fontSize: 15,
    color: '#475569',
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 8,
  },
  paginationButton: {
    minWidth: 96,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
  paginationButtonDisabled: {
    backgroundColor: '#cbd5e1',
  },
  paginationButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  paginationButtonTextDisabled: {
    color: '#64748b',
  },
  paginationText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  emptyStateText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#475569',
  },
  loadingTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  loadingText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#475569',
  },
  errorCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#b91c1c',
    marginBottom: 20,
  },
  primaryButton: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
})

import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '../../supabase/auth-context'
import { supabase } from '../../supabase/supabase'

type Routine = {
  id: string
  total_days: number
  current_day: number
}

type WorkoutSession = {
  id: string
  started_at: string
}

const sessionDateFormatter = new Intl.DateTimeFormat('es-MX', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

export default function HomeScreen() {
  const router = useRouter()
  const { session } = useAuth()
  const [routine, setRoutine] = useState<Routine | null>(null)
  const [sessions, setSessions] = useState<WorkoutSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const userId = session?.user.id

    if (!userId) {
      setRoutine(null)
      setSessions([])
      setLoading(false)
      return
    }

    let isMounted = true

    const loadDashboard = async () => {
      setLoading(true)
      setError('')

      const [routineResult, sessionsResult] = await Promise.all([
        supabase
          .from('routines')
          .select('id, total_days, current_day')
          .eq('user_id', userId)
          .maybeSingle<Routine>(),
        supabase
          .from('workout_sessions')
          .select('id, started_at')
          .eq('user_id', userId)
          .order('started_at', { ascending: false })
          .limit(5)
          .returns<WorkoutSession[]>(),
      ])

      if (!isMounted) {
        return
      }

      if (routineResult.error || sessionsResult.error) {
        setRoutine(null)
        setSessions([])
        setError('No se pudo cargar tu información por ahora.')
        setLoading(false)
        return
      }

      setRoutine(routineResult.data)
      setSessions(sessionsResult.data ?? [])
      setLoading(false)
    }

    loadDashboard()

    return () => {
      isMounted = false
    }
  }, [session?.user.id])

  if (loading) {
    return (
      <View style={styles.centeredScreen}>
        <Text style={styles.loadingTitle}>Cargando tu inicio</Text>
        <Text style={styles.loadingText}>Consultando tu rutina y tus sesiones.</Text>
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.centeredScreen}>
        <View style={styles.errorCard}>
          <Text style={styles.sectionTitle}>Error al cargar</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </View>
    )
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>Tu progreso</Text>
      <Text style={styles.pageSubtitle}>Resumen rápido de tu rutina y tus sesiones anteriores.</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Rutina</Text>

        {routine ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Rutina actual</Text>
            <View style={styles.metricsRow}>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Días totales</Text>
                <Text style={styles.metricValue}>{routine.total_days}</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Día actual</Text>
                <Text style={styles.metricValue}>{routine.current_day}</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/start-session')}>
              <Text style={styles.primaryButtonText}>Comenzar sesión</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Aún no tienes rutina</Text>
            <Text style={styles.cardBody}>
              Puedes crear una rutina o iniciar una sesión libre y registrar tus ejercicios manualmente.
            </Text>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.push('/start-session')}
            >
              <Text style={styles.primaryButtonText}>Iniciar sesión</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryActionButton}
              onPress={() => router.push('/create-routine')}
            >
              <Text style={styles.secondaryActionButtonText}>Crear rutina</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sesiones anteriores</Text>

        {sessions.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.emptyStateText}>No tienes sesiones anteriores</Text>
          </View>
        ) : (
          sessions.map((workoutSession) => (
            <TouchableOpacity
              key={workoutSession.id}
              style={styles.sessionCard}
              onPress={() => router.push(`/workout-session/${workoutSession.id}`)}
            >
              <Text style={styles.sessionDate}>{formatSessionDate(workoutSession.started_at)}</Text>
            </TouchableOpacity>
          ))
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
    marginBottom: 32,
  },
  section: {
    marginBottom: 28,
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
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
  },
  cardBody: {
    fontSize: 16,
    lineHeight: 24,
    color: '#475569',
    marginBottom: 20,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#eef2f7',
    borderRadius: 14,
    padding: 16,
  },
  metricLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  metricValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
  },
  primaryButton: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryActionButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
  },
  secondaryActionButtonText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyStateText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#475569',
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
  sessionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  sessionDate: {
    fontSize: 15,
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
  },
})

import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useAuth } from '../../../supabase/auth-context'
import { supabase } from '../../../supabase/supabase'

type WorkoutSessionRecord = {
  id: string
  started_at: string
}

type SessionExerciseRecord = {
  id: string
  sets: number
  reps: number
  weight: number | string | null
  exercise_order: number
  exercises: {
    name: string
  } | null
}

const sessionDateFormatter = new Intl.DateTimeFormat('es-MX', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const weightFormatter = new Intl.NumberFormat('es-MX', {
  maximumFractionDigits: 2,
})

export default function WorkoutSessionDetailScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id?: string }>()
  const { session } = useAuth()
  const [workoutSession, setWorkoutSession] = useState<WorkoutSessionRecord | null>(null)
  const [sessionExercises, setSessionExercises] = useState<SessionExerciseRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const userId = session?.user.id
    const sessionId = Array.isArray(id) ? id[0] : id

    if (!userId || !sessionId) {
      setWorkoutSession(null)
      setSessionExercises([])
      setError('No se pudo identificar la sesión solicitada.')
      setLoading(false)
      return
    }

    let isMounted = true

    const loadSessionDetail = async () => {
      setLoading(true)
      setError('')

      const sessionResult = await supabase
        .from('workout_sessions')
        .select('id, started_at')
        .eq('id', sessionId)
        .eq('user_id', userId)
        .maybeSingle<WorkoutSessionRecord>()

      if (!isMounted) {
        return
      }

      if (sessionResult.error || !sessionResult.data) {
        setWorkoutSession(null)
        setSessionExercises([])
        setError('No se pudo cargar esa sesión.')
        setLoading(false)
        return
      }

      const exercisesResult = await supabase
        .from('workout_session_exercises')
        .select('id, sets, reps, weight, exercise_order, exercises(name)')
        .eq('session_id', sessionId)
        .order('exercise_order', { ascending: true })
        .returns<SessionExerciseRecord[]>()

      if (!isMounted) {
        return
      }

      if (exercisesResult.error) {
        setWorkoutSession(null)
        setSessionExercises([])
        setError('No se pudieron cargar los ejercicios de la sesión.')
        setLoading(false)
        return
      }

      setWorkoutSession(sessionResult.data)
      setSessionExercises(exercisesResult.data ?? [])
      setLoading(false)
    }

    loadSessionDetail()

    return () => {
      isMounted = false
    }
  }, [id, session?.user.id])

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
        <Text style={styles.loadingTitle}>Cargando sesión</Text>
        <Text style={styles.loadingText}>Consultando la sesión y sus ejercicios.</Text>
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.centeredScreen}>
        <View style={styles.errorCard}>
          <Text style={styles.sectionTitle}>No disponible</Text>
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

      <Text style={styles.pageTitle}>Detalle de sesión</Text>
      <Text style={styles.pageSubtitle}>
        {workoutSession ? formatSessionDate(workoutSession.started_at) : 'Sesión'}
      </Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ejercicios registrados</Text>

        {sessionExercises.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.emptyStateText}>Esta sesión no tiene ejercicios registrados.</Text>
          </View>
        ) : (
          sessionExercises.map((exercise, index) => (
            <View key={exercise.id} style={styles.exerciseCard}>
              <Text style={styles.exerciseTitle}>
                {index + 1}. {exercise.exercises?.name ?? 'Ejercicio'}
              </Text>
              <Text style={styles.exerciseMeta}>Series: {exercise.sets}</Text>
              <Text style={styles.exerciseMeta}>Repeticiones: {exercise.reps}</Text>
              <Text style={styles.exerciseMeta}>Peso: {formatWeight(exercise.weight)}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  )
}

function formatSessionDate(startedAt: string) {
  return sessionDateFormatter.format(new Date(startedAt))
}

function formatWeight(weight: number | string | null) {
  if (weight === null) {
    return '0'
  }

  const parsedWeight = typeof weight === 'number' ? weight : Number(weight)

  if (Number.isNaN(parsedWeight)) {
    return '0'
  }

  return weightFormatter.format(parsedWeight)
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
  exerciseCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  exerciseTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
  },
  exerciseMeta: {
    fontSize: 15,
    lineHeight: 22,
    color: '#475569',
    marginBottom: 6,
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

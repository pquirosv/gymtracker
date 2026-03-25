import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '../../supabase/auth-context'
import { supabase } from '../../supabase/supabase'

type ExerciseOption = {
  id: string
  name: string
}

type RoutineRecord = {
  id: string
  current_day: number
  total_days: number
}

type RoutineExerciseRecord = {
  id: string
  exercise_id: string
  sets: number
  reps: number
  exercise_order: number
}

type ExerciseHistoryRecord = {
  exercise_id: string
  weight: number | string | null
}

type SessionDraftRow = {
  rowKey: string
  exerciseId: string
  sets: string
  reps: string
  weight: string
  exerciseOrder: number
}

type FinalizeWorkoutSessionResult = {
  session_id: string
  next_current_day: number | null
}

let draftRowCounter = 0
const weightFormatter = new Intl.NumberFormat('es-MX', {
  maximumFractionDigits: 2,
})

export default function StartSessionScreen() {
  const router = useRouter()
  const { session } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [screenError, setScreenError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [catalog, setCatalog] = useState<ExerciseOption[]>([])
  const [routine, setRoutine] = useState<RoutineRecord | null>(null)
  const [sessionRows, setSessionRows] = useState<SessionDraftRow[]>([])
  const [previousWeightByExerciseId, setPreviousWeightByExerciseId] = useState<Record<string, number>>({})
  const [pickerRowKey, setPickerRowKey] = useState<string | null>(null)

  useEffect(() => {
    const userId = session?.user.id

    if (!userId) {
      setLoading(false)
      setScreenError('No se pudo identificar tu cuenta.')
      return
    }

    let isMounted = true

    const loadSessionDraft = async () => {
      setLoading(true)
      setScreenError('')

      const [catalogResult, routineResult, historyResult] = await Promise.all([
        supabase.from('exercises').select('id, name').order('name', { ascending: true }).returns<ExerciseOption[]>(),
        supabase
          .from('routines')
          .select('id, current_day, total_days')
          .eq('user_id', userId)
          .maybeSingle<RoutineRecord>(),
        supabase
          .from('workout_session_exercises')
          .select('exercise_id, weight, workout_sessions!inner(user_id)')
          .eq('workout_sessions.user_id', userId)
          .order('created_at', { ascending: false })
          .returns<ExerciseHistoryRecord[]>(),
      ])

      if (!isMounted) {
        return
      }

      if (catalogResult.error || routineResult.error) {
        setScreenError('No se pudo cargar la sesión.')
        setLoading(false)
        return
      }

      let nextRows: SessionDraftRow[] = []
      const nextPreviousWeightByExerciseId = buildPreviousWeightByExerciseId(historyResult.data ?? [])

      if (routineResult.data) {
        if (routineResult.data.current_day > routineResult.data.total_days) {
          setScreenError('La rutina actual es inconsistente.')
          setLoading(false)
          return
        }

        const routineExercisesResult = await supabase
          .from('routine_day_exercises')
          .select('id, exercise_id, sets, reps, exercise_order')
          .eq('routine_id', routineResult.data.id)
          .eq('day_number', routineResult.data.current_day)
          .order('exercise_order', { ascending: true })
          .returns<RoutineExerciseRecord[]>()

        if (!isMounted) {
          return
        }

        if (routineExercisesResult.error) {
          setScreenError('No se pudo cargar la rutina del día.')
          setLoading(false)
          return
        }

        if (!(routineExercisesResult.data ?? []).length) {
          setScreenError('La rutina actual no tiene ejercicios configurados para este día.')
          setLoading(false)
          return
        }

        nextRows = (routineExercisesResult.data ?? []).map((exercise, index) => ({
          rowKey: nextDraftRowKey(),
          exerciseId: exercise.exercise_id,
          sets: String(exercise.sets),
          reps: String(exercise.reps),
          weight: '',
          exerciseOrder: index + 1,
        }))
      }

      setCatalog(catalogResult.data ?? [])
      setPreviousWeightByExerciseId(nextPreviousWeightByExerciseId)
      setRoutine(routineResult.data)
      setSessionRows(nextRows)
      setLoading(false)
    }

    loadSessionDraft()

    return () => {
      isMounted = false
    }
  }, [session?.user.id])

  const pickerRow = pickerRowKey
    ? sessionRows.find((row) => row.rowKey === pickerRowKey) ?? null
    : null
  const pickerSelectedExerciseName =
    catalog.find((exercise) => exercise.id === pickerRow?.exerciseId)?.name ?? ''

  const handleAddRow = () => {
    setSessionRows((currentRows) => [
      ...currentRows,
      {
        rowKey: nextDraftRowKey(),
        exerciseId: '',
        sets: '',
        reps: '',
        weight: '',
        exerciseOrder: currentRows.length + 1,
      },
    ])
    setSaveError('')
  }

  const handleRemoveRow = (rowKey: string) => {
    setSessionRows((currentRows) =>
      reindexSessionRows(currentRows.filter((row) => row.rowKey !== rowKey))
    )
    setSaveError('')

    if (pickerRowKey === rowKey) {
      setPickerRowKey(null)
    }
  }

  const updateRow = (rowKey: string, updater: (row: SessionDraftRow) => SessionDraftRow) => {
    setSessionRows((currentRows) =>
      currentRows.map((row) => (row.rowKey === rowKey ? updater(row) : row))
    )
    setSaveError('')
  }

  const handleFinalizeSession = async () => {
    if (!sessionRows.length) {
      setSaveError('Debes añadir al menos un ejercicio.')
      return
    }

    const payload = sessionRows.map((row, index) => {
      const parsedSets = parsePositiveInteger(row.sets)
      const parsedReps = parsePositiveInteger(row.reps)
      const parsedWeight = parseDecimal(row.weight)

      return {
        exercise_id: row.exerciseId,
        sets: parsedSets,
        reps: parsedReps,
        weight: parsedWeight,
        exercise_order: index + 1,
      }
    })

    const hasInvalidRows = payload.some(
      (row) => !row.exercise_id || !row.sets || !row.reps || row.weight === null || row.weight < 0
    )

    if (hasInvalidRows) {
      setSaveError('Revisa todos los ejercicios: ejercicio, series, repeticiones y peso son obligatorios.')
      return
    }

    setSaving(true)
    setSaveError('')

    const { data, error } = await supabase.rpc('finalize_workout_session', {
      session_exercises: payload,
    })

    if (error || !data) {
      setSaveError('No se pudo finalizar la sesión.')
      setSaving(false)
      return
    }

    const resultRows = (data ?? []) as FinalizeWorkoutSessionResult[]

    if (!resultRows.length || !resultRows[0]?.session_id) {
      setSaveError('No se pudo confirmar la sesión guardada.')
      setSaving(false)
      return
    }

    setSaving(false)
    router.replace('/')
  }

  if (loading) {
    return (
      <View style={styles.centeredScreen}>
        <ActivityIndicator size="large" color="#0f172a" />
        <Text style={styles.loadingTitle}>Preparando la sesión</Text>
        <Text style={styles.loadingText}>Cargando ejercicios y tu rutina actual.</Text>
      </View>
    )
  }

  if (screenError) {
    return (
      <View style={styles.centeredScreen}>
        <View style={styles.errorCard}>
          <Text style={styles.title}>No disponible</Text>
          <Text style={styles.errorText}>{screenError}</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.replace('/')}>
            <Text style={styles.primaryButtonText}>Volver al inicio</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.pageTitle}>{routine ? `Sesión del día ${routine.current_day}` : 'Sesión libre'}</Text>
        <Text style={styles.pageSubtitle}>
          {routine
            ? `Hoy corresponde el día ${routine.current_day} de ${routine.total_days}. Puedes modificar los ejercicios antes de guardar.`
            : 'No tienes una rutina configurada. Añade tus ejercicios manualmente para registrar esta sesión.'}
        </Text>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Ejercicios</Text>
          <TouchableOpacity
            style={[styles.inlineButton, saving && styles.buttonDisabled]}
            onPress={handleAddRow}
            disabled={saving}
          >
            <Text style={styles.inlineButtonText}>Añadir ejercicio</Text>
          </TouchableOpacity>
        </View>

        {sessionRows.length ? (
          sessionRows.map((row, index) => {
            const previousWeight = row.exerciseId ? previousWeightByExerciseId[row.exerciseId] : undefined

            return (
              <View key={row.rowKey} style={styles.exerciseCard}>
                <View style={styles.exerciseCardHeader}>
                  <Text style={styles.exerciseCardTitle}>Ejercicio {index + 1}</Text>
                  <TouchableOpacity disabled={saving} onPress={() => handleRemoveRow(row.rowKey)}>
                    <Text style={styles.deleteText}>Eliminar</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.label}>Ejercicio</Text>
                <TouchableOpacity
                  style={styles.selector}
                  onPress={() => setPickerRowKey(row.rowKey)}
                  disabled={saving}
                >
                  <Text
                    style={
                      row.exerciseId
                        ? styles.selectorValue
                        : styles.selectorPlaceholder
                    }
                  >
                    {catalog.find((exercise) => exercise.id === row.exerciseId)?.name ?? 'Selecciona un ejercicio'}
                  </Text>
                </TouchableOpacity>

                <Text style={styles.label}>Series</Text>
                <TextInput
                  value={row.sets}
                  onChangeText={(value) =>
                    updateRow(row.rowKey, (currentRow) => ({
                      ...currentRow,
                      sets: onlyDigits(value),
                    }))
                  }
                  keyboardType="number-pad"
                  placeholder="Ejemplo: 4"
                  style={styles.input}
                  editable={!saving}
                />

                <Text style={styles.label}>Repeticiones</Text>
                <TextInput
                  value={row.reps}
                  onChangeText={(value) =>
                    updateRow(row.rowKey, (currentRow) => ({
                      ...currentRow,
                      reps: onlyDigits(value),
                    }))
                  }
                  keyboardType="number-pad"
                  placeholder="Ejemplo: 10"
                  style={styles.input}
                  editable={!saving}
                />

                <Text style={styles.label}>Peso</Text>
                <TextInput
                  value={row.weight}
                  onChangeText={(value) =>
                    updateRow(row.rowKey, (currentRow) => ({
                      ...currentRow,
                      weight: sanitizeDecimalInput(value),
                    }))
                  }
                  keyboardType="decimal-pad"
                  placeholder="Ejemplo: 42.5"
                  style={[styles.input, previousWeight !== undefined && styles.inputWithHelper]}
                  editable={!saving}
                />

                {previousWeight !== undefined ? (
                  <Text style={styles.helperText}>
                    Último peso registrado: {formatWeight(previousWeight)}
                  </Text>
                ) : null}
              </View>
            )
          })
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Todavía no has añadido ejercicios a esta sesión.</Text>
          </View>
        )}

        {!!saveError && <Text style={styles.errorText}>{saveError}</Text>}

        <TouchableOpacity
          style={[styles.primaryButton, saving && styles.buttonDisabled]}
          onPress={handleFinalizeSession}
          disabled={saving}
        >
          <Text style={styles.primaryButtonText}>
            {saving ? 'Finalizando sesión...' : 'Finalizar sesión'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryButton, saving && styles.buttonDisabled]}
          onPress={() => router.replace('/')}
          disabled={saving}
        >
          <Text style={styles.secondaryButtonText}>Cancelar sesión</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={pickerRowKey !== null}
        animationType="fade"
        transparent
        onRequestClose={() => setPickerRowKey(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Selecciona un ejercicio</Text>
            {!!pickerSelectedExerciseName && (
              <Text style={styles.modalSubtitle}>Actual: {pickerSelectedExerciseName}</Text>
            )}

            <ScrollView style={styles.modalList} contentContainerStyle={styles.modalListContent}>
              {catalog.map((exercise) => (
                <TouchableOpacity
                  key={exercise.id}
                  style={styles.modalOption}
                  onPress={() => {
                    if (!pickerRowKey) {
                      return
                    }

                    updateRow(pickerRowKey, (currentRow) => ({
                      ...currentRow,
                      exerciseId: exercise.id,
                    }))
                    setPickerRowKey(null)
                  }}
                >
                  <Text style={styles.modalOptionText}>{exercise.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity style={styles.secondaryButton} onPress={() => setPickerRowKey(null)}>
              <Text style={styles.secondaryButtonText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  )
}

function nextDraftRowKey() {
  draftRowCounter += 1
  return `session-row-${draftRowCounter}`
}

function reindexSessionRows(rows: SessionDraftRow[]) {
  return rows.map((row, index) => ({
    ...row,
    exerciseOrder: index + 1,
  }))
}

function onlyDigits(value: string) {
  return value.replace(/\D+/g, '')
}

function sanitizeDecimalInput(value: string) {
  const normalizedValue = value.replace(/,/g, '.')
  let decimalSeen = false
  let sanitized = ''

  for (const char of normalizedValue) {
    if (/\d/.test(char)) {
      sanitized += char
      continue
    }

    if (char === '.' && !decimalSeen) {
      sanitized += char
      decimalSeen = true
    }
  }

  return sanitized
}

function parsePositiveInteger(value: string) {
  const parsedValue = Number.parseInt(value, 10)

  if (!Number.isInteger(parsedValue) || parsedValue < 1) {
    return null
  }

  return parsedValue
}

function parseDecimal(value: string) {
  if (!value.trim()) {
    return null
  }

  const parsedValue = Number(value)

  if (Number.isNaN(parsedValue) || parsedValue < 0) {
    return null
  }

  return parsedValue
}

function buildPreviousWeightByExerciseId(historyRows: ExerciseHistoryRecord[]) {
  return historyRows.reduce<Record<string, number>>((weights, row) => {
    if (weights[row.exercise_id] !== undefined || row.weight === null) {
      return weights
    }

    const parsedWeight = typeof row.weight === 'number' ? row.weight : Number(row.weight)

    if (Number.isNaN(parsedWeight)) {
      return weights
    }

    weights[row.exercise_id] = parsedWeight
    return weights
  }, {})
}

function formatWeight(value: number) {
  return weightFormatter.format(value)
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
    gap: 16,
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
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
  },
  loadingTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
  },
  loadingText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#475569',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  inlineButton: {
    backgroundColor: '#0f172a',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  inlineButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  exerciseCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  exerciseCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  exerciseCardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  deleteText: {
    color: '#dc2626',
    fontSize: 15,
    fontWeight: '600',
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  selector: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
    marginBottom: 16,
  },
  selectorValue: {
    fontSize: 16,
    color: '#0f172a',
  },
  selectorPlaceholder: {
    fontSize: 16,
    color: '#94a3b8',
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#0f172a',
    backgroundColor: '#ffffff',
    marginBottom: 16,
  },
  inputWithHelper: {
    marginBottom: 8,
  },
  helperText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#475569',
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#475569',
  },
  primaryButton: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#2563eb',
    fontSize: 15,
    fontWeight: '600',
  },
  errorCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 16,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 15,
    color: '#475569',
    marginBottom: 16,
  },
  modalList: {
    marginBottom: 12,
  },
  modalListContent: {
    gap: 8,
  },
  modalOption: {
    borderRadius: 12,
    backgroundColor: '#eef2f7',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  modalOptionText: {
    fontSize: 16,
    color: '#0f172a',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
})

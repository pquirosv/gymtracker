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

type Step = 'setup' | 'builder'

type ExerciseOption = {
  id: string
  name: string
}

type RoutineRecord = {
  id: string
  total_days: number
}

type RoutineExerciseRecord = {
  id: string
  day_number: number
  exercise_id: string
  sets: number
  reps: number
  exercise_order: number
}

type RoutineExerciseDraft = {
  exerciseId: string
  exerciseName: string
  sets: number
  reps: number
  exerciseOrder: number
}

type RoutineDayDraft = {
  dayNumber: number
  exercises: RoutineExerciseDraft[]
}

type RoutineDraft = {
  totalDays: number
  activeDay: number
  days: RoutineDayDraft[]
}

type PendingExerciseForm = {
  isOpen: boolean
  exerciseId: string
  sets: string
  reps: string
  error: string
}

const emptyExerciseForm: PendingExerciseForm = {
  isOpen: false,
  exerciseId: '',
  sets: '',
  reps: '',
  error: '',
}

export default function CreateRoutineScreen() {
  const router = useRouter()
  const { session } = useAuth()
  const [step, setStep] = useState<Step>('setup')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [screenError, setScreenError] = useState('')
  const [setupError, setSetupError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [totalDaysInput, setTotalDaysInput] = useState('')
  const [pendingReducedDays, setPendingReducedDays] = useState<number | null>(null)
  const [catalog, setCatalog] = useState<ExerciseOption[]>([])
  const [existingRoutine, setExistingRoutine] = useState<RoutineRecord | null>(null)
  const [existingRoutineExercises, setExistingRoutineExercises] = useState<RoutineExerciseRecord[]>([])
  const [routineDraft, setRoutineDraft] = useState<RoutineDraft | null>(null)
  const [pendingExerciseForm, setPendingExerciseForm] = useState<PendingExerciseForm>(emptyExerciseForm)
  const [isExercisePickerOpen, setIsExercisePickerOpen] = useState(false)

  useEffect(() => {
    const userId = session?.user.id

    if (!userId) {
      setLoading(false)
      setScreenError('No se pudo identificar tu cuenta.')
      return
    }

    let isMounted = true

    const loadRoutineData = async () => {
      setLoading(true)
      setScreenError('')

      const [catalogResult, routineResult] = await Promise.all([
        supabase.from('exercises').select('id, name').order('name', { ascending: true }).returns<ExerciseOption[]>(),
        supabase
          .from('routines')
          .select('id, total_days')
          .eq('user_id', userId)
          .maybeSingle<RoutineRecord>(),
      ])

      if (!isMounted) {
        return
      }

      if (catalogResult.error || routineResult.error) {
        setScreenError('No se pudo cargar la pantalla de rutina.')
        setLoading(false)
        return
      }

      let routineExercises: RoutineExerciseRecord[] = []

      if (routineResult.data) {
        const routineExercisesResult = await supabase
          .from('routine_day_exercises')
          .select('id, day_number, exercise_id, sets, reps, exercise_order')
          .eq('routine_id', routineResult.data.id)
          .order('day_number', { ascending: true })
          .order('exercise_order', { ascending: true })
          .returns<RoutineExerciseRecord[]>()

        if (!isMounted) {
          return
        }

        if (routineExercisesResult.error) {
          setScreenError('No se pudo cargar la rutina actual.')
          setLoading(false)
          return
        }

        routineExercises = routineExercisesResult.data ?? []
      }

      setCatalog(catalogResult.data ?? [])
      setExistingRoutine(routineResult.data)
      setExistingRoutineExercises(routineExercises)
      setTotalDaysInput(routineResult.data ? String(routineResult.data.total_days) : '')
      setLoading(false)
    }

    loadRoutineData()

    return () => {
      isMounted = false
    }
  }, [session?.user.id])

  const activeDay = routineDraft ? routineDraft.days[routineDraft.activeDay - 1] : null
  const selectedExerciseName = catalog.find((exercise) => exercise.id === pendingExerciseForm.exerciseId)?.name ?? ''
  const availableExercises = activeDay
    ? catalog.filter(
        (exercise) =>
          !activeDay.exercises.some((dayExercise) => dayExercise.exerciseId === exercise.id)
      )
    : []

  const handleContinue = () => {
    const nextTotalDays = parsePositiveInteger(totalDaysInput)

    setSetupError('')
    setPendingReducedDays(null)

    if (!nextTotalDays) {
      setSetupError('Introduce un número de días válido.')
      return
    }

    if (existingRoutine && nextTotalDays < existingRoutine.total_days) {
      setPendingReducedDays(nextTotalDays)
      return
    }

    openBuilder(nextTotalDays)
  }

  const openBuilder = (totalDays: number) => {
    setPendingExerciseForm(emptyExerciseForm)
    setSaveError('')
    setRoutineDraft(buildRoutineDraft(existingRoutine, existingRoutineExercises, catalog, totalDays))
    setStep('builder')
  }

  const updateDraft = (updater: (draft: RoutineDraft) => RoutineDraft) => {
    setRoutineDraft((currentDraft) => {
      if (!currentDraft) {
        return currentDraft
      }

      return updater(currentDraft)
    })
  }

  const handleSelectDay = (dayNumber: number) => {
    updateDraft((currentDraft) => ({
      ...currentDraft,
      activeDay: dayNumber,
    }))

    setPendingExerciseForm(emptyExerciseForm)
    setSaveError('')
  }

  const handleOpenExerciseForm = () => {
    setPendingExerciseForm({
      isOpen: true,
      exerciseId: '',
      sets: '',
      reps: '',
      error: '',
    })
  }

  const handleCloseExerciseForm = () => {
    setPendingExerciseForm(emptyExerciseForm)
    setIsExercisePickerOpen(false)
  }

  const handleSaveExercise = () => {
    if (!routineDraft || !activeDay) {
      return
    }

    const sets = parsePositiveInteger(pendingExerciseForm.sets)
    const reps = parsePositiveInteger(pendingExerciseForm.reps)
    const selectedExercise = catalog.find((exercise) => exercise.id === pendingExerciseForm.exerciseId)

    if (!selectedExercise) {
      setPendingExerciseForm((currentForm) => ({
        ...currentForm,
        error: 'Selecciona un ejercicio.',
      }))
      return
    }

    if (!sets || !reps) {
      setPendingExerciseForm((currentForm) => ({
        ...currentForm,
        error: 'Series y repeticiones deben ser números enteros mayores que 0.',
      }))
      return
    }

    const alreadyExists = activeDay.exercises.some(
      (exercise) => exercise.exerciseId === selectedExercise.id
    )

    if (alreadyExists) {
      setPendingExerciseForm((currentForm) => ({
        ...currentForm,
        error: 'Ese ejercicio ya está añadido en este día.',
      }))
      return
    }

    updateDraft((currentDraft) => ({
      ...currentDraft,
      days: currentDraft.days.map((day) =>
        day.dayNumber === currentDraft.activeDay
          ? {
              ...day,
              exercises: [
                ...day.exercises,
                {
                  exerciseId: selectedExercise.id,
                  exerciseName: selectedExercise.name,
                  sets,
                  reps,
                  exerciseOrder: day.exercises.length + 1,
                },
              ],
            }
          : day
      ),
    }))

    setPendingExerciseForm(emptyExerciseForm)
    setIsExercisePickerOpen(false)
  }

  const handleRemoveExercise = (exerciseId: string) => {
    updateDraft((currentDraft) => ({
      ...currentDraft,
      days: currentDraft.days.map((day) =>
        day.dayNumber === currentDraft.activeDay
          ? {
              ...day,
              exercises: reindexExercises(
                day.exercises.filter((exercise) => exercise.exerciseId !== exerciseId)
              ),
            }
          : day
      ),
    }))
  }

  const handleSaveRoutine = async () => {
    const userId = session?.user.id

    if (!routineDraft || !userId) {
      return
    }

    setSaveError('')

    const hasEmptyDay = routineDraft.days.some((day) => day.exercises.length === 0)

    if (hasEmptyDay) {
      setSaveError('Cada día debe tener al menos un ejercicio.')
      return
    }

    setSaving(true)

    let routineId = existingRoutine?.id ?? ''

    if (existingRoutine) {
      const { error: updateRoutineError } = await supabase
        .from('routines')
        .update({
          total_days: routineDraft.totalDays,
          current_day: 1,
        })
        .eq('id', existingRoutine.id)

      if (updateRoutineError) {
        setSaveError('No se pudo actualizar la rutina.')
        setSaving(false)
        return
      }
    } else {
      const { data: insertedRoutine, error: insertRoutineError } = await supabase
        .from('routines')
        .insert({
          user_id: userId,
          total_days: routineDraft.totalDays,
          current_day: 1,
        })
        .select('id')
        .single<{ id: string }>()

      if (insertRoutineError || !insertedRoutine) {
        setSaveError('No se pudo crear la rutina.')
        setSaving(false)
        return
      }

      routineId = insertedRoutine.id
    }

    const { error: deleteExercisesError } = await supabase
      .from('routine_day_exercises')
      .delete()
      .eq('routine_id', routineId)

    if (deleteExercisesError) {
      setSaveError('No se pudo actualizar la lista de ejercicios.')
      setSaving(false)
      return
    }

    const routineExercisesPayload = routineDraft.days.flatMap((day) =>
      day.exercises.map((exercise, index) => ({
        routine_id: routineId,
        day_number: day.dayNumber,
        exercise_id: exercise.exerciseId,
        sets: exercise.sets,
        reps: exercise.reps,
        exercise_order: index + 1,
      }))
    )

    const { error: insertExercisesError } = await supabase
      .from('routine_day_exercises')
      .insert(routineExercisesPayload)

    if (insertExercisesError) {
      setSaveError('No se pudieron guardar los ejercicios de la rutina.')
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
        <Text style={styles.loadingTitle}>Cargando rutina</Text>
        <Text style={styles.loadingText}>Preparando tus ejercicios y tu configuración actual.</Text>
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

  if (step === 'setup') {
    return (
      <View style={styles.centeredScreen}>
        <View style={styles.card}>
          <Text style={styles.title}>Crear rutina</Text>
          <Text style={styles.body}>
            Define primero cuántos días tendrá tu rutina. Después podrás configurar los ejercicios de
            cada día.
          </Text>

          <Text style={styles.label}>Días totales</Text>
          <TextInput
            value={totalDaysInput}
            onChangeText={(value) => {
              setTotalDaysInput(onlyDigits(value))
              setSetupError('')
              setPendingReducedDays(null)
            }}
            keyboardType="number-pad"
            placeholder="Ejemplo: 4"
            style={styles.input}
          />

          {!!setupError && <Text style={styles.errorText}>{setupError}</Text>}

          {pendingReducedDays ? (
            <View style={styles.warningCard}>
              <Text style={styles.warningTitle}>Se recortará la rutina actual</Text>
              <Text style={styles.warningText}>
                Solo se conservarán en el borrador los primeros {pendingReducedDays} días de tu rutina
                actual.
              </Text>
              <View style={styles.warningActions}>
                <TouchableOpacity
                  style={styles.warningSecondaryButton}
                  onPress={() => setPendingReducedDays(null)}
                >
                  <Text style={styles.warningSecondaryButtonText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.warningPrimaryButton}
                  onPress={() => openBuilder(pendingReducedDays)}
                >
                  <Text style={styles.warningPrimaryButtonText}>Continuar</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          <TouchableOpacity style={styles.primaryButton} onPress={handleContinue}>
            <Text style={styles.primaryButtonText}>Continuar</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={() => router.replace('/')}>
            <Text style={styles.secondaryButtonText}>Volver al inicio</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.pageTitle}>Construye tu rutina</Text>
        <Text style={styles.pageSubtitle}>
          Tus {routineDraft?.totalDays ?? 0} días ya están fijados. Si quieres cambiarlos, sal de esta
          pantalla y vuelve a empezar.
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Días</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
            {routineDraft?.days.map((day) => {
              const isActive = routineDraft.activeDay === day.dayNumber

              return (
                <TouchableOpacity
                  key={day.dayNumber}
                  style={[styles.dayTab, isActive && styles.dayTabActive]}
                  onPress={() => handleSelectDay(day.dayNumber)}
                >
                  <Text style={[styles.dayTabText, isActive && styles.dayTabTextActive]}>
                    Día {day.dayNumber}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ejercicios del día {routineDraft?.activeDay}</Text>

          {activeDay?.exercises.length ? (
            activeDay.exercises.map((exercise) => (
              <View key={exercise.exerciseId} style={styles.exerciseCard}>
                <View style={styles.exerciseHeader}>
                  <View>
                    <Text style={styles.exerciseName}>{exercise.exerciseName}</Text>
                    <Text style={styles.exerciseMeta}>
                      {exercise.sets} series · {exercise.reps} repeticiones
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => handleRemoveExercise(exercise.exerciseId)}>
                    <Text style={styles.deleteText}>Eliminar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>Todavía no has añadido ejercicios a este día.</Text>
            </View>
          )}

          {pendingExerciseForm.isOpen ? (
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Nuevo ejercicio</Text>

              <Text style={styles.label}>Ejercicio</Text>
              <TouchableOpacity
                style={styles.selector}
                onPress={() => setIsExercisePickerOpen(true)}
                disabled={availableExercises.length === 0}
              >
                <Text style={selectedExerciseName ? styles.selectorValue : styles.selectorPlaceholder}>
                  {selectedExerciseName || 'Selecciona un ejercicio'}
                </Text>
              </TouchableOpacity>

              {availableExercises.length === 0 ? (
                <Text style={styles.helperText}>
                  Ya has añadido todos los ejercicios disponibles para este día.
                </Text>
              ) : null}

              <Text style={styles.label}>Series</Text>
              <TextInput
                value={pendingExerciseForm.sets}
                onChangeText={(value) =>
                  setPendingExerciseForm((currentForm) => ({
                    ...currentForm,
                    sets: onlyDigits(value),
                    error: '',
                  }))
                }
                keyboardType="number-pad"
                placeholder="Ejemplo: 4"
                style={styles.input}
              />

              <Text style={styles.label}>Repeticiones</Text>
              <TextInput
                value={pendingExerciseForm.reps}
                onChangeText={(value) =>
                  setPendingExerciseForm((currentForm) => ({
                    ...currentForm,
                    reps: onlyDigits(value),
                    error: '',
                  }))
                }
                keyboardType="number-pad"
                placeholder="Ejemplo: 10"
                style={styles.input}
              />

              {!!pendingExerciseForm.error && <Text style={styles.errorText}>{pendingExerciseForm.error}</Text>}

              <TouchableOpacity style={styles.primaryButton} onPress={handleSaveExercise}>
                <Text style={styles.primaryButtonText}>Guardar ejercicio</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.secondaryButton} onPress={handleCloseExerciseForm}>
                <Text style={styles.secondaryButtonText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.primaryButton} onPress={handleOpenExerciseForm}>
              <Text style={styles.primaryButtonText}>Nuevo ejercicio</Text>
            </TouchableOpacity>
          )}
        </View>

        {!!saveError && <Text style={styles.errorText}>{saveError}</Text>}

        <TouchableOpacity
          style={[styles.primaryButton, saving && styles.buttonDisabled]}
          onPress={handleSaveRoutine}
          disabled={saving}
        >
          <Text style={styles.primaryButtonText}>
            {saving ? 'Guardando rutina...' : 'Guardar rutina'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryButton, saving && styles.buttonDisabled]}
          onPress={() => router.replace('/')}
          disabled={saving}
        >
          <Text style={styles.secondaryButtonText}>Salir sin guardar</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={isExercisePickerOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setIsExercisePickerOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Selecciona un ejercicio</Text>
            <ScrollView style={styles.modalList} contentContainerStyle={styles.modalListContent}>
              {availableExercises.map((exercise) => (
                <TouchableOpacity
                  key={exercise.id}
                  style={styles.modalOption}
                  onPress={() => {
                    setPendingExerciseForm((currentForm) => ({
                      ...currentForm,
                      exerciseId: exercise.id,
                      error: '',
                    }))
                    setIsExercisePickerOpen(false)
                  }}
                >
                  <Text style={styles.modalOptionText}>{exercise.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => setIsExercisePickerOpen(false)}
            >
              <Text style={styles.secondaryButtonText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  )
}

function buildRoutineDraft(
  routine: RoutineRecord | null,
  routineExercises: RoutineExerciseRecord[],
  catalog: ExerciseOption[],
  totalDays: number
): RoutineDraft {
  const exerciseNameById = new Map(catalog.map((exercise) => [exercise.id, exercise.name]))
  const days = createEmptyDays(totalDays)

  routineExercises
    .filter((exercise) => exercise.day_number <= totalDays)
    .sort((left, right) => {
      if (left.day_number !== right.day_number) {
        return left.day_number - right.day_number
      }

      return left.exercise_order - right.exercise_order
    })
    .forEach((exercise) => {
      const targetDay = days[exercise.day_number - 1]

      if (!targetDay) {
        return
      }

      targetDay.exercises.push({
        exerciseId: exercise.exercise_id,
        exerciseName: exerciseNameById.get(exercise.exercise_id) ?? 'Ejercicio',
        sets: exercise.sets,
        reps: exercise.reps,
        exerciseOrder: targetDay.exercises.length + 1,
      })
    })

  return {
    totalDays,
    activeDay: 1,
    days,
  }
}

function createEmptyDays(totalDays: number): RoutineDayDraft[] {
  return Array.from({ length: totalDays }, (_, index) => ({
    dayNumber: index + 1,
    exercises: [],
  }))
}

function reindexExercises(exercises: RoutineExerciseDraft[]) {
  return exercises.map((exercise, index) => ({
    ...exercise,
    exerciseOrder: index + 1,
  }))
}

function onlyDigits(value: string) {
  return value.replace(/\D+/g, '')
}

function parsePositiveInteger(value: string) {
  const parsedValue = Number.parseInt(value, 10)

  if (!Number.isInteger(parsedValue) || parsedValue < 1) {
    return null
  }

  return parsedValue
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
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: '#475569',
    marginBottom: 20,
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
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 16,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
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
  selector: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
    marginBottom: 8,
  },
  selectorValue: {
    fontSize: 16,
    color: '#0f172a',
  },
  selectorPlaceholder: {
    fontSize: 16,
    color: '#94a3b8',
  },
  helperText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#64748b',
    marginBottom: 16,
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
  warningCard: {
    backgroundColor: '#fff7ed',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#fdba74',
    marginBottom: 16,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#9a3412',
    marginBottom: 8,
  },
  warningText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#9a3412',
    marginBottom: 12,
  },
  warningActions: {
    flexDirection: 'row',
    gap: 12,
  },
  warningSecondaryButton: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fdba74',
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  warningSecondaryButtonText: {
    color: '#9a3412',
    fontSize: 15,
    fontWeight: '600',
  },
  warningPrimaryButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#c2410c',
  },
  warningPrimaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  tabsRow: {
    gap: 12,
    paddingRight: 24,
  },
  dayTab: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: '#e2e8f0',
  },
  dayTabActive: {
    backgroundColor: '#0f172a',
  },
  dayTabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
  },
  dayTabTextActive: {
    color: '#ffffff',
  },
  exerciseCard: {
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
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  exerciseName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  exerciseMeta: {
    fontSize: 15,
    color: '#475569',
  },
  deleteText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#dc2626',
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#475569',
  },
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginTop: 8,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 16,
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

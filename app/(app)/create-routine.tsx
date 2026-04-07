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
type RoutineMode = 'manual' | 'automatic'
type RoutineSplit = 'upper_lower' | 'push_pull_legs'
type ExerciseUpperLowerGroup = 'upper' | 'lower'
type ExercisePplGroup = 'pull' | 'push' | 'legs'
type DayFocus = ExerciseUpperLowerGroup | ExercisePplGroup

type ExerciseOption = {
  id: string
  name: string
  upper_lower_group: ExerciseUpperLowerGroup
  ppl_group: ExercisePplGroup
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
  draftKey: string
  exerciseId: string
  sets: string
  reps: string
  exerciseOrder: number
}

type RoutineDayDraft = {
  dayNumber: number
  label: string
  focus: DayFocus | null
  exercises: RoutineExerciseDraft[]
}

type RoutineDraft = {
  totalDays: number
  activeDay: number
  mode: RoutineMode
  split: RoutineSplit | null
  days: RoutineDayDraft[]
}

type AutoTemplateDay = {
  label: string
  focus: DayFocus
  slots: string[][]
}

const DEFAULT_EXERCISE_SETS = '3'
const DEFAULT_EXERCISE_REPS = '10'

const AUTO_ROUTINE_TEMPLATES: Record<RoutineSplit, AutoTemplateDay[]> = {
  upper_lower: [
    {
      label: 'Upper A',
      focus: 'upper',
      slots: [
        ['Press banca', 'Flexiones', 'Fondos en paralelas'],
        ['Remo con barra', 'Remo con mancuerna', 'Remo en cable'],
        ['Dominadas', 'Jalón al pecho'],
        ['Press militar', 'Press Arnold'],
        ['Curl bíceps', 'Curl martillo', 'Curl predicador'],
        ['Extensión de tríceps en polea', 'Press francés', 'Press banca cerrado'],
      ],
    },
    {
      label: 'Lower A',
      focus: 'lower',
      slots: [
        ['Sentadilla', 'Prensa de piernas', 'Sentadilla búlgara'],
        ['Peso muerto', 'Peso muerto rumano', 'Buenos días'],
        ['Prensa de piernas', 'Extensión de cuádriceps', 'Step-up'],
        ['Curl femoral', 'Hip thrust', 'Puente de glúteo'],
        ['Elevación de gemelos de pie', 'Elevación de gemelos sentado'],
        ['Abdominales'],
      ],
    },
    {
      label: 'Upper B',
      focus: 'upper',
      slots: [
        ['Press banca inclinado', 'Aperturas con mancuernas', 'Press banca'],
        ['Remo con mancuerna', 'Remo T', 'Remo con barra'],
        ['Jalón al pecho', 'Dominadas'],
        ['Elevaciones laterales', 'Pájaros', 'Face pull'],
        ['Curl martillo', 'Curl bíceps', 'Curl predicador'],
        ['Fondos en paralelas', 'Extensión de tríceps en polea', 'Press francés'],
      ],
    },
    {
      label: 'Lower B',
      focus: 'lower',
      slots: [
        ['Prensa de piernas', 'Zancadas', 'Sentadilla búlgara'],
        ['Hip thrust', 'Peso muerto rumano', 'Puente de glúteo'],
        ['Extensión de cuádriceps', 'Step-up', 'Sentadilla'],
        ['Curl femoral', 'Peso muerto rumano', 'Hip thrust'],
        ['Elevación de gemelos sentado', 'Elevación de gemelos de pie'],
        ['Abdominales'],
      ],
    },
  ],
  push_pull_legs: [
    {
      label: 'Pull',
      focus: 'pull',
      slots: [
        ['Dominadas', 'Jalón al pecho'],
        ['Remo con barra', 'Remo con mancuerna', 'Remo en cable'],
        ['Face pull', 'Pájaros', 'Remo T'],
        ['Curl bíceps', 'Curl martillo'],
        ['Curl predicador', 'Curl martillo', 'Curl bíceps'],
      ],
    },
    {
      label: 'Push',
      focus: 'push',
      slots: [
        ['Press banca', 'Flexiones', 'Fondos en paralelas'],
        ['Press banca inclinado', 'Aperturas con mancuernas', 'Press banca'],
        ['Press militar', 'Press Arnold'],
        ['Elevaciones laterales', 'Press Arnold', 'Aperturas con mancuernas'],
        ['Extensión de tríceps en polea', 'Press francés', 'Press banca cerrado'],
      ],
    },
    {
      label: 'Legs',
      focus: 'legs',
      slots: [
        ['Sentadilla', 'Prensa de piernas', 'Sentadilla búlgara'],
        ['Peso muerto rumano', 'Peso muerto', 'Buenos días'],
        ['Extensión de cuádriceps', 'Zancadas', 'Step-up'],
        ['Curl femoral', 'Hip thrust', 'Puente de glúteo'],
        ['Elevación de gemelos de pie', 'Elevación de gemelos sentado'],
        ['Abdominales'],
      ],
    },
  ],
}

let draftExerciseCounter = 0

export default function CreateRoutineScreen() {
  const router = useRouter()
  const { session } = useAuth()
  const [step, setStep] = useState<Step>('setup')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [screenError, setScreenError] = useState('')
  const [setupError, setSetupError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [selectedMode, setSelectedMode] = useState<RoutineMode>('manual')
  const [selectedSplit, setSelectedSplit] = useState<RoutineSplit>('upper_lower')
  const [totalDaysInput, setTotalDaysInput] = useState('')
  const [pendingReducedDays, setPendingReducedDays] = useState<number | null>(null)
  const [catalog, setCatalog] = useState<ExerciseOption[]>([])
  const [existingRoutine, setExistingRoutine] = useState<RoutineRecord | null>(null)
  const [existingRoutineExercises, setExistingRoutineExercises] = useState<RoutineExerciseRecord[]>([])
  const [routineDraft, setRoutineDraft] = useState<RoutineDraft | null>(null)
  const [pickerExerciseKey, setPickerExerciseKey] = useState<string | null>(null)

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
        supabase
          .from('exercises')
          .select('id, name, upper_lower_group, ppl_group')
          .order('name', { ascending: true })
          .returns<ExerciseOption[]>(),
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
  const pickerExercise =
    pickerExerciseKey && activeDay
      ? activeDay.exercises.find((exercise) => exercise.draftKey === pickerExerciseKey) ?? null
      : null
  const pickerSelectedExerciseName =
    catalog.find((exercise) => exercise.id === pickerExercise?.exerciseId)?.name ?? ''
  const pickerOptions = activeDay
    ? getSelectableExercises(activeDay, catalog, routineDraft?.mode ?? 'manual', pickerExercise?.exerciseId ?? '')
    : []
  const canAddMoreExercises = !!activeDay
    && getSelectableExercises(activeDay, catalog, routineDraft?.mode ?? 'manual', '').length > 0

  const updateDraft = (updater: (draft: RoutineDraft) => RoutineDraft) => {
    setRoutineDraft((currentDraft) => {
      if (!currentDraft) {
        return currentDraft
      }

      return updater(currentDraft)
    })
  }

  const openBuilder = (draft: RoutineDraft) => {
    setPickerExerciseKey(null)
    setPendingReducedDays(null)
    setSetupError('')
    setSaveError('')
    setRoutineDraft(draft)
    setStep('builder')
  }

  const openManualBuilder = (totalDays: number) => {
    openBuilder(buildManualRoutineDraft(existingRoutineExercises, totalDays))
  }

  const openAutomaticBuilder = () => {
    openBuilder(buildAutomaticRoutineDraft(selectedSplit, catalog))
  }

  const handleContinue = () => {
    if (selectedMode === 'automatic') {
      openAutomaticBuilder()
      return
    }

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

    openManualBuilder(nextTotalDays)
  }

  const handleSelectDay = (dayNumber: number) => {
    updateDraft((currentDraft) => ({
      ...currentDraft,
      activeDay: dayNumber,
    }))

    setPickerExerciseKey(null)
    setSaveError('')
  }

  const handleAddExercise = () => {
    if (!activeDay) {
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
                createEmptyExerciseDraft(day.exercises.length + 1),
              ],
            }
          : day
      ),
    }))
    setSaveError('')
  }

  const updateExercise = (
    draftKey: string,
    updater: (exercise: RoutineExerciseDraft) => RoutineExerciseDraft
  ) => {
    updateDraft((currentDraft) => ({
      ...currentDraft,
      days: currentDraft.days.map((day) =>
        day.dayNumber === currentDraft.activeDay
          ? {
              ...day,
              exercises: day.exercises.map((exercise) =>
                exercise.draftKey === draftKey ? updater(exercise) : exercise
              ),
            }
          : day
      ),
    }))
    setSaveError('')
  }

  const handleRemoveExercise = (draftKey: string) => {
    updateDraft((currentDraft) => ({
      ...currentDraft,
      days: currentDraft.days.map((day) =>
        day.dayNumber === currentDraft.activeDay
          ? {
              ...day,
              exercises: reindexExercises(
                day.exercises.filter((exercise) => exercise.draftKey !== draftKey)
              ),
            }
          : day
      ),
    }))

    if (pickerExerciseKey === draftKey) {
      setPickerExerciseKey(null)
    }

    setSaveError('')
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

    const normalizedDays = routineDraft.days.map((day) => {
      const seenExerciseIds = new Set<string>()
      const exercises = day.exercises.map((exercise, index) => {
        const sets = parsePositiveInteger(exercise.sets)
        const reps = parsePositiveInteger(exercise.reps)

        if (!exercise.exerciseId || !sets || !reps || seenExerciseIds.has(exercise.exerciseId)) {
          return null
        }

        seenExerciseIds.add(exercise.exerciseId)

        return {
          exercise_id: exercise.exerciseId,
          sets,
          reps,
          exercise_order: index + 1,
        }
      })

      return {
        dayNumber: day.dayNumber,
        exercises,
      }
    })

    const hasInvalidExercises = normalizedDays.some((day) =>
      day.exercises.length !== routineDraft.days[day.dayNumber - 1]?.exercises.length
      || day.exercises.some((exercise) => exercise === null)
    )

    if (hasInvalidExercises) {
      setSaveError('Revisa cada día: no puede haber ejercicios repetidos ni series o repeticiones vacías.')
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

    const routineExercisesPayload = normalizedDays.flatMap((day) =>
      day.exercises
        .filter((exercise): exercise is NonNullable<typeof exercise> => exercise !== null)
        .map((exercise) => ({
          routine_id: routineId,
          day_number: day.dayNumber,
          ...exercise,
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
            Elige si quieres construir tu rutina manualmente o partir de una rutina automática por split.
          </Text>

          <Text style={styles.label}>Modo</Text>
          <View style={styles.modeOptions}>
            <TouchableOpacity
              style={[styles.modeCard, selectedMode === 'manual' && styles.modeCardActive]}
              onPress={() => {
                setSelectedMode('manual')
                setSetupError('')
                setPendingReducedDays(null)
              }}
            >
              <Text style={[styles.modeTitle, selectedMode === 'manual' && styles.modeTitleActive]}>
                Manual
              </Text>
              <Text
                style={[
                  styles.modeDescription,
                  selectedMode === 'manual' && styles.modeDescriptionActive,
                ]}
              >
                Tú eliges los días y añades cada ejercicio desde cero.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modeCard, selectedMode === 'automatic' && styles.modeCardActive]}
              onPress={() => {
                setSelectedMode('automatic')
                setSetupError('')
                setPendingReducedDays(null)
              }}
            >
              <Text
                style={[
                  styles.modeTitle,
                  selectedMode === 'automatic' && styles.modeTitleActive,
                ]}
              >
                Automática
              </Text>
              <Text
                style={[
                  styles.modeDescription,
                  selectedMode === 'automatic' && styles.modeDescriptionActive,
                ]}
              >
                Genera una base editable con ejercicios ya clasificados por split.
              </Text>
            </TouchableOpacity>
          </View>

          {selectedMode === 'manual' ? (
            <>
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
                      onPress={() => openManualBuilder(pendingReducedDays)}
                    >
                      <Text style={styles.warningPrimaryButtonText}>Continuar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
            </>
          ) : (
            <>
              <Text style={styles.label}>Split automático</Text>
              <View style={styles.splitOptions}>
                <TouchableOpacity
                  style={[styles.splitCard, selectedSplit === 'upper_lower' && styles.splitCardActive]}
                  onPress={() => setSelectedSplit('upper_lower')}
                >
                  <Text style={[styles.splitTitle, selectedSplit === 'upper_lower' && styles.splitTitleActive]}>
                    Upper / Lower
                  </Text>
                  <Text
                    style={[
                      styles.splitDescription,
                      selectedSplit === 'upper_lower' && styles.splitDescriptionActive,
                    ]}
                  >
                    4 días: Upper A, Lower A, Upper B y Lower B.
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.splitCard,
                    selectedSplit === 'push_pull_legs' && styles.splitCardActive,
                  ]}
                  onPress={() => setSelectedSplit('push_pull_legs')}
                >
                  <Text
                    style={[
                      styles.splitTitle,
                      selectedSplit === 'push_pull_legs' && styles.splitTitleActive,
                    ]}
                  >
                    Pull / Push / Legs
                  </Text>
                  <Text
                    style={[
                      styles.splitDescription,
                      selectedSplit === 'push_pull_legs' && styles.splitDescriptionActive,
                    ]}
                  >
                    3 días: uno de tirón, uno de empuje y uno de pierna.
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {existingRoutine ? (
            <Text style={styles.helperText}>
              Al guardar, la rutina nueva reemplazará la que tienes ahora mismo.
            </Text>
          ) : null}

          {!!setupError && <Text style={styles.errorText}>{setupError}</Text>}

          <TouchableOpacity style={styles.primaryButton} onPress={handleContinue}>
            <Text style={styles.primaryButtonText}>
              {selectedMode === 'manual' ? 'Continuar' : 'Generar rutina'}
            </Text>
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
        <Text style={styles.pageTitle}>
          {routineDraft?.mode === 'automatic' ? 'Rutina automática' : 'Construye tu rutina'}
        </Text>
        <Text style={styles.pageSubtitle}>
          {routineDraft?.mode === 'automatic'
            ? `Split ${getSplitLabel(routineDraft.split)} con ${routineDraft?.totalDays ?? 0} días. Puedes ajustar ejercicios, series y repeticiones antes de guardar.`
            : `Tus ${routineDraft?.totalDays ?? 0} días ya están fijados. Puedes editar cada ejercicio antes de guardar.`}
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
                    {day.label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{activeDay?.label ?? 'Día'}</Text>
          {activeDay?.focus ? (
            <Text style={styles.helperText}>
              Solo se mostrarán ejercicios compatibles con {getFocusLabel(activeDay.focus)}.
            </Text>
          ) : null}

          {activeDay?.exercises.length ? (
            activeDay.exercises.map((exercise, index) => {
              const selectedExercise = catalog.find((option) => option.id === exercise.exerciseId)

              return (
                <View key={exercise.draftKey} style={styles.exerciseCard}>
                  <View style={styles.exerciseHeader}>
                    <Text style={styles.exerciseName}>Ejercicio {index + 1}</Text>
                    <TouchableOpacity onPress={() => handleRemoveExercise(exercise.draftKey)}>
                      <Text style={styles.deleteText}>Eliminar</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.label}>Ejercicio</Text>
                  <TouchableOpacity
                    style={styles.selector}
                    onPress={() => setPickerExerciseKey(exercise.draftKey)}
                  >
                    <Text style={selectedExercise ? styles.selectorValue : styles.selectorPlaceholder}>
                      {selectedExercise?.name ?? 'Selecciona un ejercicio'}
                    </Text>
                  </TouchableOpacity>

                  <Text style={styles.label}>Series</Text>
                  <TextInput
                    value={exercise.sets}
                    onChangeText={(value) =>
                      updateExercise(exercise.draftKey, (currentExercise) => ({
                        ...currentExercise,
                        sets: onlyDigits(value),
                      }))
                    }
                    keyboardType="number-pad"
                    placeholder="Ejemplo: 3"
                    style={styles.input}
                  />

                  <Text style={styles.label}>Repeticiones</Text>
                  <TextInput
                    value={exercise.reps}
                    onChangeText={(value) =>
                      updateExercise(exercise.draftKey, (currentExercise) => ({
                        ...currentExercise,
                        reps: onlyDigits(value),
                      }))
                    }
                    keyboardType="number-pad"
                    placeholder="Ejemplo: 10"
                    style={styles.input}
                  />
                </View>
              )
            })
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>Todavía no has añadido ejercicios a este día.</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.primaryButton, !canAddMoreExercises && styles.buttonDisabled]}
            onPress={handleAddExercise}
            disabled={!canAddMoreExercises}
          >
            <Text style={styles.primaryButtonText}>Añadir ejercicio</Text>
          </TouchableOpacity>

          {!canAddMoreExercises ? (
            <Text style={styles.helperText}>
              Ya has utilizado todos los ejercicios disponibles para este día.
            </Text>
          ) : null}
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
        visible={pickerExerciseKey !== null}
        animationType="fade"
        transparent
        onRequestClose={() => setPickerExerciseKey(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Selecciona un ejercicio</Text>
            {!!pickerSelectedExerciseName && (
              <Text style={styles.modalSubtitle}>Actual: {pickerSelectedExerciseName}</Text>
            )}

            <ScrollView style={styles.modalList} contentContainerStyle={styles.modalListContent}>
              {pickerOptions.map((exercise) => (
                <TouchableOpacity
                  key={exercise.id}
                  style={styles.modalOption}
                  onPress={() => {
                    if (!pickerExerciseKey) {
                      return
                    }

                    updateExercise(pickerExerciseKey, (currentExercise) => ({
                      ...currentExercise,
                      exerciseId: exercise.id,
                    }))
                    setPickerExerciseKey(null)
                  }}
                >
                  <Text style={styles.modalOptionText}>{exercise.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity style={styles.secondaryButton} onPress={() => setPickerExerciseKey(null)}>
              <Text style={styles.secondaryButtonText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  )
}

function buildManualRoutineDraft(
  routineExercises: RoutineExerciseRecord[],
  totalDays: number
): RoutineDraft {
  const days = createManualDays(totalDays)

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
        draftKey: nextDraftExerciseKey(),
        exerciseId: exercise.exercise_id,
        sets: String(exercise.sets),
        reps: String(exercise.reps),
        exerciseOrder: targetDay.exercises.length + 1,
      })
    })

  return {
    totalDays,
    activeDay: 1,
    mode: 'manual',
    split: null,
    days,
  }
}

function buildAutomaticRoutineDraft(split: RoutineSplit, catalog: ExerciseOption[]): RoutineDraft {
  const days = AUTO_ROUTINE_TEMPLATES[split].map((template, index) => {
    const usedExerciseIds = new Set<string>()
    const exercises = template.slots
      .map((slotCandidates, slotIndex) => {
        const selectedExercise = pickExerciseForSlot(catalog, template.focus, usedExerciseIds, slotCandidates)

        if (!selectedExercise) {
          return null
        }

        usedExerciseIds.add(selectedExercise.id)

        return {
          draftKey: nextDraftExerciseKey(),
          exerciseId: selectedExercise.id,
          sets: DEFAULT_EXERCISE_SETS,
          reps: DEFAULT_EXERCISE_REPS,
          exerciseOrder: slotIndex + 1,
        }
      })
      .filter((exercise): exercise is RoutineExerciseDraft => exercise !== null)

    return {
      dayNumber: index + 1,
      label: template.label,
      focus: template.focus,
      exercises,
    }
  })

  return {
    totalDays: days.length,
    activeDay: 1,
    mode: 'automatic',
    split,
    days,
  }
}

function createManualDays(totalDays: number): RoutineDayDraft[] {
  return Array.from({ length: totalDays }, (_, index) => ({
    dayNumber: index + 1,
    label: `Día ${index + 1}`,
    focus: null,
    exercises: [],
  }))
}

function createEmptyExerciseDraft(exerciseOrder: number): RoutineExerciseDraft {
  return {
    draftKey: nextDraftExerciseKey(),
    exerciseId: '',
    sets: DEFAULT_EXERCISE_SETS,
    reps: DEFAULT_EXERCISE_REPS,
    exerciseOrder,
  }
}

function nextDraftExerciseKey() {
  draftExerciseCounter += 1
  return `routine-exercise-${draftExerciseCounter}`
}

function reindexExercises(exercises: RoutineExerciseDraft[]) {
  return exercises.map((exercise, index) => ({
    ...exercise,
    exerciseOrder: index + 1,
  }))
}

function getSelectableExercises(
  day: RoutineDayDraft,
  catalog: ExerciseOption[],
  mode: RoutineMode,
  currentExerciseId: string
) {
  return catalog.filter((exercise) => {
    if (mode === 'automatic' && day.focus && !exerciseMatchesDayFocus(exercise, day.focus)) {
      return false
    }

    const alreadyExists = day.exercises.some(
      (dayExercise) => dayExercise.exerciseId === exercise.id && exercise.id !== currentExerciseId
    )

    return !alreadyExists
  })
}

function exerciseMatchesDayFocus(exercise: ExerciseOption, focus: DayFocus) {
  if (focus === 'upper' || focus === 'lower') {
    return exercise.upper_lower_group === focus
  }

  return exercise.ppl_group === focus
}

function pickExerciseForSlot(
  catalog: ExerciseOption[],
  focus: DayFocus,
  usedExerciseIds: Set<string>,
  candidateNames: string[]
) {
  for (const candidateName of candidateNames) {
    const match = catalog.find(
      (exercise) =>
        exercise.name === candidateName
        && !usedExerciseIds.has(exercise.id)
        && exerciseMatchesDayFocus(exercise, focus)
    )

    if (match) {
      return match
    }
  }

  return catalog.find(
    (exercise) => !usedExerciseIds.has(exercise.id) && exerciseMatchesDayFocus(exercise, focus)
  ) ?? null
}

function getSplitLabel(split: RoutineSplit | null) {
  if (split === 'upper_lower') {
    return 'Upper / Lower'
  }

  if (split === 'push_pull_legs') {
    return 'Pull / Push / Legs'
  }

  return 'manual'
}

function getFocusLabel(focus: DayFocus) {
  switch (focus) {
    case 'upper':
      return 'tren superior'
    case 'lower':
      return 'tren inferior'
    case 'pull':
      return 'tirón'
    case 'push':
      return 'empuje'
    case 'legs':
      return 'pierna'
    default:
      return 'este día'
  }
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
  modeOptions: {
    gap: 12,
    marginBottom: 20,
  },
  modeCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    padding: 16,
  },
  modeCardActive: {
    borderColor: '#0f172a',
    backgroundColor: '#e2e8f0',
  },
  modeTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  modeTitleActive: {
    color: '#020617',
  },
  modeDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: '#475569',
  },
  modeDescriptionActive: {
    color: '#334155',
  },
  splitOptions: {
    gap: 12,
    marginBottom: 20,
  },
  splitCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    padding: 16,
  },
  splitCardActive: {
    borderColor: '#0f172a',
    backgroundColor: '#e2e8f0',
  },
  splitTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  splitTitleActive: {
    color: '#020617',
  },
  splitDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: '#475569',
  },
  splitDescriptionActive: {
    color: '#334155',
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
    marginBottom: 12,
  },
  exerciseName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
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

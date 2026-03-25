import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { Redirect, Slot } from 'expo-router'
import { useAuth } from '../../supabase/auth-context'

export default function AppLayout() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#0f172a" />
      </View>
    )
  }

  if (!session) {
    return <Redirect href="/login" />
  }

  return <Slot />
}

const styles = StyleSheet.create({
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f6f8',
  },
})

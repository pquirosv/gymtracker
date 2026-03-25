import { Stack } from 'expo-router'
import { AuthProvider } from '../supabase/auth-context'

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </AuthProvider>
  )
}

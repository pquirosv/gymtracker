import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'

export default function CheckEmailScreen() {
  const router = useRouter()

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.title}>Revisa tu correo</Text>
        <Text style={styles.message}>
          Se ha enviado un email para completar tu registro. Verifica tu cuenta y después
          inicia sesión.
        </Text>

        <TouchableOpacity style={styles.button} onPress={() => router.replace('/login')}>
          <Text style={styles.buttonText}>Ir a login</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f3f6f8',
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
  message: {
    fontSize: 16,
    lineHeight: 24,
    color: '#475569',
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
})

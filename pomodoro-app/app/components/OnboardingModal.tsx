import AsyncStorage from "@react-native-async-storage/async-storage";
import React from "react";
import {
  Modal,
  NativeModules,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const getLanguage = (): "es" | "en" => {
  if (Platform.OS === "ios") {
    const locale: string =
      NativeModules.SettingsManager?.settings?.AppleLocale ||
      NativeModules.SettingsManager?.settings?.AppleLanguages?.[0] ||
      "en";
    return locale.startsWith("es") ? "es" : "en";
  }
  return "en";
};

const content = {
  es: {
    title: "¿Qué es la técnica Pomodoro?",
    subtitle: "Un método para trabajar con más foco y menos estrés.",
    steps: [
      {
        icon: "📝",
        label: "Elige una tarea",
        desc: "Selecciona lo que vas a hacer.",
      },
      {
        icon: "🍅",
        label: "25 minutos de foco",
        desc: "Trabaja sin interrupciones hasta que suene el timer.",
      },
      {
        icon: "☕",
        label: "Descanso breve (5 min)",
        desc: "Para, respira y desconecta totalmente.",
      },
      {
        icon: "🔁",
        label: "Repite 4 veces",
        desc: "Completa cuatro pomodoros seguidos.",
      },
      {
        icon: "🌟",
        label: "Descanso largo (15–30 min)",
        desc: "Después de cuatro pomodoros, tómate un descanso largo.",
      },
    ],
    button: "¡Entendido!",
  },
  en: {
    title: "What is the Pomodoro Technique?",
    subtitle: "A method to work with more focus and less stress.",
    steps: [
      {
        icon: "📝",
        label: "Choose a task",
        desc: "Pick what you're going to work on.",
      },
      {
        icon: "🍅",
        label: "25 minutes of focus",
        desc: "Work without interruptions until the timer rings.",
      },
      {
        icon: "☕",
        label: "Short break (5 min)",
        desc: "Stop, breathe, and fully disconnect.",
      },
      {
        icon: "🔁",
        label: "Repeat 4 times",
        desc: "Complete four pomodoros in a row.",
      },
      {
        icon: "🌟",
        label: "Long break (15–30 min)",
        desc: "After four pomodoros, take a longer break.",
      },
    ],
    button: "Got it!",
  },
};

export const ONBOARDING_KEY = "hasSeenOnboarding";

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function OnboardingModal({ visible, onClose }: Props) {
  const lang = getLanguage();
  const t = content[lang];

  const handleClose = () => {
    onClose();
    AsyncStorage.setItem(ONBOARDING_KEY, "true");
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 8 }}
          >
            <Text style={styles.title}>{t.title}</Text>
            <Text style={styles.subtitle}>{t.subtitle}</Text>
            {t.steps.map((step, i) => (
              <View key={i} style={styles.step}>
                <Text style={styles.stepIcon}>{step.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stepLabel}>{step.label}</Text>
                  <Text style={styles.stepDesc}>{step.desc}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity style={styles.button} onPress={handleClose}>
            <Text style={styles.buttonText}>{t.button}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    backgroundColor: "#0077b6",
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxHeight: "80%",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.75)",
    textAlign: "center",
    marginBottom: 20,
  },
  step: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 14,
    gap: 12,
  },
  stepIcon: { fontSize: 24, marginTop: 2 },
  stepLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 2,
  },
  stepDesc: { fontSize: 13, color: "rgba(255,255,255,0.75)" },
  button: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 16,
  },
  buttonText: { color: "#0077b6", fontWeight: "700", fontSize: 16 },
});

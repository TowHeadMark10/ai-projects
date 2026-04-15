import { useEffect, useState } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

// Default times in minutes
const DEFAULT_WORK = 25;
const DEFAULT_BREAK = 5;

export default function Settings() {
  const router = useRouter();
  // Work time in minutes
  const [workMinutes, setWorkMinutes] = useState(DEFAULT_WORK);
  // Break time in minutes
  const [breakMinutes, setBreakMinutes] = useState(DEFAULT_BREAK);
  // Whether focus mode is enabled
  const [focusMode, setFocusMode] = useState(false);
  // Whether sound is muted
  const [muted, setMuted] = useState(false);
  // Holds the raw text while the user is manually typing (null = not editing)
  const [editWorkText, setEditWorkText] = useState<string | null>(null);
  const [editBreakText, setEditBreakText] = useState<string | null>(null);

  // Load saved values when the screen opens
  useEffect(() => {
    async function loadSettings() {
      const savedWork = await AsyncStorage.getItem("workMinutes");
      const savedBreak = await AsyncStorage.getItem("breakMinutes");
      // AsyncStorage only stores strings, so "true"/"false" need to be converted back to boolean
      const savedFocus = await AsyncStorage.getItem("focusMode");
      const savedMuted = await AsyncStorage.getItem("muted");
      // Convert string back to boolean
      if (savedMuted) setMuted(savedMuted === "true");
      if (savedWork) setWorkMinutes(Number(savedWork));
      if (savedBreak) setBreakMinutes(Number(savedBreak));
      if (savedFocus) setFocusMode(savedFocus === "true");
    }
    loadSettings();
  }, []);

  // Save values and go back
  async function saveAndGoBack() {
    await AsyncStorage.setItem("workMinutes", String(workMinutes));
    await AsyncStorage.setItem("breakMinutes", String(breakMinutes));
    // Save focus mode as string since AsyncStorage only supports strings
    await AsyncStorage.setItem("focusMode", String(focusMode));
    // Save mute setting as string
    await AsyncStorage.setItem("muted", String(muted));
    router.back();
  }

  return (
    // Aquarium blue background to match the main screen
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0077b6" }}>
      <ScrollView
        contentContainerStyle={{
          alignItems: "center",
          paddingTop: 64,
          paddingBottom: 48,
          paddingHorizontal: 24,
        }}
      >
        {/* Header row with back button and title */}
        <View
          style={{
            width: "100%",
            maxWidth: 400,
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 32,
          }}
        >
          <TouchableOpacity onPress={() => router.back()}>
            <View
              style={{
                backgroundColor: "rgba(255,255,255,0.15)",
                borderRadius: 20,
                padding: 8,
              }}
            >
              <Ionicons
                name="chevron-back"
                size={20}
                color="rgba(255,255,255,0.9)"
              />
            </View>
          </TouchableOpacity>
          <Text
            style={{
              color: "#ffffff",
              fontSize: 24,
              fontWeight: "bold",
              flex: 1,
              textAlign: "center",
              marginRight: 36,
            }}
          >
            Settings
          </Text>
        </View>

        {/* Work time control */}
        <View style={{ width: "100%", maxWidth: 400, marginBottom: 24 }}>
          <Text
            style={{
              color: "rgba(255,255,255,0.6)",
              fontSize: 11,
              letterSpacing: 1,
              marginBottom: 12,
            }}
          >
            WORK TIME
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: "rgba(0,0,0,0.2)",
              padding: 16,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.15)",
            }}
          >
            <TouchableOpacity
              onPress={() => setWorkMinutes((m) => Math.max(1, m - 1))}
              style={{
                backgroundColor: "#e8622a",
                width: 36,
                height: 36,
                borderRadius: 18,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: "#fff", fontSize: 20 }}>−</Text>
            </TouchableOpacity>
            {editWorkText !== null ? (
              <TextInput
                style={{
                  color: "#fff",
                  fontSize: 32,
                  fontWeight: "bold",
                  minWidth: 80,
                  textAlign: "center",
                }}
                value={editWorkText}
                keyboardType="number-pad"
                returnKeyType="done"
                autoFocus
                onChangeText={setEditWorkText}
                onBlur={() => {
                  const n = parseInt(editWorkText);
                  if (!isNaN(n)) setWorkMinutes(Math.min(60, Math.max(1, n)));
                  setEditWorkText(null);
                }}
                onSubmitEditing={() => {
                  const n = parseInt(editWorkText);
                  if (!isNaN(n)) setWorkMinutes(Math.min(60, Math.max(1, n)));
                  setEditWorkText(null);
                }}
              />
            ) : (
              <TouchableOpacity
                onPress={() => setEditWorkText(String(workMinutes))}
              >
                <Text
                  style={{ color: "#fff", fontSize: 32, fontWeight: "bold" }}
                >
                  {workMinutes}
                  min
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => setWorkMinutes((m) => Math.min(60, m + 1))}
              style={{
                backgroundColor: "#e8622a",
                width: 36,
                height: 36,
                borderRadius: 18,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: "#fff", fontSize: 20 }}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Break time control */}
        <View style={{ width: "100%", maxWidth: 400, marginBottom: 32 }}>
          <Text
            style={{
              color: "rgba(255,255,255,0.6)",
              fontSize: 11,
              letterSpacing: 1,
              marginBottom: 12,
            }}
          >
            BREAK TIME
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: "rgba(0,0,0,0.2)",
              padding: 16,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.15)",
            }}
          >
            <TouchableOpacity
              onPress={() => setBreakMinutes((m) => Math.max(1, m - 1))}
              style={{
                backgroundColor: "#e8622a",
                width: 36,
                height: 36,
                borderRadius: 18,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: "#fff", fontSize: 20 }}>−</Text>
            </TouchableOpacity>
            {editBreakText !== null ? (
              <TextInput
                style={{
                  color: "#fff",
                  fontSize: 32,
                  fontWeight: "bold",
                  minWidth: 80,
                  textAlign: "center",
                }}
                value={editBreakText}
                keyboardType="number-pad"
                returnKeyType="done"
                autoFocus
                onChangeText={setEditBreakText}
                onBlur={() => {
                  const n = parseInt(editBreakText);
                  if (!isNaN(n)) setBreakMinutes(Math.min(30, Math.max(1, n)));
                  setEditBreakText(null);
                }}
                onSubmitEditing={() => {
                  const n = parseInt(editBreakText);
                  if (!isNaN(n)) setBreakMinutes(Math.min(30, Math.max(1, n)));
                  setEditBreakText(null);
                }}
              />
            ) : (
              <TouchableOpacity
                onPress={() => setEditBreakText(String(breakMinutes))}
              >
                <Text
                  style={{ color: "#fff", fontSize: 32, fontWeight: "bold" }}
                >
                  {breakMinutes} min
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => setBreakMinutes((m) => Math.min(30, m + 1))}
              style={{
                backgroundColor: "#e8622a",
                width: 36,
                height: 36,
                borderRadius: 18,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: "#fff", fontSize: 20 }}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Focus mode toggle */}
        <View style={{ width: "100%", maxWidth: 400, marginBottom: 32 }}>
          <Text
            style={{
              color: "rgba(255,255,255,0.6)",
              fontSize: 11,
              letterSpacing: 1,
              marginBottom: 12,
            }}
          >
            FOCUS MODE
          </Text>
          <TouchableOpacity
            onPress={() => setFocusMode((f) => !f)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: "rgba(0,0,0,0.2)",
              padding: 16,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.15)",
            }}
          >
            <Text style={{ color: "#e0e0e0", fontSize: 15 }}>
              Pause timer when leaving app
            </Text>
            <View
              style={{
                width: 44,
                height: 24,
                borderRadius: 12,
                backgroundColor: focusMode
                  ? "#e8622a"
                  : "rgba(255,255,255,0.2)",
                justifyContent: "center",
                paddingHorizontal: 2,
              }}
            >
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  backgroundColor: "#fff",
                  alignSelf: focusMode ? "flex-end" : "flex-start",
                }}
              />
            </View>
          </TouchableOpacity>
        </View>

        {/* Mute toggle */}
        <View
          style={{
            width: "100%",
            maxWidth: 400,
            marginBottom: 32,
          }}
        >
          <Text
            style={{
              color: "rgba(255,255,255,0.6)",
              fontSize: 11,
              letterSpacing: 1,
              marginBottom: 12,
            }}
          >
            SOUND
          </Text>
          <TouchableOpacity
            onPress={() => setMuted((m) => !m)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: "rgba(0,0,0,0.2)",
              padding: 16,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.15)",
            }}
          >
            <Text style={{ color: "#e0e0e0", fontSize: 15 }}>
              Mute timer sounds
            </Text>
            <View
              style={{
                width: 44,
                height: 24,
                borderRadius: 12,
                backgroundColor: muted ? "#e8622a" : "rgba(255,255,255,0.2)",
                justifyContent: "center",
                paddingHorizontal: 2,
              }}
            >
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  backgroundColor: "#fff",
                  alignSelf: muted ? "flex-end" : "flex-start",
                }}
              />
            </View>
          </TouchableOpacity>
        </View>

        {/* Reset to default values */}
        <TouchableOpacity
          onPress={() => {
            setWorkMinutes(DEFAULT_WORK);
            setBreakMinutes(DEFAULT_BREAK);
            setFocusMode(false);
          }}
          style={{
            width: "100%",
            maxWidth: 400,
            paddingVertical: 14,
            borderRadius: 50,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.4)",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <Text style={{ color: "#fff", fontSize: 16 }}>Reset to defaults</Text>
        </TouchableOpacity>

        {/* Save button */}
        <TouchableOpacity
          onPress={saveAndGoBack}
          style={{
            backgroundColor: "#e8622a",
            paddingVertical: 14,
            paddingHorizontal: 48,
            borderRadius: 50,
            width: "100%",
            maxWidth: 400,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "bold" }}>
            Save
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

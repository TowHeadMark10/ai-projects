import { useEffect, useState } from "react";
import { Text, View, TouchableOpacity, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";

// Default times in minutes
const DEFAULT_WORK = 25;
const DEFAULT_BREAK = 5;

export default function Settings() {
  const router = useRouter();
  // Work time in minutes
  const [workMinutes, setWorkMinutes] = useState(DEFAULT_WORK);
  // Break time in minutes
  const [breakMinutes, setBreakMinutes] = useState(DEFAULT_BREAK);
  //Whether focus mode is enabled
  const [focusMode, setFocusMode] = useState(false);

  // Load saved values when the screen opens
  useEffect(() => {
    async function loadSettings() {
      const savedWork = await AsyncStorage.getItem("workMinutes");
      const savedBreak = await AsyncStorage.getItem("breakMinutes");
      // AsyncStorage only stores strings, so "true"/"false" need to be converted back to boolean
      const savedFocus = await AsyncStorage.getItem("focusMode");
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
    router.back();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0f0f1a" }}>
      <ScrollView
        contentContainerStyle={{
          alignItems: "center",
          paddingTop: 64,
          paddingBottom: 48,
          paddingHorizontal: 24,
        }}
      >
        <Text
          style={{
            color: "#ffffff",
            fontSize: 24,
            fontWeight: "bold",
            marginBottom: 32,
          }}
        >
          Settings
        </Text>

        {/* Work time control */}
        <View style={{ width: "100%", maxWidth: 400, marginBottom: 24 }}>
          <Text
            style={{
              color: "#888",
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
              backgroundColor: "#1e1e30",
              padding: 16,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "#2a2a4e",
            }}
          >
            <TouchableOpacity
              onPress={() => setWorkMinutes((m) => Math.max(1, m - 1))}
              style={{
                backgroundColor: "#2a2a5e",
                width: 36,
                height: 36,
                borderRadius: 18,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: "#fff", fontSize: 20 }}>−</Text>
            </TouchableOpacity>
            <Text style={{ color: "#fff", fontSize: 32, fontWeight: "bold" }}>
              {workMinutes} min
            </Text>
            <TouchableOpacity
              onPress={() => setWorkMinutes((m) => Math.min(60, m + 1))}
              style={{
                backgroundColor: "#2a2a5e",
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
              color: "#888",
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
              backgroundColor: "#1e1e30",
              padding: 16,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "#2a2a4e",
            }}
          >
            <TouchableOpacity
              onPress={() => setBreakMinutes((m) => Math.max(1, m - 1))}
              style={{
                backgroundColor: "#2a2a5e",
                width: 36,
                height: 36,
                borderRadius: 18,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: "#fff", fontSize: 20 }}>−</Text>
            </TouchableOpacity>
            <Text style={{ color: "#fff", fontSize: 32, fontWeight: "bold" }}>
              {breakMinutes} min
            </Text>
            <TouchableOpacity
              onPress={() => setBreakMinutes((m) => Math.min(30, m + 1))}
              style={{
                backgroundColor: "#2a2a5e",
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
              color: "#888",
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
              backgroundColor: "#1e1e30",
              padding: 16,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "#2a2a4e",
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
                backgroundColor: focusMode ? "#e94560" : "#2a2a4e",
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
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "#333",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <Text style={{ color: "#aaa", fontSize: 16 }}>Reset to defaults</Text>
        </TouchableOpacity>

        {/* Save button */}
        <TouchableOpacity
          onPress={saveAndGoBack}
          style={{
            backgroundColor: "#e94560",
            paddingVertical: 14,
            paddingHorizontal: 48,
            borderRadius: 50,
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

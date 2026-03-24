import { useState } from "react";
import { Text, View, TouchableOpacity, ScrollView } from "react-native";
import { useRouter } from "expo-router";

export default function Settings() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: "#0f0f1a" }}>
      <ScrollView
        contentContainerStyle={{
          alignItems: "center",
          paddingVertical: 48,
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

        {/* Back button */}
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: "#e94560" }}>← Back</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

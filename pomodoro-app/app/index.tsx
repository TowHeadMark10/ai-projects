import { Audio } from "expo-av";
import * as Notifications from "expo-notifications";
import { useState, useEffect, useRef, useCallback } from "react";
import { BlurView } from "expo-blur";
import {
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Animated,
  AppState,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";

// Default times in seconds
const DEFAULT_WORK = 25 * 60;
const DEFAULT_BREAK = 5 * 60;
// Available task categories
const CATEGORIES = [
  { label: "Work", emoji: "💼", color: "#0077b6" },
  { label: "Personal", emoji: "🙋", color: "#7b2d8b" },
  { label: "Home", emoji: "🏠", color: "#e07b39" },
  { label: "Health", emoji: "💪", color: "#2d9e5f" },
  { label: "Learning", emoji: "📚", color: "#c9a227" },
];
const FISH_TYPES = [
  { emoji: "🐟", size: 28, speed: 4000 }, // small, unlocks early
  { emoji: "🐠", size: 34, speed: 3500 },
  { emoji: "🐡", size: 32, speed: 4500 },
  { emoji: "🦈", size: 44, speed: 3000 }, // big, unlocks later
  { emoji: "🐙", size: 40, speed: 5000 },
  { emoji: "🦑", size: 38, speed: 3800 },
  { emoji: "🐬", size: 48, speed: 2800 }, // largest, unlocks at end
  { emoji: "🐳", size: 54, speed: 2500 },
];
const MAX_FISH = 20;

export default function Index() {
  // Hook to navigate between screens
  const router = useRouter();
  // Seconds remaining on the timer
  const [seconds, setSeconds] = useState(DEFAULT_WORK);
  // Work time in seconds (can be changed in settings)
  const [workTime, setWorkTime] = useState(DEFAULT_WORK);
  // Break time in seconds (can be changed in settings)
  const [breakTime, setBreakTime] = useState(DEFAULT_BREAK);
  // Whether the timer is currently running
  const [isRunning, setIsRunning] = useState(false);
  // Whether we are in work mode or break mode
  const [isBreak, setisBreak] = useState(false);
  // Counts how many pomodoros (work sessions) have been completed
  const [pomodoroCount, setPomodoroCount] = useState(0);
  // Each task has a title, a done status and a category
  const [tasks, setTasks] = useState<
    { title: string; done: boolean; category: string }[]
  >([]);
  // Text currently typed in the input
  const [taskInput, setTaskInput] = useState("");
  // Category selected when adding a new task
  const [selectedCategory, setSelectedCategory] = useState("Work");
  // Category filter to show only tasks of a certain category (null = show all)
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  // Index of the task being edited (null means no task is being edited)
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  // Text in the edit input
  const [editInput, setEditInput] = useState("");
  // Reference to the interval so we can cancel it later
  const IntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Tracks if the timer was running before going to background
  const wasRunningRef = useRef(false);
  // Always holds the latest value of isRunning (for use inside callbacks)
  const isRunningRef = useRef(false);
  // Always holds the latest value of seconds (for use inside callbacks)
  const secondsRef = useRef(seconds);
  useEffect(() => {
    secondsRef.current = seconds;
  }, [seconds]);

  // Always holds the latest work/break times (for use inside callbacks)
  const workTimeRef = useRef(workTime);
  useEffect(() => {
    workTimeRef.current = workTime;
  }, [workTime]);
  // Holds the ID of the scheduled notification so we can cancel it if needed
  const notificationIdRef = useRef<string | null>(null);
  // Stores the timestamp (ms) when the timer is expected to end
  const timerEndTimeRef = useRef<number | null>(null);
  const breakTimeRef = useRef(breakTime);
  // Bubble animations — each bubble rises independently
  const bubble1Y = useRef(new Animated.Value(0)).current;
  const bubble2Y = useRef(new Animated.Value(0)).current;
  const bubble3Y = useRef(new Animated.Value(0)).current;
  const bubble4Y = useRef(new Animated.Value(0)).current;
  const bubble1Opacity = useRef(new Animated.Value(0)).current;
  const bubble2Opacity = useRef(new Animated.Value(0)).current;
  const bubble3Opacity = useRef(new Animated.Value(0)).current;
  const bubble4Opacity = useRef(new Animated.Value(0)).current;
  // Whether focus mode is enabled (pauses timer when leaving app)
  const [focusMode, setFocusMode] = useState(false);
  // Whether timer sounds are muted
  const [muted, setMuted] = useState(false);
  // List of active fish currently in the tank
  const [activeFish, setActiveFish] = useState<
    {
      id: number;
      emoji: string;
      size: number;
      speed: number;
      x: Animated.Value;
      scaleX: Animated.Value;
      y: number;
    }[]
  >([]);
  // Counter to assign unique IDs to each fish
  const fishIdRef = useRef(0);
  // Ref to the interval that spawns new fish
  const fishSpawnIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  // Opacity for fade-out on reset
  const fishContainerOpacity = useRef(new Animated.Value(1)).current;
  // Always holds latest workTime for fish spawn calculations
  const activeFishRef = useRef(activeFish);
  useEffect(() => {
    activeFishRef.current = activeFish;
  }, [activeFish]);

  // Spawn and despawn fish based on timer state
  useEffect(() => {
    if (isRunning) {
      // Fade the fish container back in (in case it was faded out by reset)
      fishContainerOpacity.stopAnimation();
      Animated.timing(fishContainerOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();

      // Spawn a new fish every 8 seconds if under the limit
      fishSpawnIntervalRef.current = setInterval(() => {
        if (activeFishRef.current.length >= MAX_FISH) return;

        // Unlock more fish types as the timer progresses
        // Early in session → only small fish; later → bigger/colorful ones
        const progress = 1 - secondsRef.current / workTimeRef.current;
        const maxTypeIndex = Math.floor(progress * FISH_TYPES.length);
        const availableTypes = FISH_TYPES.slice(
          0,
          Math.max(1, maxTypeIndex + 1),
        );
        const type =
          availableTypes[Math.floor(Math.random() * availableTypes.length)];

        const newFish = {
          id: fishIdRef.current++,
          emoji: type.emoji,
          size: type.size,
          speed: type.speed,
          x: new Animated.Value(-50),
          scaleX: new Animated.Value(-1),
          // Random vertical position in the water (not too close to sand or top)
          y: Math.random() * 400 + 80,
        };

        swimNewFish(newFish);
        setActiveFish((prev) => [...prev, newFish]);
      }, 8000);
    } else {
      clearInterval(fishSpawnIntervalRef.current!);
    }

    return () => clearInterval(fishSpawnIntervalRef.current!);
  }, [isRunning]);

  // Start or stop the interval whenever isRunning changes
  useEffect(() => {
    if (isRunning) {
      // Save when the timer should end so we can recalculate after going to background
      timerEndTimeRef.current = Date.now() + secondsRef.current * 1000;
      // Schedule a notification for when the timer ends
      (async () => {
        // Cancel any previously scheduled notification first
        if (notificationIdRef.current) {
          await Notifications.cancelScheduledNotificationAsync(
            notificationIdRef.current,
          );
        }
        const id = await Notifications.scheduleNotificationAsync({
          content: {
            title: isBreak ? "Break over! 💼" : "🍅 Pomodoro complete!",
            body: isBreak ? "Time to focus." : "Time for a break.",
            sound: "alarm.mp3",
            categoryIdentifier: "timer",
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds,
          },
        });
        notificationIdRef.current = id;
      })();
      IntervalRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s <= 1) {
            clearInterval(IntervalRef.current!);
            // Cancel the notification — we handle the timer end in-app
            if (notificationIdRef.current) {
              Notifications.cancelScheduledNotificationAsync(
                notificationIdRef.current,
              );
              notificationIdRef.current = null;
            }
            setIsRunning(false);
            setisBreak((prev) => {
              if (prev) {
                if (!muted) playAlarm();
              } else {
                if (!muted) playChime();
              }
              const nextisBreak = !prev;
              if (nextisBreak) setPomodoroCount((c) => c + 1);
              setSeconds(nextisBreak ? breakTime : workTime);
              return nextisBreak;
            });
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    } else {
      // Timer paused or reset — cancel the scheduled notification
      if (notificationIdRef.current) {
        Notifications.cancelScheduledNotificationAsync(
          notificationIdRef.current,
        );
        notificationIdRef.current = null;
      }
      clearInterval(IntervalRef.current!);
    }
    return () => clearInterval(IntervalRef.current!);
  }, [isRunning]);

  // Reload work/break times every time the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      async function loadTimes() {
        const savedWork = await AsyncStorage.getItem("workMinutes");
        const savedBreak = await AsyncStorage.getItem("breakMinutes");
        // Load focus mode setting
        const savedFocus = await AsyncStorage.getItem("focusMode");
        const savedMuted = await AsyncStorage.getItem("muted");
        // Convert string back to boolean
        if (savedMuted) setMuted(savedMuted === "true");
        if (savedWork) {
          const ms = Number(savedWork) * 60;
          setWorkTime(ms);
          // Only reset the timer if it's not currently running
          if (!isRunningRef.current) setSeconds(ms);
        }
        if (savedBreak) {
          setBreakTime(Number(savedBreak) * 60);
        }
        if (savedFocus) setFocusMode(savedFocus === "true");
      }
      loadTimes();
    }, []),
  );
  // Keep isRunningRef in sync with isRunning state
  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  // Listen for notification action responses (e.g. "Mute sounds" button)
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        if (response.actionIdentifier === "mute") {
          setMuted(true);
          AsyncStorage.setItem("muted", "true");
        }
      },
    );
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    secondsRef.current = seconds;
  }, [seconds]);

  useEffect(() => {
    workTimeRef.current = workTime;
  }, [workTime]);
  useEffect(() => {
    breakTimeRef.current = breakTime;
  }, [breakTime]);

  // Pause timer when app goes to background, resume when coming back (only if focus mode is on)
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "background" && isRunningRef.current) {
        // Save when the timer should end
        timerEndTimeRef.current = Date.now() + secondsRef.current * 1000;
        if (focusMode) {
          wasRunningRef.current = true;
          setIsRunning(false);
        }
      } else if (nextState === "active") {
        if (focusMode && wasRunningRef.current) {
          // Focus mode: resume timer
          setIsRunning(true);
          wasRunningRef.current = false;
        } else if (
          !focusMode &&
          timerEndTimeRef.current &&
          isRunningRef.current
        ) {
          // No focus mode: recalculate remaining time
          const remaining = Math.round(
            (timerEndTimeRef.current - Date.now()) / 1000,
          );
          timerEndTimeRef.current = null;
          if (remaining > 0) {
            setSeconds(remaining);
          } else {
            // Timer already ended while in background — switch modes
            setIsRunning(false);
            setisBreak((prev) => {
              const nextIsBreak = !prev;
              if (nextIsBreak) setPomodoroCount((c) => c + 1);
              setSeconds(
                nextIsBreak ? breakTimeRef.current : workTimeRef.current,
              );
              return nextIsBreak;
            });
          }
        }
      }
    });
    return () => subscription.remove();
  }, [focusMode]);

  // Animates a single bubble rising from the bottom and fading out
  function riseBubble(
    bubbleY: Animated.Value,
    bubbleOpacity: Animated.Value,
    delay: number,
  ) {
    bubbleY.setValue(0);
    bubbleOpacity.setValue(0);
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(bubbleY, {
          toValue: -600,
          duration: 4000,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(bubbleOpacity, {
            toValue: 0.6,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(bubbleOpacity, {
            toValue: 0,
            duration: 3500,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start(() => riseBubble(bubbleY, bubbleOpacity, 0));
  }

  useEffect(() => {
    // Start each bubble with a different delay so they don't all rise together
    riseBubble(bubble1Y, bubble1Opacity, 0);
    riseBubble(bubble2Y, bubble2Opacity, 1000);
    riseBubble(bubble3Y, bubble3Opacity, 2200);
    riseBubble(bubble4Y, bubble4Opacity, 3500);
  }, []);

  // Converts seconds to MM:SS format. padStart(2,"0") makes sure it always has two digits - so it shows 04:05 and not 4:5
  function formatTime(s: number) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }

  // Reset goes back to work mode
  function reset() {
    setIsRunning(false);
    setisBreak(false);
    setSeconds(workTime);
    // Stop any ongoing opacity animation before starting fade-out
    fishContainerOpacity.stopAnimation();
    Animated.timing(fishContainerOpacity, {
      toValue: 0,
      duration: 800,
      useNativeDriver: true,
    }).start(() => {
      setActiveFish([]);
    });
  }

  // Skips the break and goes back to work mode immediately
  function skipBreak() {
    setisBreak(false); // returns to work mode
    setIsRunning(false); // pauses the timer so the user can start it whenever they want
    setSeconds(workTime); // loads the 25 mins again
  }

  // Animates a fish swimming across the screen and removes it when done
  function swimNewFish(fish: {
    id: number;
    x: Animated.Value;
    scaleX: Animated.Value;
    speed: number;
  }) {
    // Face right and swim to the end
    fish.scaleX.setValue(-1);
    Animated.timing(fish.x, {
      toValue: 400,
      duration: fish.speed,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;
      // Face left and swim back
      fish.scaleX.setValue(1);
      Animated.timing(fish.x, {
        toValue: -50,
        duration: fish.speed,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) return;
        // Loop forever
        swimNewFish(fish);
      });
    });
  }

  // Plays a soft chime sound when work session ends
  async function playChime() {
    const { sound } = await Audio.Sound.createAsync(
      require("../assets/sounds/chime.mp3"),
      { shouldPlay: true },
    );
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) sound.unloadAsync();
    });
  }

  // Plays an alarm sound when break session ends
  async function playAlarm() {
    const { sound } = await Audio.Sound.createAsync(
      require("../assets/sounds/alarm.mp3"),
      { shouldPlay: true },
    );
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) sound.unloadAsync();
    });
  }

  // Adds a new task to the list
  function addTask() {
    if (!taskInput.trim()) return;
    // Use the active filter as the category, or "Work" if no filter is selected
    const category = filterCategory ?? "Work";
    setTasks([...tasks, { title: taskInput.trim(), done: false, category }]);
    setTaskInput("");
  }
  //Removes a task by its index
  function deleteTask(index: number) {
    setTasks(tasks.filter((_, i) => i != index));
  }
  // Toggles a task between done and not done
  function toggleTask(index: number) {
    setTasks(
      tasks.map((task, i) =>
        i === index ? { ...task, done: !task.done } : task,
      ),
    );
  }
  // Sets a task into edit mode
  function startEdit(index: number) {
    setEditingIndex(index);
    setEditInput(tasks[index].title);
    // Load current category so it can be edited
    setSelectedCategory(tasks[index].category);
  }
  //Saves the edited task
  function saveEdit() {
    if (!editInput.trim()) return;
    setTasks(
      tasks.map((task, i) =>
        i === editingIndex
          ? { ...task, title: editInput.trim(), category: selectedCategory }
          : task,
      ),
    );
    setEditingIndex(null);
    setEditInput("");
  }

  return (
    <View style={{ flex: 1 }}>
      {/* ── AQUARIUM BACKGROUND ── */}
      <View
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      >
        {/* Water — crystal aqua blue */}
        <View style={{ flex: 1, backgroundColor: "#06b6d4" }} />
        {/* Sand at the bottom */}
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 60,
            backgroundColor: "#c2a46e",
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
          }}
        />
        {/* Darker sand stripe */}
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 30,
            backgroundColor: "#a8895a",
            borderTopLeftRadius: 12,
            borderTopRightRadius: 12,
          }}
        />
      </View>
      {/* Rock 1 - left side */}
      <View
        style={{
          position: "absolute",
          bottom: 45,
          left: 30,
          width: 50,
          height: 35,
          backgroundColor: "#6b6b6b",
          borderRadius: 20,
        }}
      />
      {/* Rock 2 - right side, smaller */}
      <View
        style={{
          position: "absolute",
          bottom: 42,
          right: 50,
          width: 35,
          height: 25,
          backgroundColor: "#555555",
          borderRadius: 15,
        }}
      />
      {/* Rock 3 - right side, behind rock 2 */}
      <View
        style={{
          position: "absolute",
          bottom: 48,
          right: 30,
          width: 45,
          height: 30,
          backgroundColor: "#4a4a4a",
          borderRadius: 18,
        }}
      />

      {/* Plant 1 - left, tall */}
      <View style={{ position: "absolute", bottom: 55, left: 20 }}>
        <Text style={{ fontSize: 40 }}>🌿</Text>
      </View>
      {/* Plant 2 - left, shorter */}
      <View style={{ position: "absolute", bottom: 52, left: 55 }}>
        <Text style={{ fontSize: 28 }}>🌱</Text>
      </View>
      {/* Plant 3 - right */}
      <View style={{ position: "absolute", bottom: 55, right: 20 }}>
        <Text style={{ fontSize: 36 }}>🪸 </Text>
      </View>
      {/* Plant 4 - right, behind */}
      <View style={{ position: "absolute", bottom: 52, right: 55 }}>
        <Text style={{ fontSize: 28 }}>🌿</Text>
      </View>

      {/* Castle decoration - center */}
      <View style={{ position: "absolute", bottom: 58, left: "43%" }}>
        <Text style={{ fontSize: 32 }}>🏰</Text>
      </View>
      {/* Bubbles rising from the bottom */}
      <Animated.View
        style={{
          position: "absolute",
          bottom: 60,
          left: "20%",
          opacity: bubble1Opacity,
          transform: [{ translateY: bubble1Y }],
        }}
      >
        <View
          style={{
            width: 14,
            height: 14,
            borderRadius: 7,
            backgroundColor: "#90e0ef55",
            borderWidth: 1,
            borderColor: "#90e0ef99",
          }}
        />
      </Animated.View>

      <Animated.View
        style={{
          position: "absolute",
          bottom: 60,
          left: "45%",
          opacity: bubble2Opacity,
          transform: [{ translateY: bubble2Y }],
        }}
      >
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: "#90e0ef33",
            borderWidth: 1,
            borderColor: "#90e0ef88",
          }}
        />
      </Animated.View>

      <Animated.View
        style={{
          position: "absolute",
          bottom: 60,
          right: "25%",
          opacity: bubble3Opacity,
          transform: [{ translateY: bubble3Y }],
        }}
      >
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: "#90e0ef44",
            borderWidth: 1,
            borderColor: "#90e0ef77",
          }}
        />
      </Animated.View>

      <Animated.View
        style={{
          position: "absolute",
          bottom: 60,
          left: "65%",
          opacity: bubble4Opacity,
          transform: [{ translateY: bubble4Y }],
        }}
      >
        <View
          style={{
            width: 16,
            height: 16,
            borderRadius: 8,
            backgroundColor: "#90e0ef33",
            borderWidth: 1,
            borderColor: "#90e0ef88",
          }}
        />
      </Animated.View>

      {/* Dynamic fish — appear as timer progresses */}
      <Animated.View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: fishContainerOpacity,
        }}
      >
        {activeFish.map((fish) => (
          <Animated.Text
            key={fish.id}
            style={{
              position: "absolute",
              top: fish.y,
              fontSize: fish.size,
              transform: [{ translateX: fish.x }, { scaleX: fish.scaleX }],
            }}
          >
            {fish.emoji}
          </Animated.Text>
        ))}
      </Animated.View>

      {/* ── CONTENT ON TOP ── */}
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{
            alignItems: "center",
            paddingVertical: 48,
            paddingHorizontal: 24,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* ── TIMER SECTION ── */}
          <View
            style={{
              alignItems: "center",
              width: "100%",
              maxWidth: 400,
              padding: 24,
              marginBottom: 16,
            }}
          >
            {/* Mode label + pomodoro count + settings button */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
                marginBottom: 8,
                gap: 12,
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
              >
                <View
                  style={{
                    backgroundColor: "rgba(0,0,0,0.2)",
                    borderWidth: 0,
                    paddingHorizontal: 12,
                    paddingVertical: 4,
                    borderRadius: 6,
                  }}
                >
                  <Text
                    style={{
                      color: "rgba(255,255,255,0.9)",
                      fontSize: 14,
                      fontWeight: "bold",
                      letterSpacing: 2,
                    }}
                  >
                    {isBreak ? "BREAK" : "FOCUS"}
                  </Text>
                </View>
                <Text style={{ color: "#fff", fontSize: 16 }}>
                  🍅 {pomodoroCount}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => router.push("/settings" as any)}
                style={{ position: "absolute", right: 0 }}
              >
                <Text style={{ color: "#555", fontSize: 20 }}>⚙️ </Text>
              </TouchableOpacity>
            </View>

            {/* Timer — transparent glass effect using stacked text */}
            <View style={{ marginBottom: 4 }}>
              {/* White outline layer */}
              <Text
                style={{
                  fontSize: 135,
                  color: "transparent",
                  fontWeight: "bold",
                  letterSpacing: -2,
                  textShadowColor: "rgba(255,255,255,0.9)",
                  textShadowOffset: { width: 0, height: 0 },
                  textShadowRadius: 30,
                }}
              >
                {formatTime(seconds)}
              </Text>
              {/* Transparent fill layer on top */}
              <Text
                style={{
                  fontSize: 135,
                  color: "rgba(255,255,255,0.6)",
                  fontWeight: "bold",
                  letterSpacing: -2,
                  position: "absolute",
                  top: 0,
                  left: 0,
                }}
              >
                {formatTime(seconds)}
              </Text>
            </View>

            {/* Skip break */}
            {isBreak && (
              <TouchableOpacity
                onPress={skipBreak}
                style={{
                  backgroundColor: "rgba(0,0,0,0.2)",
                  borderColor: "rgba(255,255,255,0.6)",
                  paddingHorizontal: 20,
                  paddingVertical: 10,
                  borderRadius: 50,
                  borderWidth: 1,
                  marginBottom: 8,
                }}
              >
                <Text
                  style={{ color: "#ffffff", fontSize: 14, fontWeight: "bold" }}
                >
                  Skip break →
                </Text>
              </TouchableOpacity>
            )}

            {/* Buttons */}
            <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
              <TouchableOpacity
                onPress={() => setIsRunning(!isRunning)}
                style={{
                  backgroundColor: isRunning
                    ? "rgba(255,255,255,0.15)"
                    : "#ff6b35",
                  paddingVertical: 14,
                  paddingHorizontal: 40,
                  borderRadius: 50,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{ color: "#fff", fontSize: 16, fontWeight: "bold" }}
                >
                  {isRunning ? "Pause" : "Start"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={reset}
                style={{
                  backgroundColor: "rgba(255,255,255,0.1)",
                  paddingVertical: 14,
                  paddingHorizontal: 24,
                  borderRadius: 50,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.4)",
                }}
              >
                <Text style={{ color: "#fff", fontSize: 16 }}>Reset</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── TASKS SECTION ── */}
          <BlurView
            intensity={40}
            tint="dark"
            style={{
              alignItems: "center",
              width: "100%",
              maxWidth: 400,
              borderRadius: 24,
              overflow: "hidden",
              padding: 24,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.2)",
            }}
          >
            {/* Task input */}
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput
                value={taskInput}
                onChangeText={(text) => setTaskInput(text)}
                placeholder="Add a task..."
                placeholderTextColor="rgba(255,255,255,0.6)"
                style={{
                  flex: 1,
                  backgroundColor: "rgba(255,255,255,0.15)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.3)",
                  color: "#ffffff",
                  padding: 16,
                  borderRadius: 12,
                  fontSize: 18,
                  height: 52,
                }}
              />
              <TouchableOpacity
                onPress={addTask}
                style={{
                  backgroundColor: "#ff6b35",
                  paddingHorizontal: 20,
                  borderRadius: 50,
                  justifyContent: "center",
                  height: 52,
                  width: 100,
                }}
              >
                <Text
                  style={{
                    color: "#fff",
                    fontWeight: "bold",
                    fontSize: 16,
                    textAlign: "center",
                  }}
                >
                  Add
                </Text>
              </TouchableOpacity>
            </View>

            {/* Category filter buttons */}
            <Text
              style={{
                color: "rgba(255,255,255,0.6)",
                fontSize: 11,
                marginTop: 16,
                letterSpacing: 1,
              }}
            >
              FILTER BY
            </Text>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 6,
                marginTop: 8,
                justifyContent: "center",
              }}
            >
              <TouchableOpacity
                onPress={() => setFilterCategory(null)}
                style={{
                  backgroundColor:
                    filterCategory === null
                      ? "#ff6b35"
                      : "rgba(255,255,255,0.15)",
                  paddingHorizontal: 18,
                  paddingVertical: 12,
                  borderRadius: 22,
                  borderWidth: 1,
                  borderColor:
                    filterCategory === null
                      ? "#ff6b35"
                      : "rgba(255,255,255,0.15)",
                }}
              >
                <Text style={{ color: "#fff", fontSize: 15 }}>All</Text>
              </TouchableOpacity>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.label}
                  onPress={() => setFilterCategory(cat.label)}
                  style={{
                    backgroundColor:
                      filterCategory === cat.label
                        ? "#ff6b35"
                        : "rgba(255,255,255,0.15)",
                    paddingHorizontal: 18,
                    paddingVertical: 12,
                    borderRadius: 22,
                    borderWidth: 1,
                    borderColor:
                      filterCategory === cat.label
                        ? "#ff6b35"
                        : "rgba(255,255,255,0.15)",
                  }}
                >
                  <Text style={{ color: "#fff", fontSize: 15 }}>
                    {cat.emoji} {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Task list */}
            <View style={{ marginTop: 16, width: "100%" }}>
              {tasks
                .map((task, originalIndex) => ({ task, originalIndex }))
                .filter(
                  ({ task }) =>
                    filterCategory === null || task.category === filterCategory,
                )
                .map(({ task, originalIndex: index }) => (
                  <View
                    key={index}
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      width: "100%",
                      alignItems: "center",
                      backgroundColor: "rgba(255,255,255,0.1)",
                      padding: 18,
                      borderRadius: 12,
                      marginBottom: 10,
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.2)",
                    }}
                  >
                    {editingIndex === index ? (
                      <>
                        <View style={{ flex: 1 }}>
                          <TextInput
                            value={editInput}
                            onChangeText={(text) => setEditInput(text)}
                            placeholderTextColor="#666"
                            style={{
                              backgroundColor: "rgba(255,255,255,0.15)",
                              color: "#fff",
                              padding: 12,
                              borderRadius: 8,
                              fontSize: 18,
                              marginBottom: 10,
                              height: 52,
                            }}
                          />
                          <View
                            style={{
                              flexDirection: "row",
                              gap: 6,
                              flexWrap: "wrap",
                              justifyContent: "center",
                              marginBottom: 10,
                            }}
                          >
                            {CATEGORIES.map((cat) => (
                              <TouchableOpacity
                                key={cat.label}
                                onPress={() => setSelectedCategory(cat.label)}
                                style={{
                                  backgroundColor:
                                    selectedCategory === cat.label
                                      ? "#ff6b35"
                                      : "rgba(255,255,255,0.15)",
                                  paddingHorizontal: 18,
                                  paddingVertical: 12,
                                  borderRadius: 20,
                                }}
                              >
                                <Text style={{ color: "#fff", fontSize: 15 }}>
                                  {cat.emoji} {cat.label}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                          <TouchableOpacity
                            onPress={saveEdit}
                            style={{
                              backgroundColor: "#00b4d8",
                              paddingHorizontal: 20,
                              paddingVertical: 12,
                              borderRadius: 50,
                              alignItems: "center",
                            }}
                          >
                            <Text style={{ color: "#fff", fontSize: 16 }}>
                              Save
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </>
                    ) : (
                      <>
                        <TouchableOpacity
                          onPress={() => toggleTask(index)}
                          style={{
                            flex: 1,
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 12,
                          }}
                        >
                          <View
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: 6,
                              borderWidth: 2,
                              borderColor: task.done ? "#0077b6" : "#555",
                              backgroundColor: task.done
                                ? "#0077b6"
                                : "transparent",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {task.done && (
                              <Text
                                style={{
                                  color: "#fff",
                                  fontSize: 14,
                                  fontWeight: "bold",
                                }}
                              >
                                ✓
                              </Text>
                            )}
                          </View>
                          <Text
                            style={{
                              color: task.done ? "#555" : "#e0e0e0",
                              textDecorationLine: task.done
                                ? "line-through"
                                : "none",
                              fontSize: 18,
                              fontWeight: "bold",
                              flex: 1,
                            }}
                          >
                            {
                              CATEGORIES.find((c) => c.label === task.category)
                                ?.emoji
                            }{" "}
                            {task.title}
                          </Text>
                        </TouchableOpacity>
                        <View style={{ flexDirection: "row", gap: 8 }}>
                          <TouchableOpacity
                            onPress={() => startEdit(index)}
                            style={{
                              backgroundColor: "#ff6b35",
                              paddingHorizontal: 20,
                              paddingVertical: 12,
                              borderRadius: 50,
                              alignItems: "center",
                            }}
                          >
                            <Text style={{ color: "#fff", fontSize: 16 }}>
                              Edit
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => deleteTask(index)}
                            style={{
                              backgroundColor: "#e63946",
                              paddingHorizontal: 20,
                              paddingVertical: 12,
                              borderRadius: 50,
                              alignItems: "center",
                            }}
                          >
                            <Text style={{ color: "#fff", fontSize: 16 }}>
                              Delete
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </>
                    )}
                  </View>
                ))}
            </View>
          </BlurView>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

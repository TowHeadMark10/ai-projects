import { Audio } from "expo-av";
import * as Notifications from "expo-notifications";
import { useState, useEffect, useRef, useCallback } from "react";
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
  // Holds the ID of the scheduled notification so we can cancel it if needed
  const notificationIdRef = useRef<string | null>(null);
  // Stores the timestamp (ms) when the timer is expected to end
  const timerEndTimeRef = useRef<number | null>(null);
  const workTimeRef = useRef(workTime);
  const breakTimeRef = useRef(breakTime);
  // Fish positions — each fish swims independently
  const fish1X = useRef(new Animated.Value(0)).current;
  const fish2X = useRef(new Animated.Value(100)).current;
  const fish3X = useRef(new Animated.Value(220)).current;
  // Fish direction — 1 = facing right, -1 = facing left
  const fish1Scale = useRef(new Animated.Value(1)).current;
  const fish2Scale = useRef(new Animated.Value(1)).current;
  const fish3Scale = useRef(new Animated.Value(1)).current;
  // Whether focus mode is enabled (pauses timer when leaving app)
  const [focusMode, setFocusMode] = useState(false);
  // Whether timer sounds are muted
  const [muted, setMuted] = useState(false);

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

  // Start fish animations when the app loads
  useEffect(() => {
    swimFish(fish1X, fish1Scale, 0);
    swimFish(fish2X, fish2Scale, 100);
    swimFish(fish3X, fish3Scale, 220);
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
  }

  // Skips the break and goes back to work mode immediately
  function skipBreak() {
    setisBreak(false); // returns to work mode
    setIsRunning(false); // pauses the timer so the user can start it whenever they want
    setSeconds(workTime); // loads the 25 mins again
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
  function swimFish(
    fishX: Animated.Value,
    fishScale: Animated.Value,
    startX: number,
  ) {
    // Face right and swim to the end
    fishScale.setValue(-1); // turns the fish to the right
    Animated.timing(fishX, {
      // moves the fish to the position 320px
      toValue: 320,
      duration: 3000, // in 3 secs
      useNativeDriver: true,
    }).start(() => {
      // when it ends...
      // Face left and swim back
      fishScale.setValue(1); // turns the fish to the right
      Animated.timing(fishX, {
        // goes back to the original position
        toValue: startX,
        duration: 3000,
        useNativeDriver: true,
      }).start(() => swimFish(fishX, fishScale, startX)); // when it ends, it calls to itself = infinite loop
    });
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0f0f1a" }}>
      <ScrollView
        contentContainerStyle={{
          alignItems: "center",
          paddingVertical: 48,
          paddingHorizontal: 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── TIMER SECTION ── */}
        <View style={{ alignItems: "center", width: "100%", maxWidth: 400 }}>
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
            {/* Center group: FOCUS/BREAK badge and pomodoro count */}
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <View
                style={{
                  backgroundColor: isBreak ? "#90e0ef22" : "#00b4d822",
                  borderColor: isBreak ? "#90e0ef" : "#00b4d8",
                  paddingHorizontal: 14,
                  paddingVertical: 4,
                  borderRadius: 20,
                  borderWidth: 1,
                }}
              >
                <Text
                  style={{
                    color: isBreak ? "#90e0ef" : "#00b4d8",
                    fontSize: 14,
                    fontWeight: "bold",
                    letterSpacing: 2,
                  }}
                >
                  {isBreak ? "BREAK" : "FOCUS"}
                </Text>
              </View>
              <Text style={{ color: "#555", fontSize: 16 }}>
                🍅 {pomodoroCount}
              </Text>
            </View>
            {/* Settings button on the right */}
            <TouchableOpacity
              onPress={() => router.push("/settings" as any)}
              style={{ position: "absolute", right: 0 }}
            >
              <Text style={{ color: "#555", fontSize: 20 }}>⚙️ </Text>
            </TouchableOpacity>
          </View>

          {/* Timer */}
          <Text
            style={{
              fontSize: 88,
              color: "#ffffff",
              fontWeight: "bold",
              letterSpacing: -2,
              marginBottom: 4,
            }}
          >
            {formatTime(seconds)}
          </Text>

          {/* Skip break */}
          {isBreak && (
            <TouchableOpacity
              onPress={skipBreak}
              style={{
                backgroundColor: "#1e1e30",
                paddingHorizontal: 20,
                paddingVertical: 10,
                borderRadius: 50,
                borderWidth: 1,
                borderColor: "#00b4d8",
                marginBottom: 8,
              }}
            >
              <Text
                style={{ color: "#00b4d8", fontSize: 14, fontWeight: "bold" }}
              >
                Skip break →
              </Text>
            </TouchableOpacity>
          )}

          {/* Buttons */}
          <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
            {/* Start/Pause button */}
            <TouchableOpacity
              onPress={() => setIsRunning(!isRunning)}
              style={{
                backgroundColor: isRunning ? "#333" : "#0077b6",
                paddingVertical: 14,
                paddingHorizontal: 40,
                borderRadius: 50,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "bold" }}>
                {isRunning ? "Pause" : "Start"}
              </Text>
            </TouchableOpacity>

            {/* Reset button */}
            <TouchableOpacity
              onPress={reset}
              style={{
                backgroundColor: "#1e1e30",
                paddingVertical: 14,
                paddingHorizontal: 24,
                borderRadius: 50,
                alignItems: "center",
                borderWidth: 1,
                borderColor: "#333",
              }}
            >
              <Text style={{ color: "#888", fontSize: 16 }}>Reset</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── FISH TANK ── */}
        <View
          style={{
            width: "100%",
            maxWidth: 400,
            height: 80,
            backgroundColor: "#0a1628",
            borderRadius: 16,
            marginVertical: 32,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: "#1a3a5c",
          }}
        >
          <Animated.Text
            style={{
              fontSize: 24,
              position: "absolute",
              top: 24,
              transform: [{ translateX: fish1X }, { scaleX: fish1Scale }],
            }}
          >
            🐠
          </Animated.Text>
          <Animated.Text
            style={{
              fontSize: 20,
              position: "absolute",
              top: 10,
              transform: [{ translateX: fish2X }, { scaleX: fish2Scale }],
            }}
          >
            🐟
          </Animated.Text>
          <Animated.Text
            style={{
              fontSize: 18,
              position: "absolute",
              top: 38,
              transform: [{ translateX: fish3X }, { scaleX: fish3Scale }],
            }}
          >
            🐡
          </Animated.Text>
        </View>

        {/* ── TASKS SECTION ── */}
        <View style={{ width: "100%", maxWidth: 400 }}>
          {/* Task input */}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput
              value={taskInput}
              onChangeText={(text) => setTaskInput(text)}
              placeholder="Add a task..."
              placeholderTextColor="#aaa"
              style={{
                flex: 1,
                backgroundColor: "#2a2a4e",
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
                backgroundColor: "#0077b6",
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
              color: "#888",
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
                  filterCategory === null ? "#0077b6" : "#1e1e30",
                paddingHorizontal: 18,
                paddingVertical: 12,
                borderRadius: 22,
                borderWidth: 1,
                borderColor: filterCategory === null ? "#0077b6" : "#333",
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
                    filterCategory === cat.label ? "#0077b6" : "#1e1e30",
                  paddingHorizontal: 18,
                  paddingVertical: 12,
                  borderRadius: 22,
                  borderWidth: 1,
                  borderColor:
                    filterCategory === cat.label ? "#0077b6" : "#333",
                }}
              >
                <Text style={{ color: "#fff", fontSize: 15 }}>
                  {cat.emoji} {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Task list */}
          <View style={{ marginTop: 16 }}>
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
                    alignItems: "center",
                    backgroundColor: "#1e1e30",
                    padding: 18,
                    borderRadius: 12,
                    marginBottom: 10,
                    borderWidth: 1,
                    borderColor: "#2a2a4e",
                  }}
                >
                  {editingIndex === index ? (
                    // Edit mode — show input and save button
                    <>
                      <View style={{ flex: 1 }}>
                        <TextInput
                          value={editInput}
                          onChangeText={(text) => setEditInput(text)}
                          placeholderTextColor="#666"
                          style={{
                            backgroundColor: "#2a2a4e",
                            color: "#fff",
                            padding: 12,
                            borderRadius: 8,
                            fontSize: 18,
                            marginBottom: 10,
                            height: 52,
                          }}
                        />
                        {/* Category selector in edit mode */}
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
                                    ? "#0077b6"
                                    : "#2a2a4e",
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
                        {/* Save button below categories */}
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
                    // Normal mode — show task and action buttons
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
                        {/* Checkbox */}
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
                            backgroundColor: "#0096c7",
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
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

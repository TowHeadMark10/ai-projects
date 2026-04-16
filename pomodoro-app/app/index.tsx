import { Audio } from "expo-av";
import * as Notifications from "expo-notifications";
import { useState, useEffect, useRef, useCallback } from "react";
import { BlurView } from "expo-blur";
import { Dimensions } from "react-native";
import Swipeable, {
  SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import { Ionicons } from "@expo/vector-icons";
import {
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Animated,
  AppState,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Keyboard,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";

// Get screen height once so fish can spawn across the full aquarium
const SCREEN_HEIGHT = Dimensions.get("window").height;
// Get screen width for arena
const SCREEN_WIDTH = Dimensions.get("window").width;

// Pre-generated sand texture pixels — fixed positions give a consistent
// Minecraft-style speckled look without re-rendering differently each time
const SAND_PIXELS = Array.from({ length: 110 }, (_, i) => ({
  left: (i * 53 + 17) % SCREEN_WIDTH,
  bottom: ((i * 41 + 7) % 48) + 4,
  size: 2 + (i % 3),
  color: ["#f5e6a3", "#e8d084", "#c0a050", "#d4b462", "#a88840"][i % 5],
}));

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
  // Crab walking animation
  const crabX = useRef(new Animated.Value(0)).current;
  const crabScale = useRef(new Animated.Value(-1)).current;

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
  // Seaweed sway animations
  const seaweed1Sway = useRef(new Animated.Value(0)).current;
  const seaweed2Sway = useRef(new Animated.Value(0)).current;
  const seaweed3Sway = useRef(new Animated.Value(0)).current;
  const seaweed4Sway = useRef(new Animated.Value(0)).current;
  const seaweed5Sway = useRef(new Animated.Value(0)).current;
  const seaweed6Sway = useRef(new Animated.Value(0)).current;
  // Ref for scrolling to edit form when keyboard opens
  const taskScrollRef = useRef<ScrollView>(null);
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
      // Vertical drift for natural swimming bob (animated separately from y)
      yDrift: Animated.Value;
    }[]
  >([]);
  // Counter to assign unique IDs to each fish
  const fishIdRef = useRef(0);
  // Ref to the interval that spawns new fish
  const fishSpawnIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const [swipeResetKey, setSwipeResetKey] = useState(0);
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

      // Spawn fish at a rate proportional to the total work time so they spread
      // evenly across the whole session (e.g. 25min → ~1 fish every 75s)
      const scheduleNextFish = () => {
        // Base delay = total work time divided evenly among MAX_FISH slots
        const baseDelay = (workTimeRef.current / MAX_FISH) * 1000;
        // ±30% randomness so it feels natural, not mechanical
        const delay = baseDelay * (0.7 + Math.random() * 0.6);
        fishSpawnIntervalRef.current = setTimeout(() => {
          if (activeFishRef.current.length < MAX_FISH) {
            // Unlock more fish types as the timer progresses
            // Early in session → only small fish; later → bigger/colorful ones
            const progress = 1 - secondsRef.current / workTimeRef.current;
            const maxTypeIndex = Math.floor(progress * FISH_TYPES.length);
            const availableTypes = FISH_TYPES.slice(
              0,
              Math.max(1, maxTypeIndex + 1),
            );
            // 60% chance to pick from the 2 most recently unlocked types so
            // bigger fish actually appear as they unlock, while still allowing
            // smaller fish to show up occasionally for variety
            const recentTypes = availableTypes.slice(-2);
            const pool = Math.random() < 0.6 ? recentTypes : availableTypes;
            const type = pool[Math.floor(Math.random() * pool.length)];

            const newFish = {
              id: fishIdRef.current++,
              emoji: type.emoji,
              size: type.size,
              // ±30% speed variation so same-type fish don't move in lockstep
              speed: type.speed * (0.7 + Math.random() * 0.6),
              x: new Animated.Value(-50),
              scaleX: new Animated.Value(-1),
              // Spawn anywhere from near the top down to near the sand
              y: Math.random() * (SCREEN_HEIGHT - 60) + 20,
              // Starts at 0 — will oscillate up/down in swimNewFish
              yDrift: new Animated.Value(0),
            };

            swimNewFish(newFish);
            setActiveFish((prev) => [...prev, newFish]);
          }
          // Schedule the next fish regardless of whether one was spawned
          scheduleNextFish();
        }, delay) as unknown as ReturnType<typeof setInterval>;
      };
      scheduleNextFish();
    } else {
      clearTimeout(fishSpawnIntervalRef.current!);
    }

    return () => clearTimeout(fishSpawnIntervalRef.current!);
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
          toValue: -SCREEN_HEIGHT,
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

  useEffect(() => {
    // Each seaweed starts swaying at a different delay for a natural staggered look
    const startSway = (
      anim: Animated.Value,
      duration: number,
      delay: number,
    ) => {
      Animated.sequence([
        Animated.delay(delay),
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: 1,
              duration: duration / 2,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: -1,
              duration,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0,
              duration: duration / 2,
              useNativeDriver: true,
            }),
          ]),
        ),
      ]).start();
    };
    startSway(seaweed1Sway, 2000, 0);
    startSway(seaweed2Sway, 2400, 500);
    startSway(seaweed3Sway, 1800, 250);
    startSway(seaweed4Sway, 2200, 750);
    startSway(seaweed5Sway, 1700, 350);
    startSway(seaweed6Sway, 2100, 900);
  }, []);

  // Crab walks right toward seaweed then back to castle on loop
  useEffect(() => {
    const walkCrab = () => {
      crabScale.setValue(1);
      Animated.timing(crabX, {
        toValue: 100,
        duration: 4000,
        useNativeDriver: true,
      }).start(() => {
        crabScale.setValue(-1);
        Animated.timing(crabX, {
          toValue: 0,
          duration: 4000,
          useNativeDriver: true,
        }).start(walkCrab);
      });
    };
    walkCrab();
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
    yDrift: Animated.Value;
  }) {
    // Gentle vertical bob: each fish drifts ±8px with its own random timing
    // so no two fish oscillate in sync
    const bobDuration = 1200 + Math.random() * 1000;
    Animated.loop(
      Animated.sequence([
        Animated.timing(fish.yDrift, {
          toValue: -8,
          duration: bobDuration,
          useNativeDriver: true,
        }),
        Animated.timing(fish.yDrift, {
          toValue: 8,
          duration: bobDuration,
          useNativeDriver: true,
        }),
      ]),
      { resetBeforeIteration: false },
    ).start();
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
    // Dismiss keyboard after adding task
    Keyboard.dismiss();
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
    // Scroll to bottom so edit form is visible above keyboard
    setTimeout(
      () => taskScrollRef.current?.scrollToEnd({ animated: true }),
      400,
    );
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
    // Reset swipeables so none stay open after edit
    setSwipeResetKey((k) => k + 1);
  }

  return (
    <View style={{ flex: 1 }}>
      {/* ── AQUARIUM BACKGROUND ── */}
      <View
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      >
        {/* Water — crystal aqua blue */}
        <View style={{ flex: 1, backgroundColor: "#0077b6" }} />
        {/* Sand at the bottom — base layer, warm golden tone */}
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 60,
            backgroundColor: "#e0b96a",
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
          }}
        />
        {/* Sand shadow — darker tone at the very bottom for depth */}
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 28,
            backgroundColor: "#b8904a",
            borderTopLeftRadius: 12,
            borderTopRightRadius: 12,
          }}
        />
        {/* Sand texture — pixel-art style speckles simulating Minecraft
  sand */}
        {SAND_PIXELS.map((dot, i) => (
          <View
            key={i}
            style={{
              position: "absolute",
              bottom: dot.bottom,
              left: dot.left,
              width: dot.size,
              height: dot.size,
              backgroundColor: dot.color,
              borderRadius: dot.size / 2,
              opacity: 0.6,
            }}
          />
        ))}
      </View>
      {/* Rock cluster - left side */}
      <View style={{ position: "absolute", bottom: 53, left: 4 }}>
        <Text style={{ fontSize: 44 }}>🪨</Text>
      </View>
      <View style={{ position: "absolute", bottom: 53, left: 40 }}>
        <Text style={{ fontSize: 26 }}>🪨</Text>
      </View>

      {/* Rock cluster - right side */}
      <View style={{ position: "absolute", bottom: 53, right: 4 }}>
        <Text style={{ fontSize: 44 }}>🪨</Text>
      </View>
      <View style={{ position: "absolute", bottom: 53, right: 40 }}>
        <Text style={{ fontSize: 26 }}>🪨</Text>
      </View>

      {/* Seaweed 1 - very tall, left side */}
      <Animated.View
        style={{
          position: "absolute",
          bottom: 58,
          left: 40,
          width: 44,
          height: 170,
          overflow: "hidden",
          transform: [
            {
              rotate: seaweed1Sway.interpolate({
                inputRange: [-1, 0, 1],
                outputRange: ["-5deg", "0deg", "5deg"],
              }),
            },
          ],
        }}
      >
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 19,
            width: 6,
            height: 170,
            backgroundColor: "#7a8c2a",
            borderRadius: 3,
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 10,
            left: 20,
            width: 16,
            height: 7,
            backgroundColor: "#3dcc15",
            borderRadius: 3,
            transform: [
              {
                rotate: "18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 25,
            left: 8,
            width: 16,
            height: 7,
            backgroundColor: "#3dcc15",
            borderRadius: 3,
            transform: [
              {
                rotate: "-18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 40,
            left: 20,
            width: 15,
            height: 6,
            backgroundColor: "#3dcc15",
            borderRadius: 3,
            transform: [
              {
                rotate: "18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 55,
            left: 8,
            width: 15,
            height: 6,
            backgroundColor: "#3dcc15",
            borderRadius: 3,
            transform: [
              {
                rotate: "-18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 70,
            left: 20,
            width: 13,
            height: 6,
            backgroundColor: "#2db510",
            borderRadius: 3,
            transform: [
              {
                rotate: "18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 85,
            left: 8,
            width: 13,
            height: 6,
            backgroundColor: "#2db510",
            borderRadius: 3,
            transform: [
              {
                rotate: "-18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 100,
            left: 20,
            width: 11,
            height: 5,
            backgroundColor: "#2db510",
            borderRadius: 3,
            transform: [
              {
                rotate: "18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 115,
            left: 8,
            width: 11,
            height: 5,
            backgroundColor: "#2db510",
            borderRadius: 3,
            transform: [
              {
                rotate: "-18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 130,
            left: 20,
            width: 9,
            height: 4,
            backgroundColor: "#259a0d",
            borderRadius: 3,
            transform: [
              {
                rotate: "18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 145,
            left: 8,
            width: 9,
            height: 4,
            backgroundColor: "#259a0d",
            borderRadius: 3,
            transform: [
              {
                rotate: "-18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 160,
            left: 20,
            width: 8,
            height: 4,
            backgroundColor: "#259a0d",
            borderRadius: 3,
            transform: [
              {
                rotate: "18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 175,
            left: 8,
            width: 8,
            height: 4,
            backgroundColor: "#259a0d",
            borderRadius: 3,
            transform: [
              {
                rotate: "-18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 190,
            left: 20,
            width: 7,
            height: 3,
            backgroundColor: "#259a0d",
            borderRadius: 3,
            transform: [
              {
                rotate: "18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 205,
            left: 8,
            width: 7,
            height: 3,
            backgroundColor: "#259a0d",
            borderRadius: 3,
            transform: [
              {
                rotate: "-18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 220,
            left: 20,
            width: 6,
            height: 3,
            backgroundColor: "#259a0d",
            borderRadius: 3,
            transform: [
              {
                rotate: "18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 235,
            left: 8,
            width: 6,
            height: 3,
            backgroundColor: "#259a0d",
            borderRadius: 3,
            transform: [
              {
                rotate: "-18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 250,
            left: 20,
            width: 5,
            height: 3,
            backgroundColor: "#259a0d",
            borderRadius: 3,
            transform: [
              {
                rotate: "18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 265,
            left: 8,
            width: 5,
            height: 3,
            backgroundColor: "#259a0d",
            borderRadius: 3,
            transform: [
              {
                rotate: "-18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 280,
            left: 20,
            width: 5,
            height: 3,
            backgroundColor: "#259a0d",
            borderRadius: 3,
            transform: [
              {
                rotate: "18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 295,
            left: 8,
            width: 4,
            height: 3,
            backgroundColor: "#259a0d",
            borderRadius: 3,
            transform: [
              {
                rotate: "-18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 310,
            left: 20,
            width: 4,
            height: 3,
            backgroundColor: "#259a0d",
            borderRadius: 3,
            transform: [
              {
                rotate: "18deg",
              },
            ],
          }}
        />
      </Animated.View>

      {/* Seaweed 2 - medium-tall, left side */}
      <Animated.View
        style={{
          position: "absolute",
          bottom: 58,
          left: 88,
          width: 40,
          height: 130,
          overflow: "hidden",
          transform: [
            {
              rotate: seaweed2Sway.interpolate({
                inputRange: [-1, 0, 1],
                outputRange: ["-5deg", "0deg", "5deg"],
              }),
            },
          ],
        }}
      >
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 17,
            width: 6,
            height: 130,
            backgroundColor: "#7a8c2a",
            borderRadius: 3,
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 10,
            left: 20,
            width: 14,
            height: 6,
            backgroundColor: "#3dcc15",
            borderRadius: 3,
            transform: [
              {
                rotate: "18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 25,
            left: 3,
            width: 14,
            height: 6,
            backgroundColor: "#3dcc15",
            borderRadius: 3,
            transform: [
              {
                rotate: "-18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 40,
            left: 20,
            width: 12,
            height: 6,
            backgroundColor: "#3dcc15",
            borderRadius: 3,
            transform: [
              {
                rotate: "18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 55,
            left: 4,
            width: 12,
            height: 6,
            backgroundColor: "#2db510",
            borderRadius: 3,
            transform: [
              {
                rotate: "-18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 70,
            left: 20,
            width: 10,
            height: 5,
            backgroundColor: "#2db510",
            borderRadius: 3,
            transform: [
              {
                rotate: "18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 85,
            left: 5,
            width: 10,
            height: 5,
            backgroundColor: "#2db510",
            borderRadius: 3,
            transform: [
              {
                rotate: "-18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 100,
            left: 20,
            width: 9,
            height: 4,
            backgroundColor: "#259a0d",
            borderRadius: 3,
            transform: [
              {
                rotate: "18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 115,
            left: 5,
            width: 9,
            height: 4,
            backgroundColor: "#259a0d",
            borderRadius: 3,
            transform: [
              {
                rotate: "-18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 130,
            left: 20,
            width: 8,
            height: 4,
            backgroundColor: "#259a0d",
            borderRadius: 3,
            transform: [
              {
                rotate: "18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 145,
            left: 5,
            width: 8,
            height: 4,
            backgroundColor: "#259a0d",
            borderRadius: 3,
            transform: [
              {
                rotate: "-18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 160,
            left: 20,
            width: 7,
            height: 3,
            backgroundColor: "#259a0d",
            borderRadius: 3,
            transform: [
              {
                rotate: "18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 175,
            left: 6,
            width: 7,
            height: 3,
            backgroundColor: "#259a0d",
            borderRadius: 3,
            transform: [
              {
                rotate: "-18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 190,
            left: 20,
            width: 6,
            height: 3,
            backgroundColor: "#259a0d",
            borderRadius: 3,
            transform: [
              {
                rotate: "18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 205,
            left: 6,
            width: 6,
            height: 3,
            backgroundColor: "#259a0d",
            borderRadius: 3,
            transform: [
              {
                rotate: "-18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 220,
            left: 20,
            width: 5,
            height: 3,
            backgroundColor: "#259a0d",
            borderRadius: 3,
            transform: [
              {
                rotate: "18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 235,
            left: 6,
            width: 5,
            height: 3,
            backgroundColor: "#259a0d",
            borderRadius: 3,
            transform: [
              {
                rotate: "-18deg",
              },
            ],
          }}
        />
      </Animated.View>

      {/* Seaweed 3 - very tall, right side */}
      <Animated.View
        style={{
          position: "absolute",
          bottom: 58,
          right: 40,
          width: 44,
          height: 160,
          overflow: "hidden",
          transform: [
            {
              rotate: seaweed3Sway.interpolate({
                inputRange: [-1, 0, 1],
                outputRange: ["-5deg", "0deg", "5deg"],
              }),
            },
          ],
        }}
      >
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 19,
            width: 6,
            height: 160,
            backgroundColor: "#7a8c2a",
            borderRadius: 3,
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 10,
            left: 20,
            width: 16,
            height: 7,
            backgroundColor: "#3dcc15",
            borderRadius: 3,
            transform: [
              {
                rotate: "18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 25,
            left: 3,
            width: 16,
            height: 7,
            backgroundColor: "#3dcc15",
            borderRadius: 3,
            transform: [
              {
                rotate: "-18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 40,
            left: 20,
            width: 14,
            height: 6,
            backgroundColor: "#3dcc15",
            borderRadius: 3,
            transform: [
              {
                rotate: "18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 55,
            left: 4,
            width: 14,
            height: 6,
            backgroundColor: "#3dcc15",
            borderRadius: 3,
            transform: [
              {
                rotate: "-18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 70,
            left: 20,
            width: 12,
            height: 6,
            backgroundColor: "#2db510",
            borderRadius: 3,
            transform: [
              {
                rotate: "18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 85,
            left: 5,
            width: 12,
            height: 6,
            backgroundColor: "#2db510",
            borderRadius: 3,
            transform: [
              {
                rotate: "-18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 100,
            left: 20,
            width: 10,
            height: 5,
            backgroundColor: "#2db510",
            borderRadius: 3,
            transform: [
              {
                rotate: "18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 115,
            left: 6,
            width: 10,
            height: 5,
            backgroundColor: "#2db510",
            borderRadius: 3,
            transform: [
              {
                rotate: "-18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 130,
            left: 20,
            width: 9,
            height: 4,
            backgroundColor: "#259a0d",
            borderRadius: 3,
            transform: [
              {
                rotate: "18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 145,
            left: 7,
            width: 9,
            height: 4,
            backgroundColor: "#259a0d",
            borderRadius: 3,
            transform: [
              {
                rotate: "-18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 160,
            left: 20,
            width: 8,
            height: 4,
            backgroundColor: "#259a0d",
            borderRadius: 3,
            transform: [
              {
                rotate: "18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 175,
            left: 7,
            width: 8,
            height: 4,
            backgroundColor: "#259a0d",
            borderRadius: 3,
            transform: [
              {
                rotate: "-18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 190,
            left: 20,
            width: 7,
            height: 3,
            backgroundColor: "#259a0d",
            borderRadius: 3,
            transform: [
              {
                rotate: "18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 205,
            left: 7,
            width: 7,
            height: 3,
            backgroundColor: "#259a0d",
            borderRadius: 3,
            transform: [
              {
                rotate: "-18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 220,
            left: 20,
            width: 6,
            height: 3,
            backgroundColor: "#259a0d",
            borderRadius: 3,
            transform: [
              {
                rotate: "18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 235,
            left: 8,
            width: 6,
            height: 3,
            backgroundColor: "#259a0d",
            borderRadius: 3,
            transform: [
              {
                rotate: "-18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 250,
            left: 20,
            width: 5,
            height: 3,
            backgroundColor: "#259a0d",
            borderRadius: 3,
            transform: [
              {
                rotate: "18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 265,
            left: 8,
            width: 5,
            height: 3,
            backgroundColor: "#259a0d",
            borderRadius: 3,
            transform: [
              {
                rotate: "-18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 280,
            left: 20,
            width: 5,
            height: 3,
            backgroundColor: "#259a0d",
            borderRadius: 3,
            transform: [
              {
                rotate: "18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 293,
            left: 8,
            width: 4,
            height: 3,
            backgroundColor: "#259a0d",
            borderRadius: 3,
            transform: [
              {
                rotate: "-18deg",
              },
            ],
          }}
        />
      </Animated.View>

      {/* Seaweed 4 - medium-tall, right side */}
      <Animated.View
        style={{
          position: "absolute",
          bottom: 58,
          right: 88,
          width: 40,
          height: 120,
          overflow: "hidden",
          transform: [
            {
              rotate: seaweed4Sway.interpolate({
                inputRange: [-1, 0, 1],
                outputRange: ["-5deg", "0deg", "5deg"],
              }),
            },
          ],
        }}
      >
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 17,
            width: 6,
            height: 120,
            backgroundColor: "#7a8c2a",
            borderRadius: 3,
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 10,
            left: 20,
            width: 14,
            height: 6,
            backgroundColor: "#3dcc15",
            borderRadius: 3,
            transform: [
              {
                rotate: "18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 25,
            left: 3,
            width: 14,
            height: 6,
            backgroundColor: "#3dcc15",
            borderRadius: 3,
            transform: [
              {
                rotate: "-18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 40,
            left: 20,
            width: 12,
            height: 5,
            backgroundColor: "#3dcc15",
            borderRadius: 3,
            transform: [
              {
                rotate: "18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 55,
            left: 4,
            width: 12,
            height: 5,
            backgroundColor: "#2db510",
            borderRadius: 3,
            transform: [
              {
                rotate: "-18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 70,
            left: 22,
            width: 10,
            height: 4,
            backgroundColor: "#2db510",
            borderRadius: 3,
            transform: [
              {
                rotate: "18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 85,
            left: 5,
            width: 10,
            height: 4,
            backgroundColor: "#2db510",
            borderRadius: 3,
            transform: [
              {
                rotate: "-18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 100,
            left: 22,
            width: 9,
            height: 4,
            backgroundColor: "#259a0d",
            borderRadius: 3,
            transform: [
              {
                rotate: "18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 115,
            left: 5,
            width: 9,
            height: 4,
            backgroundColor: "#259a0d",
            borderRadius: 3,
            transform: [
              {
                rotate: "-18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 130,
            left: 22,
            width: 8,
            height: 3,
            backgroundColor: "#259a0d",
            borderRadius: 3,
            transform: [
              {
                rotate: "18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 145,
            left: 5,
            width: 8,
            height: 3,
            backgroundColor: "#259a0d",
            borderRadius: 3,
            transform: [
              {
                rotate: "-18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 160,
            left: 22,
            width: 7,
            height: 3,
            backgroundColor: "#259a0d",
            borderRadius: 3,
            transform: [
              {
                rotate: "18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 175,
            left: 6,
            width: 7,
            height: 3,
            backgroundColor: "#259a0d",
            borderRadius: 3,
            transform: [
              {
                rotate: "-18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 190,
            left: 22,
            width: 6,
            height: 3,
            backgroundColor: "#259a0d",
            borderRadius: 3,
            transform: [
              {
                rotate: "18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 205,
            left: 6,
            width: 6,
            height: 3,
            backgroundColor: "#259a0d",
            borderRadius: 3,
            transform: [
              {
                rotate: "-18deg",
              },
            ],
          }}
        />
      </Animated.View>

      {/* Seaweed 5 - small, far left */}
      <Animated.View
        style={{
          position: "absolute",
          bottom: 58,
          left: 0,
          width: 34,
          height: 90,
          overflow: "hidden",
          transform: [
            {
              rotate: seaweed5Sway.interpolate({
                inputRange: [-1, 0, 1],
                outputRange: ["-5deg", "0deg", "5deg"],
              }),
            },
          ],
        }}
      >
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 14,
            width: 5,
            height: 90,
            backgroundColor: "#7a8c2a",
            borderRadius: 3,
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 10,
            left: 19,
            width: 12,
            height: 6,
            backgroundColor: "#3dcc15",
            borderRadius: 3,
            transform: [
              {
                rotate: "18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 25,
            left: 8,
            width: 12,
            height: 6,
            backgroundColor: "#3dcc15",
            borderRadius: 3,
            transform: [
              {
                rotate: "-18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 40,
            left: 19,
            width: 10,
            height: 5,
            backgroundColor: "#3dcc15",
            borderRadius: 3,
            transform: [
              {
                rotate: "18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 55,
            left: 8,
            width: 10,
            height: 5,
            backgroundColor: "#2db510",
            borderRadius: 3,
            transform: [
              {
                rotate: "-18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 70,
            left: 18,
            width: 9,
            height: 4,
            backgroundColor: "#2db510",
            borderRadius: 3,
            transform: [
              {
                rotate: "18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 85,
            left: 8,
            width: 9,
            height: 4,
            backgroundColor: "#2db510",
            borderRadius: 3,
            transform: [
              {
                rotate: "-18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 100,
            left: 18,
            width: 7,
            height: 4,
            backgroundColor: "#259a0d",
            borderRadius: 3,
            transform: [
              {
                rotate: "18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 115,
            left: 8,
            width: 7,
            height: 4,
            backgroundColor: "#259a0d",
            borderRadius: 3,
            transform: [
              {
                rotate: "-18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 128,
            left: 18,
            width: 6,
            height: 3,
            backgroundColor: "#259a0d",
            borderRadius: 3,
            transform: [
              {
                rotate: "18deg",
              },
            ],
          }}
        />
      </Animated.View>

      {/* Seaweed 6 - small, far right */}
      <Animated.View
        style={{
          position: "absolute",
          bottom: 58,
          right: 0,
          width: 34,
          height: 90,
          overflow: "hidden",
          transform: [
            {
              rotate: seaweed6Sway.interpolate({
                inputRange: [-1, 0, 1],
                outputRange: ["-5deg", "0deg", "5deg"],
              }),
            },
          ],
        }}
      >
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 14,
            width: 5,
            height: 90,
            backgroundColor: "#7a8c2a",
            borderRadius: 3,
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 10,
            left: 19,
            width: 12,
            height: 6,
            backgroundColor: "#3dcc15",
            borderRadius: 3,
            transform: [
              {
                rotate: "18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 25,
            left: 8,
            width: 12,
            height: 6,
            backgroundColor: "#3dcc15",
            borderRadius: 3,
            transform: [
              {
                rotate: "-18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 40,
            left: 19,
            width: 10,
            height: 5,
            backgroundColor: "#3dcc15",
            borderRadius: 3,
            transform: [
              {
                rotate: "18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 55,
            left: 8,
            width: 10,
            height: 5,
            backgroundColor: "#2db510",
            borderRadius: 3,
            transform: [
              {
                rotate: "-18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 70,
            left: 18,
            width: 9,
            height: 4,
            backgroundColor: "#2db510",
            borderRadius: 3,
            transform: [
              {
                rotate: "18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 85,
            left: 8,
            width: 9,
            height: 4,
            backgroundColor: "#2db510",
            borderRadius: 3,
            transform: [
              {
                rotate: "-18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 100,
            left: 18,
            width: 7,
            height: 4,
            backgroundColor: "#259a0d",
            borderRadius: 3,
            transform: [
              {
                rotate: "18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 115,
            left: 8,
            width: 7,
            height: 4,
            backgroundColor: "#259a0d",
            borderRadius: 3,
            transform: [
              {
                rotate: "-18deg",
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 128,
            left: 18,
            width: 6,
            height: 3,
            backgroundColor: "#259a0d",
            borderRadius: 3,
            transform: [
              {
                rotate: "18deg",
              },
            ],
          }}
        />
      </Animated.View>

      {/* Castle - center, bigger */}
      <View style={{ position: "absolute", bottom: 53, left: "43%" }}>
        <Text style={{ fontSize: 68 }}>🏰</Text>
      </View>
      {/* Shell - left of castle */}
      <View style={{ position: "absolute", bottom: 53, left: 70 }}>
        <Text style={{ fontSize: 20 }}>🐚</Text>
      </View>
      {/* Crab - walks from castle right side toward right seaweed */}
      <Animated.View
        style={{
          position: "absolute",
          bottom: 55,
          left: "45%",
          transform: [{ translateX: crabX }],
        }}
      >
        <Animated.Text
          style={{ fontSize: 28, transform: [{ scaleX: crabScale }] }}
        >
          🦀
        </Animated.Text>
      </Animated.View>

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
            borderWidth: 1.5,
            borderColor: "rgba(255,255,255,0.6)",
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
            borderWidth: 1.5,
            borderColor: "rgba(255,255,255,0.6)",
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
            borderWidth: 1.5,
            borderColor: "rgba(255,255,255,0.6)",
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
            borderWidth: 1.5,
            borderColor: "rgba(255,255,255,0.6)",
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
              transform: [
                { translateX: fish.x },
                { scaleX: fish.scaleX },
                { translateY: fish.yDrift },
              ],
            }}
          >
            {fish.emoji}
          </Animated.Text>
        ))}
      </Animated.View>

      {/* ── CONTENT ON TOP ── */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 10,
        }}
      >
        <SafeAreaView style={{ flex: 1 }}>
          {/* ── TIMER SECTION ── */}
          <View
            style={{
              alignItems: "center",
              width: "100%",
              maxWidth: 400,
              alignSelf: "center",
              padding: 24,
              marginBottom: 16,
              paddingTop: 48,
              paddingHorizontal: 24,
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
                {/* Pomodoro counter — styled as a pill badge matching the
  FOCUS/BREAK badge */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: "rgba(255,255,255,0.15)",
                    borderRadius: 20,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    gap: 4,
                  }}
                >
                  <Text style={{ fontSize: 14 }}>🍅</Text>
                  <Text
                    style={{ color: "#fff", fontSize: 14, fontWeight: "bold" }}
                  >
                    {pomodoroCount}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => router.push("/settings" as any)}
                style={{ position: "absolute", right: 0 }}
              >
                <View
                  style={{
                    backgroundColor: "rgba(255,255,255,0.15)",
                    borderRadius: 20,
                    padding: 8,
                  }}
                >
                  <Ionicons
                    name="settings-outline"
                    size={20}
                    color="rgba(255,255,255,0.9)"
                  />
                </View>
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
            <View
              style={{
                flexDirection: "row",
                gap: 12,
                marginTop: 16,
                justifyContent: "center",
              }}
            >
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
              flexShrink: 1,
              alignItems: "center",
              width: "100%",
              maxWidth: 400,
              borderRadius: 24,
              overflow: "hidden",
              padding: 24,
              marginHorizontal: 24,
              marginBottom: 48,
              borderWidth: 1,
              backgroundColor: "rgba(0, 119, 182, 0.35)",
              borderColor: "rgba(255,255,255,0.2)",
            }}
          >
            {/* Blue tint overlay on top of blur */}
            <View
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(0, 119, 182, 0.3)",
              }}
            />
            {/* Task input */}
            <View style={{ flexDirection: "row", gap: 8, zIndex: 2 }}>
              <TextInput
                value={taskInput}
                onChangeText={(text) => setTaskInput(text)}
                placeholder="Add a task..."
                placeholderTextColor="rgba(255,255,255,0.6)"
                onSubmitEditing={addTask}
                returnKeyType="done"
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
                zIndex: 2,
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
                zIndex: 2,
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

            {/* Task list — only rendered when there are tasks so the panel
                shrinks to just input+filters when empty.
                flexShrink+maxHeight on ScrollView makes it grow with content
                but scroll when it exceeds the limit. */}
            {tasks.length > 0 && (
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                ref={taskScrollRef}
                style={{
                  maxHeight: SCREEN_HEIGHT * 0.35,
                  flexShrink: 1,
                  width: "100%",
                  borderTopWidth: 1,
                  borderTopColor: "rgba(255,255,255,0.12)",
                  marginTop: 12,
                }}
                contentContainerStyle={{ paddingBottom: 0 }}
              >
                <View style={{ marginTop: 12, width: "100%" }}>
                  {tasks
                    .map((task, originalIndex) => ({ task, originalIndex }))
                    .filter(
                      ({ task }) =>
                        filterCategory === null ||
                        task.category === filterCategory,
                    )
                    .map(({ task, originalIndex: index }) => (
                      <Swipeable
                        key={task.title + task.category + swipeResetKey}
                        containerStyle={{ width: "100%" }}
                        overshootRight={false}
                        renderRightActions={() => (
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "stretch",
                              marginBottom: 10,
                            }}
                          >
                            <TouchableOpacity
                              onPress={() => startEdit(index)}
                              style={{
                                backgroundColor: "#FF9E00",
                                justifyContent: "center",
                                alignItems: "center",
                                paddingHorizontal: 24,
                              }}
                            >
                              <Ionicons name="pencil" size={22} color="#fff" />
                              <Text
                                style={{
                                  color: "#fff",
                                  fontSize: 12,
                                  marginTop: 4,
                                }}
                              >
                                Edit
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => deleteTask(index)}
                              style={{
                                backgroundColor: "#e63946",
                                justifyContent: "center",
                                alignItems: "center",
                                paddingHorizontal: 24,
                                borderTopRightRadius: 12,
                                borderBottomRightRadius: 12,
                              }}
                            >
                              <Ionicons name="trash" size={22} color="#fff" />
                              <Text
                                style={{
                                  color: "#fff",
                                  fontSize: 12,
                                  marginTop: 4,
                                }}
                              >
                                Delete
                              </Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            width: "100%",
                            alignItems: "center",
                            backgroundColor: "rgba(255,255,255,0.12)",
                            padding: 18,
                            borderRadius: 12,
                            marginBottom: 10,
                            borderWidth: 1,
                            borderColor: "rgba(255,255,255,0.2)",
                          }}
                        >
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
                                  borderColor: task.done
                                    ? "#0077b6"
                                    : "rgba(255,255,255,0.5)",
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
                                  color: task.done
                                    ? "rgba(255,255,255,0.4)"
                                    : "#e0e0e0",
                                  textDecorationLine: task.done
                                    ? "line-through"
                                    : "none",
                                  fontSize: 18,
                                  fontWeight: "bold",
                                  flex: 1,
                                }}
                              >
                                {
                                  CATEGORIES.find(
                                    (c) => c.label === task.category,
                                  )?.emoji
                                }{" "}
                                {task.title}
                              </Text>
                            </TouchableOpacity>
                          </>
                        </View>
                      </Swipeable>
                    ))}
                </View>
              </ScrollView>
            )}
          </BlurView>

          {/* ── EDIT TASK MODAL ── */}
          <Modal
            visible={editingIndex !== null}
            transparent
            animationType="slide"
            onRequestClose={() => setEditingIndex(null)}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={{
                flex: 1,
                justifyContent: "flex-end",
                backgroundColor: "rgba(0,0,0,0)",
              }}
            >
              <View
                style={{
                  backgroundColor: "#6b7a8d",
                  borderTopLeftRadius: 24,
                  borderTopRightRadius: 24,
                  padding: 24,
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.2)",
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
                  EDIT TASK
                </Text>
                <TextInput
                  value={editInput}
                  onChangeText={(text) => setEditInput(text)}
                  placeholderTextColor="#666"
                  autoFocus
                  style={{
                    backgroundColor: "rgba(255,255,255,0.1)",
                    color: "#fff",
                    padding: 14,
                    borderRadius: 12,
                    fontSize: 18,
                    marginBottom: 16,
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.2)",
                  }}
                />
                <View
                  style={{
                    flexDirection: "row",
                    gap: 8,
                    flexWrap: "wrap",
                    marginBottom: 16,
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
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                        borderRadius: 20,
                      }}
                    >
                      <Text style={{ color: "#fff", fontSize: 14 }}>
                        {cat.emoji} {cat.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <TouchableOpacity
                    onPress={() => setEditingIndex(null)}
                    style={{
                      flex: 1,
                      paddingVertical: 14,
                      borderRadius: 50,
                      alignItems: "center",
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.3)",
                    }}
                  >
                    <Text style={{ color: "#fff", fontSize: 16 }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={saveEdit}
                    style={{
                      flex: 2,
                      backgroundColor: "#00b4d8",
                      paddingVertical: 14,
                      borderRadius: 50,
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        color: "#fff",
                        fontSize: 16,
                        fontWeight: "bold",
                      }}
                    >
                      Save
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          </Modal>
        </SafeAreaView>
      </View>
    </View>
  );
}

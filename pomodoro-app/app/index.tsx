import { useState, useEffect, useRef } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Animated,
} from "react-native";

// Total work time in seconds (25 min)
const WORK_TIME = 25 * 60;
// Total break time in seconds (5 min)
const BREAK_TIME = 5 * 60;
// Available task categories
const CATEGORIES = [
  { label: "Work", emoji: "💼" },
  { label: "Personal", emoji: "🙋" },
  { label: "Home", emoji: "🏠" },
  { label: "Health", emoji: "💪" },
  { label: "Learning", emoji: "📚" },
];

export default function Index() {
  // Seconds remaining on the timer
  const [seconds, setSeconds] = useState(WORK_TIME);
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
  // Fish positions — each fish swims independently
  const fish1X = useRef(new Animated.Value(0)).current;
  const fish2X = useRef(new Animated.Value(100)).current;
  const fish3X = useRef(new Animated.Value(220)).current;
  // Fish direction — 1 = facing right, -1 = facing left
  const fish1Scale = useRef(new Animated.Value(1)).current;
  const fish2Scale = useRef(new Animated.Value(1)).current;
  const fish3Scale = useRef(new Animated.Value(1)).current;

  // Start or stop the interval whenever isRunning changes
  useEffect(() => {
    if (isRunning) {
      IntervalRef.current = setInterval(() => {
        setSeconds((s) => {
          // When time runs out, switch modes automatically
          if (s <= 1) {
            clearInterval(IntervalRef.current!);
            setIsRunning(false);
            setisBreak((prev) => {
              // Play different sounds for work end and break end
              if (prev) {
                playAlarm();
              } else {
                playChime();
              }
              // If we were on work, switch to break and vice versa
              const nextisBreak = !prev;
              // If switching to break, if means a work session just ended - add 1
              if (nextisBreak) setPomodoroCount((c) => c + 1);
              setSeconds(nextisBreak ? BREAK_TIME : WORK_TIME);
              return nextisBreak;
            });
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    } else {
      clearInterval(IntervalRef.current!);
    }
    // Cleanup interval when component unmounts
    return () => clearInterval(IntervalRef.current!);
  }, [isRunning]);

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
    setSeconds(WORK_TIME);
  }

  // Skips the break and goes back to work mode immediately
  function skipBreak() {
    setisBreak(false); // returns to work mode
    setIsRunning(false); // pauses the timer so the user can start it whenever they want
    setSeconds(WORK_TIME); // loads the 25 mins again
  }

  // Plays a soft chime sound using the Web Audio API
  function playChime() {
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(528, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      440,
      ctx.currentTime + 0.8,
    );

    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 1.2);
  }

  // Plays a soft alarm sound to signal break is over
  function playAlarm() {
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(880, ctx.currentTime);
    oscillator.frequency.setValueAtTime(660, ctx.currentTime + 0.2);
    oscillator.frequency.setValueAtTime(880, ctx.currentTime + 0.4);
    oscillator.frequency.setValueAtTime(660, ctx.currentTime + 0.6);

    gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.8);
  }

  // Adds a new task to the list
  function addTask() {
    if (!taskInput.trim()) return;
    // New tasks start as not done
    setTasks([
      ...tasks,
      { title: taskInput.trim(), done: false, category: selectedCategory },
    ]);
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
    <View style={{ flex: 1, backgroundColor: "#0f0f1a" }}>
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
          {/* Mode label + pomodoro count */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              marginBottom: 8,
            }}
          >
            <View
              style={{
                backgroundColor: isBreak ? "#00ff8822" : "#e9456022",
                paddingHorizontal: 14,
                paddingVertical: 4,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: isBreak ? "#00ff88" : "#e94560",
              }}
            >
              <Text
                style={{
                  color: isBreak ? "#00ff88" : "#e94560",
                  fontSize: 12,
                  fontWeight: "bold",
                  letterSpacing: 2,
                }}
              >
                {isBreak ? "BREAK" : "FOCUS"}
              </Text>
            </View>
            <Text style={{ color: "#555", fontSize: 13 }}>
              🍅 {pomodoroCount}
            </Text>
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
            <TouchableOpacity onPress={skipBreak} style={{ marginBottom: 8 }}>
              <Text style={{ color: "#6666aa", fontSize: 13 }}>
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
                backgroundColor: isRunning ? "#333" : "#e94560",
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
            <input
              value={taskInput}
              onChange={(e) => setTaskInput(e.target.value)}
              placeholder="Add a task..."
              style={{
                flex: 1,
                backgroundColor: "#2a2a4e",
                color: "#ffffff",
                padding: 10,
                borderRadius: 8,
                border: "none",
                fontSize: 15,
                outline: "none",
              }}
            />
            <TouchableOpacity
              onPress={addTask}
              style={{
                backgroundColor: "#e94560",
                padding: 10,
                borderRadius: 8,
                justifyContent: "center",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "bold" }}>Add</Text>
            </TouchableOpacity>
          </View>

          {/* Category selector - only shows when typing */}
          {taskInput.length > 0 && (
            <>
              <Text style={{ color: "#888", fontSize: 11, marginTop: 8 }}>
                CATEGORY
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 8,
                  marginTop: 8,
                }}
              >
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.label}
                    onPress={() => setSelectedCategory(cat.label)}
                    style={{
                      backgroundColor:
                        selectedCategory === cat.label ? "#e94560" : "#2a2a4e",
                      padding: 6,
                      borderRadius: 12,
                    }}
                  >
                    <Text style={{ color: "#fff", fontSize: 11 }}>
                      {cat.emoji} {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* Category filter buttons */}
          <Text
            style={{
              color: "#555",
              fontSize: 10,
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
            }}
          >
            <TouchableOpacity
              onPress={() => setFilterCategory(null)}
              style={{
                backgroundColor:
                  filterCategory === null ? "#e94560" : "#1e1e30",
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: filterCategory === null ? "#e94560" : "#333",
              }}
            >
              <Text style={{ color: "#fff", fontSize: 11 }}>All</Text>
            </TouchableOpacity>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.label}
                onPress={() => setFilterCategory(cat.label)}
                style={{
                  backgroundColor:
                    filterCategory === cat.label ? "#e94560" : "#1e1e30",
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor:
                    filterCategory === cat.label ? "#e94560" : "#333",
                }}
              >
                <Text style={{ color: "#fff", fontSize: 11 }}>
                  {cat.emoji} {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Task list */}
          <View style={{ marginTop: 16 }}>
            {tasks
              .filter(
                (task) =>
                  filterCategory === null || task.category === filterCategory,
              )
              .map((task, index) => (
                <View
                  key={index}
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    backgroundColor: "#1e1e30",
                    padding: 14,
                    borderRadius: 12,
                    marginBottom: 8,
                    borderWidth: 1,
                    borderColor: "#2a2a4e",
                  }}
                >
                  {editingIndex === index ? (
                    // Edit mode — show input and save button
                    <>
                      <View style={{ flex: 1 }}>
                        <input
                          value={editInput}
                          onChange={(e) => setEditInput(e.target.value)}
                          style={{
                            width: "100%",
                            backgroundColor: "#1a1a2e",
                            color: "#fff",
                            padding: 6,
                            borderRadius: 6,
                            border: "none",
                            fontSize: 16,
                            outline: "none",
                          }}
                        />
                        {/* Category selector in edit mode */}
                        <View
                          style={{
                            flexDirection: "row",
                            gap: 4,
                            marginTop: 6,
                            flexWrap: "wrap",
                          }}
                        >
                          {CATEGORIES.map((cat) => (
                            <TouchableOpacity
                              key={cat.label}
                              onPress={() => setSelectedCategory(cat.label)}
                              style={{
                                backgroundColor:
                                  selectedCategory === cat.label
                                    ? "#e94560"
                                    : "#2a2a4e",
                                padding: 4,
                                borderRadius: 8,
                              }}
                            >
                              <Text style={{ color: "#fff", fontSize: 10 }}>
                                {cat.emoji} {cat.label}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                      <TouchableOpacity
                        onPress={saveEdit}
                        style={{
                          backgroundColor: "#0a3a2a",
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: 6,
                          marginLeft: 8,
                        }}
                      >
                        <Text style={{ color: "#00ff88", fontSize: 12 }}>
                          Save
                        </Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    // Normal mode — show task and action buttons
                    <>
                      <TouchableOpacity
                        onPress={() => toggleTask(index)}
                        style={{ flex: 1 }}
                      >
                        <Text
                          style={{
                            color: task.done ? "#555" : "#e0e0e0",
                            textDecorationLine: task.done
                              ? "line-through"
                              : "none",
                            fontSize: 15,
                          }}
                        >
                          {task.done ? "✓ " : "○ "}
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
                            backgroundColor: "#2a2a5e",
                            paddingHorizontal: 10,
                            paddingVertical: 4,
                            borderRadius: 6,
                          }}
                        >
                          <Text style={{ color: "#aaaaff", fontSize: 12 }}>
                            Edit
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => deleteTask(index)}
                          style={{
                            backgroundColor: "#3a1a24",
                            paddingHorizontal: 10,
                            paddingVertical: 4,
                            borderRadius: 6,
                          }}
                        >
                          <Text style={{ color: "#e94560", fontSize: 12 }}>
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
    </View>
  );
}

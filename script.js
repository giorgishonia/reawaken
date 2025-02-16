// Initialize Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAEpfs-P81k4vagCAPlrW_qOXEysllMjGg",
  authDomain: "reawakening-fe981.firebaseapp.com",
  projectId: "reawakening-fe981",
  storageBucket: "reawakening-fe981.firebasestorage.app",
  messagingSenderId: "310750239922",
  appId: "1:310750239922:web:cdfb7c87f2e05c52553dab",
  measurementId: "G-WLY0K1N1TG",
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Set persistence to LOCAL (this keeps the user logged in until they explicitly sign out)
auth
  .setPersistence(firebase.auth.Auth.Persistence.LOCAL)
  .then(() => {
    console.log("Persistence set to LOCAL");
  })
  .catch((error) => {
    console.error("Persistence error:", error);
  });

// Modify the auth state listener
auth.onAuthStateChanged(async (user) => {
  if (user) {
    currentUser = user;
    isAuthenticated = true;
    localStorage.setItem(
      "user",
      JSON.stringify({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
      })
    );
    await initializePlayer();
    await printToTerminal("[ SYSTEM RECOGNIZES YOU ]", "system");

    // // Show welcome message with motivation
    // const quote = getRandomItem(MOTIVATION.QUOTES);
    // await printToTerminal(`"${quote.text}"`, "quest");
    // await printToTerminal(
    //   "\nType !commands to view available protocols",
    //   "info"
    // );
  } else {
    // Check localStorage for existing session
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      auth
        .signInWithEmailAndPassword(JSON.parse(storedUser).email)
        .catch(async () => {
          localStorage.removeItem("user");
          currentUser = null;
          isAuthenticated = false;
          await printToTerminal("[ CONNECTION LOST ]", "error");
          await printToTerminal("Hunter Authentication Required", "warning");
        });
    } else {
      currentUser = null;
      isAuthenticated = false;
      await printToTerminal("[ ACCESS DENIED ]", "error");
      await printToTerminal("Use !reawaken to establish connection", "info");
    }
  }
});

// Modify the sign out functionality (if you have one)
async function signOut() {
  try {
    await auth.signOut();
    localStorage.removeItem("user"); // Clear stored user data
    currentUser = null;
    isAuthenticated = false;
    printToTerminal("Successfully signed out.");
  } catch (error) {
    printToTerminal("Error signing out: " + error.message);
  }
}

// Terminal State
let isAuthenticated = false;
let currentUser = null;
let playerStats = {
  level: 1,
  exp: 0,
  gold: 0,
  rank: "E",
  streak: 0,
  questsCompleted: 0,
  achievements: [],
  inventory: [],
  lastDailyCompletion: null,
  profile: {
    name: "",
    title: "Novice",
    picture: "default.png",
    bio: "",
    class: "Hunter",
    joinDate: null,
  },
  failures: [],
  waterIntake: {
    current: 0,
    lastReset: null,
    streakDays: 0,
  },
  workoutStreak: {
    current: 0,
    lastWorkout: null,
    totalWorkouts: 0,
    xpMultiplier: 1.0,
  },
};

// Terminal Elements
const terminal = document.getElementById("terminal");
const output = document.getElementById("output");
const input = document.getElementById("input");
const notification = document.getElementById("notification");

// Shop system
async function showShop() {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  printToTerminal("=== SHOP ===", "info");
  Object.values(ITEMS).forEach((item) => {
    printToTerminal(`${item.name} - ${item.price} gold`, "info");
    printToTerminal(`Description: ${item.description}`, "system");
    printToTerminal("---", "system");
  });
}

// Command Handler
const commands = {
  "!commands": showHelp,
  "!c": showHelp,
  "!reawaken": handleReawaken,
  "!r": handleReawaken,
  "!quests": () => showQuestWindow("normal"),
  "!q": () => showQuestWindow("normal"),
  "!dailyquests": () => showQuestWindow("daily"),
  "!dq": () => showQuestWindow("daily"),
  "!clear": clearTerminal,
  "!cl": clearTerminal,
  "!sleep": handleSleep,
  "!leaderboard": showLeaderboard,
  "!lb": showLeaderboard,
  "!achievements": showAchievements,
  "!ach": showAchievements,
  "!profile": showProfile,
  "!p": showProfile,
  "!inventory": showInventory,
  "!i": showInventory,
  "!shop": showShop,
  "!sh": showShop,
  "!addxp": addExperiencePoints,
  "!ax": addExperiencePoints,
  "!reset": handleReset,
  "!update": (args) => {
    if (args.length < 2) {
      printToTerminal(
        "Usage: !update <quest_id> <type> [amount|complete]",
        "warning"
      );
      printToTerminal("Examples:");
      printToTerminal("  !update abc123 daily 5     - Add 5 to progress");
      printToTerminal(
        "  !update abc123 daily complete  - Complete instantly",
        "info"
      );
      return;
    }
    const [questId, type, amount] = args;
    updateQuestProgress(questId, type, amount);
  },
  "!failures": showFailures,
  "!f": showFailures,
  "!battle": showBossBattles,
  "!b": showBossBattles,
  "!challenge": startBossBattle,
  "!ch": startBossBattle,
  "!progress": updateBattleProgress,
  "!p": updateBattleProgress,
  "!waterDrank": handleWaterIntake,
  "!wd": handleWaterIntake,
  "!waterStatus": showWaterStatus,
  "!ws": showWaterStatus,
  "!motivation": showMotivation,
  "!m": showMotivation,
  "!tip": showFitnessTip,
  "!t": showFitnessTip,
  "!workout": logWorkout,
  "!w": logWorkout,
  "!streak": showWorkoutStreak,
  "!ws": showWorkoutStreak,
  "!report": generateFitnessReport,
  "!r": generateFitnessReport,
  "!setname": setPlayerName,
  "!settitle": setPlayerTitle,
  "!setbio": setPlayerBio,
  "!setclass": setPlayerClass,
  "!simulate": simulateQuestTimeout, // Add new command
  "!rank": handleRankCommand,
  "!rankprogress": showRankProgress,
};

// Add these helper functions
function showHelp(args) {
  if (!args || args.length === 0) {
    // Show categories only
    printToTerminal("[ SYSTEM COMMANDS ] 📜");
    printToTerminal("--------------------------------------------");
    printToTerminal("!commands general - General Commands");
    printToTerminal("!commands profile - User Authentication & Profile");
    printToTerminal("!commands quests - Quests & Progression");
    printToTerminal("!commands status - Player Status & Progress");
    printToTerminal("!commands achievements - Achievements & Leaderboards");
    printToTerminal("!commands inventory - Inventory & Shop");
    printToTerminal("!commands water - Water Tracking");
    printToTerminal("!commands fitness - Fitness & Motivation");
    printToTerminal("!commands failures - Failures & Logs");
    printToTerminal(
      "\n> Each category contains specific commands for that area."
    );
    printToTerminal("> Type the category command to see detailed commands.");
    printToTerminal("--------------------------------------------");
    return;
  }

  // Handle category-specific commands
  const category = args[0].toLowerCase();
  switch (category) {
    case "general":
      printToTerminal("\n=== 📜 GENERAL COMMANDS ===", "system");
      printToTerminal("!commands, !c - Show all commands");
      printToTerminal("!clear, !cl - Clear the terminal");
      printToTerminal("!sleep - Log out (Enter sleep mode)");
      printToTerminal(
        "!simulate - Simulate daily quest timeout [Testing]",
        "warning"
      );
      break;

    case "auth":
    case "profile":
      printToTerminal("\n=== 🛡️ USER AUTHENTICATION & PROFILE ===", "system");
      printToTerminal("!reawaken, !r - Authenticate user");
      printToTerminal("!profile, !p - Show player profile");
      printToTerminal("!setname <name> - Set hunter name");
      // printToTerminal("!settitle <title> - Set your title");
      printToTerminal("!setbio <text> - Set your profile bio");
      // printToTerminal("!setclass <class> - Set your hunter class");
      break;

    case "quests":
    case "quest":
      printToTerminal("\n=== 🎯 QUESTS & PROGRESSION ===", "system");
      printToTerminal("!quests, !q - Show active quests");
      printToTerminal("!dailyquests, !dq - Show daily quests");
      printToTerminal("!addquest, !aq - Create a new quest");
      printToTerminal("!adddailyquest, !adq - Create a daily quest");
      printToTerminal(
        "!update <quest_id> <type> <amount> - Update quest progress"
      );
      break;

    case "status":
    case "progress":
      printToTerminal("\n=== 📊 PLAYER STATUS & PROGRESS ===", "system");
      printToTerminal("!status, !s - Show player status");
      printToTerminal("!addxp, !ax - Add experience points");
      printToTerminal("!reset - Reset progress (level, exp, gold)", "warning");
      break;

    case "achievements":
    case "leaderboard":
      printToTerminal("\n=== 🏆 ACHIEVEMENTS & LEADERBOARDS ===", "system");
      printToTerminal("!achievements, !ach - Show unlocked achievements");
      printToTerminal("!leaderboard, !lb - Show global leaderboard");
      break;

    case "inventory":
    case "shop":
      printToTerminal("\n=== 🎒 INVENTORY & SHOP ===", "system");
      printToTerminal("!inventory, !i - Show player inventory");
      printToTerminal("!shop, !sh - Open the shop");
      break;

    case "water":
      printToTerminal("\n=== 💧 WATER TRACKING ===", "system");
      printToTerminal("!waterDrank, !wd <glasses> - Track water intake");
      printToTerminal("!waterStatus, !ws - Show water intake progress");
      break;

    case "fitness":
    case "motivation":
      printToTerminal("\n=== 💪 FITNESS & MOTIVATION ===", "system");
      printToTerminal("!motivation, !m - Get a motivational quote");
      printToTerminal("!tip, !t - Show a fitness tip");
      printToTerminal("!workout, !w - Log a workout");
      printToTerminal("!streak, !ws - Show workout streak");
      printToTerminal("!report, !r - Generate a fitness report");
      break;

    case "failures":
    case "logs":
      printToTerminal("\n=== 🔥 FAILURES & LOGS ===", "system");
      printToTerminal("!failures, !f - Show failure logs", "warning");
      break;

    default:
      printToTerminal("Unknown category. Available categories:", "warning");
      printToTerminal("!commands general - General commands");
      printToTerminal("!commands profile - Profile & authentication");
      printToTerminal("!commands quests - Quest management");
      printToTerminal("!commands status - Player status");
      printToTerminal("!commands achievements - Achievements");
      printToTerminal("!commands inventory - Inventory");
      printToTerminal("!commands water - Water tracking");
      printToTerminal("!commands fitness - Fitness");
      printToTerminal("!commands failures - Failure logs");
      break;
  }
}

// Quest creation state
let creatingQuest = false;
let questCreationState = {
  type: null,
  title: null,
  count: null,
  metric: null,
  description: null,
};

async function showAchievements() {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  const playerRef = db.collection("players").doc(currentUser.uid);
  const player = (await playerRef.get()).data();

  printToTerminal("=== ACHIEVEMENTS ===", "info");
  player.achievements.forEach((achievementId) => {
    const achievement = Object.values(ACHIEVEMENTS).find(
      (a) => a.id === achievementId
    );
    if (achievement) {
      printToTerminal(`- ${achievement.name}`, "info");
    }
  });
}

function startQuestCreation(type) {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  creatingQuest = true;
  questCreationState = {
    type,
    title: null,
    count: null,
    metric: null,
    description: null,
  };

  if (type === "daily") {
    printToTerminal("Creating new daily quest", "info");
  } else {
    printToTerminal("Creating new quest", "info");
  }
  printToTerminal("Enter quest title (or press Enter to cancel):", "info");
}

// Keep this one (should be around line 270-290)
input.addEventListener("keypress", async (e) => {
  if (e.key === "Enter") {
    const value = input.value.trim();
    input.value = "";

    if (creatingQuest) {
      handleQuestCreation(value);
      return;
    }

    // Get the current prompt text
    const promptUser = playerStats?.profile?.name?.toUpperCase() || "PLAYER";
    // Print command with prompt to terminal
    printToTerminal(`${promptUser} : ${value}`, "command");

    // Check for reset confirmation first
    if (awaitingResetConfirmation) {
      if (value === "Reset the dungeon") {
        handleReset(["Reset", "the", "dungeon"]);
      } else {
        printToTerminal(
          'Please type "Reset the dungeon" exactly to confirm reset',
          "warning"
        );
      }
      return;
    }

    // Split command and arguments
    const [command, ...args] = value.split(" ");

    // Execute command if it exists
    if (commands[command]) {
      commands[command](args);
    } else if (value !== "") {
      printToTerminal(
        "Unknown command. Type !commands for available commands.",
        "error"
      );
    }
  }
});

async function handleQuestCreation(value) {
  if (value === "") {
    creatingQuest = false;
    questCreationState = {};
    printToTerminal("Quest creation cancelled.", "warning");
    return;
  }

  if (!questCreationState.title) {
    questCreationState.title = value;
    printToTerminal("Enter target count (number):", "info");
  } else if (!questCreationState.count) {
    const count = parseInt(value);
    if (isNaN(count)) {
      printToTerminal("Please enter a valid number:", "warning");
      return;
    }
    questCreationState.count = count;
    printToTerminal("Enter metric (e.g., km, pushups, minutes):", "info");
  } else if (!questCreationState.metric) {
    questCreationState.metric = value;
    printToTerminal(
      "Enter description (optional, press Enter to skip):",
      "info"
    );
  } else if (!questCreationState.description) {
    questCreationState.description = value || "No description";
    // Create the quest
    await createQuest(questCreationState);
    creatingQuest = false;
    questCreationState = {};
  }
}

async function createQuest(quest) {
  try {
    const questRef = db
      .collection("players")
      .doc(currentUser.uid)
      .collection(quest.type === "daily" ? "dailyQuests" : "quests");

    await questRef.add({
      title: quest.title,
      targetCount: quest.count,
      currentCount: 0,
      metric: quest.metric,
      description: quest.description,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      completed: false,
      ...(quest.type === "daily"
        ? {
            lastReset: firebase.firestore.FieldValue.serverTimestamp(),
          }
        : {}),
    });

    printToTerminal(
      `${
        quest.type === "daily" ? "Daily quest" : "Quest"
      } created successfully!`,
      "success"
    );
    showNotification("Quest created!");
  } catch (error) {
    printToTerminal("Error creating quest: " + error.message, "error");
  }
}

// Update the quest window display function
async function showQuestWindow(type) {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  const questsRef = db
    .collection("players")
    .doc(currentUser.uid)
    .collection(type === "daily" ? "dailyQuests" : "quests");

  try {
    const snapshot = await questsRef.get();

    printToTerminal(
      `=== ${type === "daily" ? "DAILY QUESTS" : "QUESTS"} ===`,
      "info"
    );

    if (snapshot.empty) {
      printToTerminal(`No ${type} quests available.`, "warning");
      return;
    }

    snapshot.forEach((doc) => {
      const quest = doc.data();
      printToTerminal(`\n[${quest.title}]`, "quest");
      printToTerminal(
        `Progress: ${quest.currentCount}/${quest.targetCount} ${quest.metric}`,
        "info"
      );
      printToTerminal(`Description: ${quest.description}`, "system");
      if (type === "daily") {
        const endOfDay = getEndOfDay();
        const timeRemaining = endOfDay - new Date();
        printToTerminal(
          `Time remaining: ${formatTimeRemaining(timeRemaining)}`,
          "warning"
        );
      }
      printToTerminal(`Commands:`, "system");
      printToTerminal(
        `  !update ${doc.id} ${type} <amount>  - Add specific amount`,
        "info"
      );
      printToTerminal(
        `  !update ${doc.id} ${type} complete  - Complete instantly`,
        "info"
      );
      printToTerminal("---", "system");
    });
  } catch (error) {
    printToTerminal("Error loading quests: " + error.message, "error");
  }
}

// Utility Functions
async function printToTerminal(text, type = "default") {
  const line = document.createElement("div");
  line.className = "terminal-line";

  // Add typewriter effect only for system messages
  if (type === "system") {
    line.classList.add("typewriter");
  } else if (type === "command") {
    line.classList.add("command-text");
  }

  // Add color class based on message type
  switch (type) {
    case "success":
      line.classList.add("text-success");
      break;
    case "error":
      line.classList.add("text-error");
      break;
    case "warning":
      line.classList.add("text-warning");
      break;
    case "info":
      line.classList.add("text-info");
      break;
    case "quest":
      line.classList.add("text-quest");
      break;
    case "reward":
      line.classList.add("text-reward");
      break;
    case "system":
      line.classList.add("text-system");
      break;
    case "command":
      line.classList.add("text-command");
      break;
  }

  if (type === "system") {
    // For system messages, add characters one by one
    line.textContent = "";
    output.appendChild(line);

    for (let i = 0; i < text.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      line.textContent += text[i];
    }
  } else {
    line.textContent = text;
    output.appendChild(line);
  }

  terminal.scrollTop = terminal.scrollHeight;
}

function showNotification(message) {
  notification.querySelector(".notification-content").textContent = message;
  notification.style.display = "block";
  setTimeout(() => {
    notification.style.display = "none";
  }, 3333);
}

function showStatus() {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }
  printToTerminal(`Level: ${playerStats.level}`, "info");
  printToTerminal(`Experience: ${playerStats.exp}/100`, "info");
  printToTerminal(`Gold: ${playerStats.gold}`, "info");
  printToTerminal(`Rank: ${playerStats.rank}`, "info");
}

function clearTerminal() {
  output.innerHTML = "";
}

async function initializePlayer() {
  try {
    const playerRef = db.collection("players").doc(currentUser.uid);
    const doc = await playerRef.get();

    if (doc.exists) {
      playerStats = doc.data();
    } else {
      // Initialize new player
      playerStats = {
        level: 1,
        exp: 0,
        gold: 0,
        rank: "E",
        streak: 0,
        questsCompleted: 0,
        achievements: [],
        inventory: [],
        lastDailyCompletion: null,
        profile: {
          name: "",
          title: "Novice",
          picture: "default.png",
          bio: "",
          class: "Hunter",
          joinDate: firebase.firestore.FieldValue.serverTimestamp(),
        },
        failures: [],
        waterIntake: {
          current: 0,
          lastReset: null,
          streakDays: 0,
        },
        workoutStreak: {
          current: 0,
          lastWorkout: null,
          totalWorkouts: 0,
          xpMultiplier: 1.0,
        },
      };

      await playerRef.set(playerStats);
    }

    updateTerminalPrompt();
    updateStatusBar();
  } catch (error) {
    console.error("Error initializing player:", error);
    printToTerminal("Error initializing player: " + error.message, "error");
  }
}

function updateStatusBar() {
  const statusBar = document.querySelector(".status-bar");
  const expNeeded = getExpNeededForLevel(playerStats.level);
  statusBar.innerHTML = `
            <span>RANK: ${playerStats.rank}</span>
            <span>LEVEL: ${playerStats.level}</span>
            <span>EXP: ${playerStats.exp}/${expNeeded}</span>
            <span>GOLD: ${playerStats.gold}</span>
        `;
}

// Add this to check and reset daily quests
async function checkDailyQuests() {
  if (!currentUser) return;

  const dailyQuestsRef = db
    .collection("players")
    .doc(currentUser.uid)
    .collection("dailyQuests");

  const snapshot = await dailyQuestsRef.get();

  snapshot.forEach(async (doc) => {
    const quest = doc.data();
    const lastReset = quest.lastReset?.toDate() || new Date(0);
    const now = new Date();

    // Check if it's a new day
    if (
      lastReset.getDate() !== now.getDate() ||
      lastReset.getMonth() !== now.getMonth() ||
      lastReset.getYear() !== now.getYear()
    ) {
      // Reset the daily quest
      await dailyQuestsRef.doc(doc.id).update({
        currentCount: 0,
        completed: false,
        lastReset: firebase.firestore.FieldValue.serverTimestamp(),
      });
    }
  });
}

// Add this function definition
async function handleReawaken() {
  if (!isAuthenticated) {
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      const result = await auth.signInWithPopup(provider);
      currentUser = result.user;
      isAuthenticated = true;
      showNotification("Successfully authenticated!");
      initializePlayer();
    } catch (error) {
      printToTerminal("Authentication failed: " + error.message, "error");
    }
  } else {
    printToTerminal("You are already authenticated.", "warning");
  }
}

// Add the sleep handler function
async function handleSleep() {
  if (!isAuthenticated) {
    printToTerminal("You are not awakened.", "warning");
    return;
  }

  try {
    await auth.signOut();
    localStorage.removeItem("user");
    currentUser = null;
    isAuthenticated = false;
    printToTerminal("You have entered sleep mode.", "warning");
    printToTerminal("Type !reawaken to continue.", "info");
  } catch (error) {
    printToTerminal("Error entering sleep mode: " + error.message, "error");
  }
}

// Initialize
async function initializeSystem() {
  // Clear any existing content
  output.innerHTML = "";

  // Sequence of initialization messages with delays
  const messages = [
    { text: "[ SYSTEM ONLINE ]", type: "system", delay: 0 },
    // {
    //   text: "[ INITIALIZING SYSTEM ]",
    //   type: "system",
    //   delay: 4000,
    // },
    // {
    //   text: "[ SYSTEM INITIALIZATION COMPLETE ]",
    //   type: "system",
    //   delay: 1200,
    // },
    {
      text: "Type !commands to view available protocols",
      type: "system",
      delay: 1800,
      speed: 0.1,
    },
  ];

  // Function to print messages with delay
  for (const message of messages) {
    await new Promise((resolve) => setTimeout(resolve, message.delay));
    await printToTerminal(message.text, message.type);
  }

  // Check authentication after initialization
  if (!isAuthenticated) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await printToTerminal("\n[ ACCESS DENIED ]", "error");
    await new Promise((resolve) => setTimeout(resolve, 800));
    await printToTerminal("Hunter Authentication Required", "warning");
    await new Promise((resolve) => setTimeout(resolve, 800));
    await printToTerminal("Use !reawaken to establish connection", "info");
  }
}

// Initialize systems
document.addEventListener("DOMContentLoaded", async () => {
  await PlayerDB.init();
  initializeQuestListeners();
  await initializeSystem();

  // Add suggestion box to DOM
  const suggestionBox = document.createElement("div");
  suggestionBox.innerHTML = suggestionBoxHTML;
  document.body.appendChild(suggestionBox);

  // Add new styles
  const styleSheet = document.createElement("style");
  styleSheet.textContent = styles + suggestionStyles;
  document.head.appendChild(styleSheet);
});

// Add command autocomplete
const commandAutocomplete = {
  commands: Object.keys(commands),
  currentSuggestionIndex: 0,

  suggest(input) {
    if (!input) return [];
    if (!input.startsWith("!")) return [];

    return this.commands
      .filter(
        (cmd) =>
          cmd.toLowerCase().startsWith(input.toLowerCase()) && cmd !== input
      )
      .slice(0, 5); // Limit to 5 suggestions
  },

  showNextSuggestion(input) {
    const suggestions = this.suggest(input);
    if (suggestions.length === 0) {
      input.placeholder = "";
      return;
    }

    this.currentSuggestionIndex =
      (this.currentSuggestionIndex + 1) % suggestions.length;
    input.placeholder = suggestions[this.currentSuggestionIndex];
  },
};

// Update input event listener for autocomplete
input.addEventListener("input", (e) => {
  const value = e.target.value;
  if (value.startsWith("!")) {
    commandAutocomplete.currentSuggestionIndex = 0;
    const suggestions = commandAutocomplete.suggest(value);
    input.placeholder = suggestions.length > 0 ? suggestions[0] : "";
  } else {
    input.placeholder = "";
  }
});

// Add tab completion
input.addEventListener("keydown", (e) => {
  if (e.key === "Tab") {
    e.preventDefault();
    const value = input.value;
    if (value.startsWith("!")) {
      commandAutocomplete.showNextSuggestion(input);
    }
  } else if (e.key === "Enter") {
    commandAutocomplete.currentSuggestionIndex = 0;
  }
});

// Remove old suggestion box HTML and CSS since we're using placeholder now
const suggestionBoxHTML = "";
const suggestionStyles = "";

// Add notification sounds and animations
const notificationSystem = {
  sounds: {
    success: new Audio("sounds/success.mp3"),
    warning: new Audio("sounds/warning.mp3"),
    error: new Audio("sounds/error.mp3"),
    buy: new Audio("sounds/buy.mp3"),
    sell: new Audio("sounds/sell.mp3"),
    system: new Audio("sounds/system.mp3"),
    levelup: new Audio("sounds/levelup.mp3"),
    close: new Audio("sounds/close.mp3"),
    activated: new Audio("sounds/activated.mp3"),
  },

  // Function to safely play sounds
  playSound(soundName) {
    const sound = this.sounds[soundName];
    if (sound) {
      // Reset the audio to start and play
      sound.currentTime = 0;
      sound.play().catch((error) => {
        console.log(`Error playing sound: ${error}`);
      });
    }
  },

  show(message, type = "info") {
    const notification = document.getElementById("notification");
    const content = notification.querySelector(".notification-content");
    content.textContent = message;
    notification.className = `notification ${type}`;

    // Remove any existing animation classes
    notification.classList.remove("slide-in", "slide-out");

    // Show notification and start slide-in
    notification.style.display = "block";
    notification.classList.add("slide-in");

    // Play the type-specific sound
    this.playSound(type);

    setTimeout(() => {
      // Start slide-out animation
      notification.classList.remove("slide-in");
      notification.classList.add("slide-out");

      // Hide after animation completes
      setTimeout(() => {
        notification.style.display = "none";
        notification.classList.remove("slide-out");
      }, 500); // Match animation duration
    }, 3000);
  },
};

// Update CSS for notifications
const styles = `
    .notification {
      animation: slideIn 0.5s ease-out;
    }

    .notification.animate {
      animation: shake 0.5s ease-in-out;
    }

    @keyframes slideIn {
      from { transform: translateX(100%); }
      to { transform: translateX(0); }
    }

    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(10px); }
      75% { transform: translateX(-10px); }
    }
  `;

// Update the quest listeners
function initializeQuestListeners() {
  if (!currentUser) return;

  // Normal quests listener
  const questsRef = db
    .collection("players")
    .doc(currentUser.uid)
    .collection("quests");
  questsRef.onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        const quest = change.doc.data();
        printToTerminal("\nNew quest added:", "info");
        printToTerminal(`[${quest.title}]`, "quest");
        printToTerminal(
          `Progress: ${quest.currentCount}/${quest.targetCount} ${quest.metric}`,
          "info"
        );
        printToTerminal(`Description: ${quest.description}`, "system");
        printToTerminal(`Commands:`, "system");
        printToTerminal(
          `  !update ${change.doc.id} normal <amount>  - Add specific amount`,
          "info"
        );
        printToTerminal(
          `  !update ${change.doc.id} normal complete  - Complete instantly`,
          "info"
        );
        printToTerminal("---", "system");
      } else if (change.type === "modified") {
        const quest = change.doc.data();
        printToTerminal(`\nQuest "${quest.title}" updated:`, "warning");
        printToTerminal(
          `Progress: ${quest.currentCount}/${quest.targetCount} ${quest.metric}`,
          "info"
        );
        printToTerminal("---", "system");
      }
    });
  });

  // Daily quests listener
  const dailyQuestsRef = db
    .collection("players")
    .doc(currentUser.uid)
    .collection("dailyQuests");
  dailyQuestsRef.onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        const quest = change.doc.data();
        printToTerminal("\nNew daily quest added:", "info");
        printToTerminal(`[${quest.title}]`, "quest");
        printToTerminal(
          `Progress: ${quest.currentCount}/${quest.targetCount} ${quest.metric}`,
          "info"
        );
        printToTerminal(`Description: ${quest.description}`, "system");
        printToTerminal("Resets daily", "warning");
        printToTerminal(`Commands:`, "system");
        printToTerminal(
          `  !update ${change.doc.id} daily <amount>  - Add specific amount`,
          "info"
        );
        printToTerminal(
          `  !update ${change.doc.id} daily complete  - Complete instantly`,
          "info"
        );
        printToTerminal("---", "system");
      } else if (change.type === "modified") {
        const quest = change.doc.data();
        printToTerminal(`\nDaily quest "${quest.title}" updated:`, "warning");
        printToTerminal(
          `Progress: ${quest.currentCount}/${quest.targetCount} ${quest.metric}`,
          "info"
        );
        printToTerminal("---", "system");
      }
    });
  });
}

// UI update functions
function updateQuestUI(quest, questId, type) {
  const windowId = type === "daily" ? "dailyQuestWindow" : "questWindow";
  const questList = document.querySelector(`#${windowId} .quest-list`);
  let questElement = document.getElementById(`quest-${questId}`);

  if (!questElement) {
    questElement = document.createElement("div");
    questElement.id = `quest-${questId}`;
    questElement.className = "quest-item";
    questList.appendChild(questElement);
  }

  questElement.innerHTML = `
      <h3>${quest.title}</h3>
      <p>Progress: ${quest.currentCount}/${quest.targetCount} ${
    quest.metric
  }</p>
      <p>${quest.description}</p>
      ${type === "daily" ? "<p>Resets daily</p>" : ""}
      <button onclick="updateQuestProgress('${questId}', '${type}')">Update Progress</button>
    `;
}

function removeQuestFromUI(questId, type) {
  const questElement = document.getElementById(`quest-${questId}`);
  if (questElement) {
    questElement.remove();
  }
}

// Add this IndexedDB initialization code
const dbName = "PlayerSystemDB";
const dbVersion = 1;

// IndexedDB helper class
class PlayerDB {
  static async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create stores
        if (!db.objectStoreNames.contains("playerData")) {
          db.createObjectStore("playerData", { keyPath: "uid" });
        }
        if (!db.objectStoreNames.contains("quests")) {
          db.createObjectStore("quests", { keyPath: "id" });
        }
      };
    });
  }

  static async savePlayer(playerData) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["playerData"], "readwrite");
      const store = transaction.objectStore("playerData");
      const request = store.put(playerData);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  static async getPlayer(uid) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["playerData"], "readonly");
      const store = transaction.objectStore("playerData");
      const request = store.get(uid);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}

// Achievement definitions
const ACHIEVEMENTS = {
  // Level Achievements
  NOVICE_HUNTER: {
    id: "novice_hunter",
    name: "Novice Hunter",
    description: "Reach level 5",
    ranks: [
      { rank: 1, requirement: 5, reward: { exp: 100, gold: 50 } },
      { rank: 2, requirement: 10, reward: { exp: 200, gold: 100 } },
      { rank: 3, requirement: 25, reward: { exp: 500, gold: 250 } },
      { rank: 4, requirement: 50, reward: { exp: 1000, gold: 500 } },
      { rank: 5, requirement: 100, reward: { exp: 2000, gold: 1000 } },
    ],
    currentRank: 0,
    type: "level",
    icon: "🌟",
  },

  // Quest Achievements
  QUEST_MASTER: {
    id: "quest_master",
    name: "Quest Master",
    description: "Complete quests",
    ranks: [
      { rank: 1, requirement: 5, reward: { exp: 50, gold: 25 } },
      { rank: 2, requirement: 10, reward: { exp: 100, gold: 50 } },
      { rank: 3, requirement: 25, reward: { exp: 250, gold: 125 } },
      { rank: 4, requirement: 50, reward: { exp: 500, gold: 250 } },
      { rank: 5, requirement: 100, reward: { exp: 1000, gold: 500 } },
    ],
    currentRank: 0,
    type: "quests_completed",
    icon: "📚",
  },

  // Streak Achievements
  STREAK_WARRIOR: {
    id: "streak_warrior",
    name: "Streak Warrior",
    description: "Maintain a daily streak",
    ranks: [
      { rank: 1, requirement: 3, reward: { exp: 50, gold: 25 } },
      { rank: 2, requirement: 7, reward: { exp: 200, gold: 100 } },
      { rank: 3, requirement: 14, reward: { exp: 400, gold: 200 } },
      { rank: 4, requirement: 30, reward: { exp: 1000, gold: 500 } },
      { rank: 5, requirement: 60, reward: { exp: 2000, gold: 1000 } },
    ],
    currentRank: 0,
    type: "daily_streak",
    icon: "🔥",
  },

  // Workout Achievements
  WORKOUT_CHAMPION: {
    id: "workout_champion",
    name: "Workout Champion",
    description: "Complete workouts",
    ranks: [
      { rank: 1, requirement: 5, reward: { exp: 50, gold: 25 } },
      { rank: 2, requirement: 10, reward: { exp: 100, gold: 50 } },
      { rank: 3, requirement: 25, reward: { exp: 300, gold: 150 } },
      { rank: 4, requirement: 50, reward: { exp: 500, gold: 250 } },
      { rank: 5, requirement: 100, reward: { exp: 1000, gold: 500 } },
    ],
    currentRank: 0,
    type: "total_workouts",
    icon: "🏆",
  },

  // Water Intake Achievements
  HYDRATION_MASTER: {
    id: "hydration_master",
    name: "Hydration Master",
    description: "Maintain a water intake streak",
    ranks: [
      { rank: 1, requirement: 3, reward: { exp: 50, gold: 25 } },
      { rank: 2, requirement: 7, reward: { exp: 100, gold: 50 } },
      { rank: 3, requirement: 14, reward: { exp: 200, gold: 100 } },
      { rank: 4, requirement: 30, reward: { exp: 500, gold: 250 } },
      { rank: 5, requirement: 60, reward: { exp: 1000, gold: 500 } },
    ],
    currentRank: 0,
    type: "water_streak",
    icon: "💧",
  },

  // Gold Achievements
  GOLD_BARON: {
    id: "gold_baron",
    name: "Gold Baron",
    description: "Accumulate gold",
    ranks: [
      { rank: 1, requirement: 1000, reward: { exp: 100, gold: 50 } },
      { rank: 2, requirement: 5000, reward: { exp: 300, gold: 150 } },
      { rank: 3, requirement: 10000, reward: { exp: 500, gold: 250 } },
      { rank: 4, requirement: 25000, reward: { exp: 1000, gold: 500 } },
      { rank: 5, requirement: 50000, reward: { exp: 2000, gold: 1000 } },
    ],
    currentRank: 0,
    type: "total_gold",
    icon: "💎",
  },

  // Rank Achievements
  RANK_MASTER: {
    id: "rank_master",
    name: "Rank Master",
    description: "Achieve higher ranks",
    ranks: [
      { rank: 1, requirement: "D", reward: { exp: 200, gold: 100 } },
      { rank: 2, requirement: "C", reward: { exp: 400, gold: 200 } },
      { rank: 3, requirement: "B", reward: { exp: 600, gold: 300 } },
      { rank: 4, requirement: "A", reward: { exp: 800, gold: 400 } },
      { rank: 5, requirement: "S", reward: { exp: 1000, gold: 500 } },
    ],
    currentRank: 0,
    type: "rank",
    icon: "👑",
  },
};

// Item definitions
const ITEMS = {
  // 🎓 XP & Level Boosters
  MINOR_XP_BOOST: {
    id: "minor_xp_boost",
    name: "Minor XP Boost",
    description: "Increases XP gain by 10% for 30 minutes",
    price: 50,
    category: "booster",
    rankRequired: "E",
    duration: 1800000, // 30 minutes
    effect: { type: "global_xp", value: 1.1 },
  },
  GOLDEN_GRIMOIRE: {
    id: "golden_grimoire",
    name: "Golden Grimoire",
    description: "Increases XP gain from all activities by 25% for 2 hours",
    price: 250,
    category: "booster",
    rankRequired: "D",
    duration: 7200000, // 2 hours
    effect: { type: "global_xp", value: 1.25 },
  },
  RANK_ACCELERATOR: {
    id: "rank_accelerator",
    name: "Rank Accelerator",
    description: "Doubles XP gain for ranking up for 1 hour",
    price: 500,
    category: "booster",
    rankRequired: "C",
    duration: 3600000, // 1 hour
    effect: { type: "rank_xp", value: 2.0 },
  },
  RULERS_AUTHORITY: {
    id: "rulers_authority",
    name: "Ruler's Authority",
    description: "Triples XP gain from all sources for 30 minutes",
    price: 1000,
    category: "booster",
    rankRequired: "A",
    duration: 1800000, // 30 minutes
    effect: { type: "global_xp", value: 3.0 },
  },

  // 🎯 Quest Enhancers
  BASIC_QUEST_BOOST: {
    id: "basic_quest_boost",
    name: "Basic Quest Boost",
    description: "Increases quest progress speed by 20% for 30 minutes",
    price: 75,
    category: "enhancer",
    rankRequired: "E",
    duration: 1800000, // 30 minutes
    effect: { type: "quest_progress", value: 1.2 },
  },
  QUEST_BOOSTER: {
    id: "quest_booster",
    name: "Quest Booster",
    description: "Doubles quest rewards for 1 hour",
    price: 300,
    category: "enhancer",
    rankRequired: "D",
    duration: 3600000, // 1 hour
    effect: { type: "quest_rewards", value: 2.0 },
  },
  INSTANT_TASK_COMPLETE: {
    id: "instant_task_complete",
    name: "Instant Task Completion",
    description: "Instantly completes one active quest",
    price: 500,
    category: "enhancer",
    rankRequired: "C",
    effect: { type: "complete_quest", value: 1 },
  },
  MONARCHS_BLESSING: {
    id: "monarchs_blessing",
    name: "Monarch's Blessing",
    description: "Triples all quest rewards and progress for 30 minutes",
    price: 800,
    category: "enhancer",
    rankRequired: "B",
    duration: 1800000, // 30 minutes
    effect: { type: "quest_rewards", value: 3.0 },
  },

  // 💪 Training Boosters
  NOVICE_STRENGTH: {
    id: "novice_strength",
    name: "Novice Strength",
    description:
      "Increases strength training effectiveness by 15% for 30 minutes",
    price: 60,
    category: "training",
    rankRequired: "E",
    duration: 1800000, // 30 minutes
    effect: { type: "strength_boost", value: 1.15 },
  },
  BEAST_BREATH: {
    id: "beast_breath",
    name: "Beast Breath",
    description: "Increases strength training effectiveness by 50% for 1 hour",
    price: 400,
    category: "training",
    rankRequired: "D",
    duration: 3600000, // 1 hour
    effect: { type: "strength_boost", value: 1.5 },
  },
  GIANTS_MIGHT: {
    id: "giants_might",
    name: "Giant's Might",
    description: "Doubles all training effectiveness for 30 minutes",
    price: 600,
    category: "training",
    rankRequired: "C",
    duration: 1800000, // 30 minutes
    effect: { type: "training_boost", value: 2.0 },
  },
  DEMON_KINGS_STRENGTH: {
    id: "demon_kings_strength",
    name: "Demon King's Strength",
    description: "Triples strength gains for 15 minutes",
    price: 1000,
    category: "training",
    rankRequired: "A",
    duration: 900000, // 15 minutes
    effect: { type: "strength_boost", value: 3.0 },
  },

  // 🏆 Permanent Upgrades
  MINOR_UPGRADE: {
    id: "minor_upgrade",
    name: "Minor Upgrade",
    description: "Permanently increases all XP gain by 2%",
    price: 100,
    category: "upgrade",
    rankRequired: "E",
    effect: { type: "permanent_xp", value: 1.02 },
  },
  GOLD_MAGNET: {
    id: "gold_magnet",
    name: "Gold Magnet",
    description: "Permanently increases gold earned from all sources by 15%",
    price: 2000,
    category: "upgrade",
    rankRequired: "A",
    effect: { type: "gold_multiplier", value: 1.15 },
  },
  XP_MASTER: {
    id: "xp_master",
    name: "XP Master",
    description: "Permanently increases all XP gain by 10%",
    price: 3000,
    category: "upgrade",
    rankRequired: "S",
    effect: { type: "permanent_xp", value: 1.1 },
  },
  MONARCHS_DOMAIN: {
    id: "monarchs_domain",
    name: "Monarch's Domain",
    description: "Permanently increases all stats by 20%",
    price: 5000,
    category: "upgrade",
    rankRequired: "S",
    effect: { type: "all_stats", value: 1.2 },
  },

  // 💰 Gold & Economy
  SMALL_POUCH: {
    id: "small_pouch",
    name: "Small Pouch",
    description: "Grants 100 gold instantly",
    price: 80,
    category: "economy",
    rankRequired: "E",
    effect: { type: "gold", value: 100 },
  },
  GOLD_POUCH: {
    id: "gold_pouch",
    name: "Gold Pouch",
    description: "Grants 500 gold instantly",
    price: 250,
    category: "economy",
    rankRequired: "E",
    effect: { type: "gold", value: 500 },
  },
  TREASURE_CHEST: {
    id: "treasure_chest",
    name: "Treasure Chest",
    description: "Grants 2500 gold instantly",
    price: 1000,
    category: "economy",
    rankRequired: "C",
    effect: { type: "gold", value: 2500 },
  },
  DUNGEON_JACKPOT: {
    id: "dungeon_jackpot",
    name: "Dungeon Jackpot",
    description: "Grants 10000 gold instantly",
    price: 4000,
    category: "economy",
    rankRequired: "A",
    effect: { type: "gold", value: 10000 },
  },

  // 🏅 Special Titles & Cosmetics
  TITLE_NECROMANCER: {
    id: "title_necromancer",
    name: 'Title: "Necromancer"',
    description: "A title for those who have mastered the art of necromancy",
    price: 500,
    category: "title",
    rankRequired: "A",
    effect: { type: "title", value: "Necromancer" },
  },
  TITLE_LEGEND: {
    id: "title_legend",
    name: 'Title: "Legend"',
    description: "A rare title for top-ranked players",
    price: 1500,
    category: "title",
    rankRequired: "A",
    effect: { type: "title", value: "Legend" },
  },
  CUSTOM_NAME_COLOR: {
    id: "custom_name_color",
    name: "Custom Name Color",
    description: "Change the color of your name in rankings and messages",
    price: 500,
    category: "title",
    rankRequired: "E",
    effect: { type: "name_color", value: true },
  },
  TITLE_SHADOW_MONARCH: {
    id: "title_shadow_monarch",
    name: 'Title: "Shadow Monarch"',
    description: "The ultimate title reserved for the strongest",
    price: 5000,
    category: "title",
    rankRequired: "S",
    effect: { type: "title", value: "Shadow Monarch" },
  },

  // 🌟 Special Items
  DAILY_QUEST_RESET: {
    id: "daily_quest_reset",
    name: "Daily Quest Reset",
    description: "Reset all daily quests immediately",
    price: 750,
    category: "special",
    rankRequired: "B",
    effect: { type: "reset_daily", value: true },
  },
  ARISE_POTION: {
    id: "arise_potion",
    name: "Arise Potion",
    description: "Instantly recover from workout fatigue",
    price: 1000,
    category: "special",
    rankRequired: "A",
    effect: { type: "remove_fatigue", value: true },
  },
  CHALLENGERS_MARK: {
    id: "challengers_mark",
    name: "Challenger's Mark",
    description: "Next workout gives 5x XP",
    price: 2000,
    category: "special",
    rankRequired: "S",
    effect: { type: "next_workout_boost", value: 5.0 },
  },
  MINOR_MOTIVATION: {
    id: "minor_motivation",
    name: "Minor Motivation",
    description: "Increases motivation gain by 20% for 30 minutes",
    price: 70,
    category: "special",
    rankRequired: "E",
    duration: 1800000, // 30 minutes
    effect: { type: "motivation_boost", value: 1.2 },
  },

  // ⚔️ Hunter Equipment
  MANA_STONE: {
    id: "mana_stone",
    name: "Mana Stone",
    description:
      "A basic mana stone that enhances your training effectiveness by 25% for 1 hour",
    price: 300,
    category: "hunter",
    rankRequired: "E",
    duration: 3600000, // 1 hour
    effect: { type: "training_boost", value: 1.25 },
  },
  DEMON_KINGS_DAGGER: {
    id: "demon_kings_dagger",
    name: "Demon King's Dagger",
    description:
      "A legendary dagger that doubles all combat-related training gains for 2 hours",
    price: 2000,
    category: "hunter",
    rankRequired: "B",
    duration: 7200000, // 2 hours
    effect: { type: "combat_training", value: 2.0 },
  },
  ESIL_RADIRUS_BLESSING: {
    id: "esil_blessing",
    name: "Esil Radiru's Blessing",
    description:
      "A demon noble's blessing that increases all stats by 30% for 1 hour",
    price: 3000,
    category: "hunter",
    rankRequired: "A",
    duration: 3600000, // 1 hour
    effect: { type: "all_stats", value: 1.3 },
  },
  CHALICE_OF_REBIRTH: {
    id: "chalice_rebirth",
    name: "Chalice of Rebirth",
    description:
      "A mystical chalice that instantly restores all energy and removes fatigue",
    price: 1500,
    category: "hunter",
    rankRequired: "C",
    effect: { type: "full_restore", value: true },
  },

  // 📜 Skill Books
  RULERS_AUTHORITY_SKILL: {
    id: "rulers_authority_skill",
    name: "Ruler's Authority Skill Book",
    description:
      "Learn to channel the power of rulers. Permanently increases training effectiveness by 15%",
    price: 5000,
    category: "skill",
    rankRequired: "A",
    effect: { type: "permanent_training", value: 1.15 },
  },
  SHADOW_EXTRACTION: {
    id: "shadow_extraction",
    name: "Shadow Extraction Skill Book",
    description:
      "Master the art of shadow extraction. Doubles XP gain during night training",
    price: 3000,
    category: "skill",
    rankRequired: "B",
    effect: { type: "night_training", value: 2.0 },
  },
  DOMINATOR_TOUCH: {
    id: "dominator_touch",
    name: "Dominator's Touch Skill Book",
    description:
      "Learn to dominate your limits. Increases all gains by 20% when below 30% energy",
    price: 4000,
    category: "skill",
    rankRequired: "A",
    effect: { type: "low_energy_boost", value: 1.2 },
  },
  ASHBORN_BLESSING: {
    id: "ashborn_blessing",
    name: "Ashborn's Blessing",
    description:
      "Receive the Fragment of Brilliant Light. Triples all gains for 10 minutes",
    price: 10000,
    category: "skill",
    rankRequired: "S",
    duration: 600000, // 10 minutes
    effect: { type: "all_gains", value: 3.0 },
  },

  // 🏰 Dungeon Rewards
  DUNGEON_KEY_BASIC: {
    id: "dungeon_key_basic",
    name: "Basic Dungeon Key",
    description:
      "Access to a D-rank dungeon. Grants bonus XP and gold for next workout",
    price: 500,
    category: "dungeon",
    rankRequired: "E",
    effect: { type: "dungeon_bonus", value: 1.5 },
  },
  DUNGEON_KEY_ADVANCED: {
    id: "dungeon_key_advanced",
    name: "Advanced Dungeon Key",
    description:
      "Access to a B-rank dungeon. Significant bonus to next workout rewards",
    price: 2000,
    category: "dungeon",
    rankRequired: "C",
    effect: { type: "dungeon_bonus", value: 2.0 },
  },
  DEMON_CASTLE_KEY: {
    id: "demon_castle_key",
    name: "Demon Castle Key",
    description:
      "Access to an S-rank dungeon. Massive rewards for next workout",
    price: 5000,
    category: "dungeon",
    rankRequired: "A",
    effect: { type: "dungeon_bonus", value: 3.0 },
  },

  // 👑 Special Titles (Additional)
  TITLE_DEMON_SLAYER: {
    id: "title_demon_slayer",
    name: 'Title: "Demon Slayer"',
    description:
      "A title earned by those who have conquered demon realm training",
    price: 2000,
    category: "title",
    rankRequired: "B",
    effect: { type: "title", value: "Demon Slayer" },
  },
  TITLE_ARCHITECT: {
    id: "title_architect",
    name: 'Title: "Architect"',
    description: "A title for those who have mastered system manipulation",
    price: 3000,
    category: "title",
    rankRequired: "A",
    effect: { type: "title", value: "Architect" },
  },
  TITLE_ARISE: {
    id: "title_arise",
    name: 'Title: "ARISE"',
    description: "The ultimate command of the Shadow Monarch",
    price: 10000,
    category: "title",
    rankRequired: "S",
    effect: { type: "title", value: "ARISE" },
  },

  // 🌟 Special Items (Additional)
  BEAST_HEART: {
    id: "beast_heart",
    name: "Beast's Heart",
    description:
      "Consume the heart of a powerful beast. Permanent 5% increase to all stats",
    price: 3000,
    category: "special",
    rankRequired: "B",
    effect: { type: "permanent_stats", value: 1.05 },
  },
  DEMON_KINGS_SOUL: {
    id: "demon_kings_soul",
    name: "Demon King's Soul",
    description:
      "A fragment of a Demon King's soul. Grants immense power for 5 minutes",
    price: 5000,
    category: "special",
    rankRequired: "A",
    duration: 300000, // 5 minutes
    effect: { type: "all_stats", value: 5.0 },
  },
  SHADOW_SOLDIERS_ESSENCE: {
    id: "shadow_soldiers_essence",
    name: "Shadow Soldier's Essence",
    description:
      "Essence of a shadow soldier. Creates a shadow clone to double your next workout's effectiveness",
    price: 2000,
    category: "special",
    rankRequired: "B",
    effect: { type: "next_workout_clone", value: 2.0 },
  },
  IGRIS_BLESSING: {
    id: "igris_blessing",
    name: "Igris's Blessing",
    description:
      "Blessing from your most loyal shadow soldier. Increases all gains by 50% for 30 minutes",
    price: 3000,
    category: "special",
    rankRequired: "A",
    duration: 1800000, // 30 minutes
    effect: { type: "all_gains", value: 1.5 },
  },
  BERU_ENHANCEMENT: {
    id: "beru_enhancement",
    name: "Beru's Enhancement",
    description:
      "Enhancement from your ant king shadow. Doubles strength training effectiveness for 1 hour",
    price: 4000,
    category: "special",
    rankRequired: "A",
    duration: 3600000, // 1 hour
    effect: { type: "strength_boost", value: 2.0 },
  },
  TUSK_MOTIVATION: {
    id: "tusk_motivation",
    name: "Tusk's Motivation",
    description:
      "Motivation from your berserker shadow. Triples damage-type exercise effectiveness for 30 minutes",
    price: 3500,
    category: "special",
    rankRequired: "A",
    duration: 1800000, // 30 minutes
    effect: { type: "damage_exercise", value: 3.0 },
  },
};
// Leaderboard function
async function showLeaderboard() {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  windowSystem.showWindow("leaderboardWindow");
}

// Achievement system
async function checkAchievements() {
  if (!currentUser) return;

  try {
    const playerRef = db.collection("players").doc(currentUser.uid);
    const player = (await playerRef.get()).data();

    // Initialize achievements object if it doesn't exist
    if (!player.achievements) {
      await playerRef.update({ achievements: {} });
      player.achievements = {};
    }

    for (const [key, achievement] of Object.entries(ACHIEVEMENTS)) {
      // Initialize achievement in player data if not exists
      if (!player.achievements[achievement.id]) {
        player.achievements[achievement.id] = { currentRank: 0 };
      }

      const currentAchievement = player.achievements[achievement.id];
      const nextRank = currentAchievement.currentRank + 1;

      // Skip if already at max rank
      if (nextRank > achievement.ranks.length) continue;

      const rankData = achievement.ranks[nextRank - 1];
      let completed = false;

      switch (achievement.type) {
        case "level":
          completed = player.level >= rankData.requirement;
          break;
        case "quests_completed":
          completed = player.questsCompleted >= rankData.requirement;
          break;
        case "daily_streak":
          completed = player.streak >= rankData.requirement;
          break;
        case "workout_streak":
          completed = player.workoutStreak?.current >= rankData.requirement;
          break;
        case "total_workouts":
          completed =
            player.workoutStreak?.totalWorkouts >= rankData.requirement;
          break;
        case "water_streak":
          completed = player.waterIntake?.streakDays >= rankData.requirement;
          break;
        case "total_gold":
          completed = player.gold >= rankData.requirement;
          break;
        case "rank":
          completed = isRankSufficient(player.rank, rankData.requirement);
          break;
      }

      if (completed) {
        // Update achievement rank and grant rewards
        await playerRef.update({
          [`achievements.${achievement.id}.currentRank`]: nextRank,
          exp: firebase.firestore.FieldValue.increment(rankData.reward.exp),
          gold: firebase.firestore.FieldValue.increment(rankData.reward.gold),
        });

        // Update local stats
        playerStats.exp += rankData.reward.exp;
        playerStats.gold += rankData.reward.gold;
        if (!playerStats.achievements) playerStats.achievements = {};
        if (!playerStats.achievements[achievement.id]) {
          playerStats.achievements[achievement.id] = { currentRank: 0 };
        }
        playerStats.achievements[achievement.id].currentRank = nextRank;

        const rankText =
          nextRank === achievement.ranks.length ? "MAX" : nextRank;
        showNotification(
          `Achievement Ranked Up: ${achievement.name} Rank ${rankText}! ${achievement.icon}`
        );
        printToTerminal(
          `🏆 Achievement Ranked Up: ${achievement.name} (Rank ${rankText})`,
          "success"
        );
        printToTerminal(`${achievement.description}`, "info");
        printToTerminal(
          `Rewards: ${rankData.reward.exp} EXP, ${rankData.reward.gold} gold`,
          "reward"
        );

        // Check for level up from achievement rewards
        await checkLevelUp(playerRef, playerStats.exp);
        updateStatusBar();

        // Check for rank up after achievement
        await checkAndUpdateRank(playerRef, playerStats);
      }
    }
  } catch (error) {
    console.error("Check achievements error:", error);
  }
}

// Profile system
async function showProfile() {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  const playerRef = db.collection("players").doc(currentUser.uid);
  const player = (await playerRef.get()).data();

  // Ensure profile exists
  if (!player.profile) {
    player.profile = {
      name: "",
      title: "Novice",
      picture: "default.png",
      bio: "",
      class: "Hunter",
      joinDate: null,
    };
    // Update the player document with initialized profile
    await playerRef.update({ profile: player.profile });
  }

  printToTerminal("\n=== PLAYER PROFILE ===", "system");
  printToTerminal(`Name: ${player.profile.name || "Not set"}`, "info");
  printToTerminal(`Title: ${player.profile.title || "Novice"}`, "info");
  printToTerminal(`Class: ${player.profile.class || "Hunter"}`, "info");
  if (player.profile.bio) {
    printToTerminal(`\nBio: ${player.profile.bio}`, "info");
  }
  printToTerminal("\nStats:", "info");
  printToTerminal(`Level: ${player.level}`, "info");
  printToTerminal(`EXP: ${player.exp}/100`, "info");
  printToTerminal(`Gold: ${player.gold}`, "info");
  printToTerminal(`Rank: ${player.rank}`, "info");
  printToTerminal(`Daily Streak: ${player.streak} days`, "info");
  printToTerminal(`Quests Completed: ${player.questsCompleted}`, "info");

  if (player.workoutStreak?.current > 0) {
    printToTerminal(
      `Workout Streak: ${player.workoutStreak.current} days`,
      "info"
    );
  }

  if (player.waterIntake?.streakDays > 0) {
    printToTerminal(
      `Water Streak: ${player.waterIntake.streakDays} days`,
      "info"
    );
  }

  printToTerminal("\nAchievements:", "info");
  if (!player.achievements || player.achievements.length === 0) {
    printToTerminal("No achievements yet", "warning");
  } else {
    player.achievements.forEach((achievementId) => {
      const achievement = Object.values(ACHIEVEMENTS).find(
        (a) => a.id === achievementId
      );
      if (achievement) {
        printToTerminal(`- ${achievement.name}`, "info");
      }
    });
  }

  printToTerminal("\nProfile Commands:", "system");
  printToTerminal("!setname <name> - Set your hunter name", "info");
  // printToTerminal("!settitle <title> - Set your title", "info");
  printToTerminal("!setbio <text> - Set your profile bio", "info");
  // printToTerminal("!setclass <class> - Set your hunter class", "info");
}

// Inventory system
async function showInventory() {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  const playerRef = db.collection("players").doc(currentUser.uid);
  const player = (await playerRef.get()).data();

  printToTerminal("=== INVENTORY ===", "info");
  if (player.inventory.length === 0) {
    printToTerminal("Your inventory is empty!", "warning");
    return;
  }

  player.inventory.forEach((item) => {
    const itemData = ITEMS[item.id];
    if (itemData) {
      printToTerminal(`${itemData.name} - ${itemData.description}`, "info");
      if (item.expiresAt) {
        const timeLeft = Math.max(0, item.expiresAt - Date.now());
        printToTerminal(
          `Time remaining: ${Math.ceil(timeLeft / 60000)} minutes`,
          "info"
        );
      }
    }
  });
}

// Add this function before completeQuest
function getExpNeededForLevel(level) {
  // Base XP for first level
  const baseExp = 100;
  // Logarithmic growth component
  const logGrowth = 50 * Math.log(level + 1);
  // Linear growth component
  const linearGrowth = 25 * level;

  // Hybrid formula with diminishing returns
  return Math.floor(baseExp + linearGrowth + logGrowth);
}

async function checkLevelUp(playerRef, currentExp) {
  let remainingExp = currentExp;
  let levelsGained = 0;
  let currentLevel = playerStats.level;

  // Keep leveling up while we have enough XP
  while (remainingExp >= getExpNeededForLevel(currentLevel)) {
    remainingExp -= getExpNeededForLevel(currentLevel);
    levelsGained++;
    currentLevel++;
  }

  if (levelsGained > 0) {
    // Play levelup sound for level up
    notificationSystem.playSound("levelup");

    await playerRef.update({
      level: firebase.firestore.FieldValue.increment(levelsGained),
      exp: remainingExp,
    });

    // Update local stats
    playerStats.level += levelsGained;
    playerStats.exp = remainingExp;

    const levelUpMessage = getRandomItem(
      MOTIVATION.MILESTONE_MESSAGES.LEVEL_UP
    );
    printToTerminal(`\n${levelUpMessage}`, "system");
    printToTerminal(
      `🎉 LEVEL UP! You gained ${levelsGained} level${
        levelsGained > 1 ? "s" : ""
      }!`,
      "success"
    );
    printToTerminal(`You are now level ${playerStats.level}!`, "success");
    printToTerminal(
      `Next level requires: ${getExpNeededForLevel(playerStats.level)} XP`,
      "info"
    );

    // Check for rank up after level up
    await checkAndUpdateRank(playerRef, playerStats);

    // Check for achievements after level up
    await checkAchievements();
    updateStatusBar();
    showNotification(`Level Up! You are now level ${playerStats.level}! 🎉`);

    return true;
  }
  return false;
}

// Modify the completeQuest function's transaction block
async function completeQuest(questId, type) {
  try {
    const playerRef = db.collection("players").doc(currentUser.uid);
    const questRef = db
      .collection("players")
      .doc(currentUser.uid)
      .collection(type === "daily" ? "dailyQuests" : "quests")
      .doc(questId);

    // For daily quests, check if already completed today
    if (type === "daily") {
      const questDoc = await questRef.get();
      const quest = questDoc.data();

      if (quest.completed && quest.lastCompletion) {
        const lastCompletion = quest.lastCompletion.toDate();
        const now = new Date();

        // Check if completed today
        if (
          lastCompletion.getDate() === now.getDate() &&
          lastCompletion.getMonth() === now.getMonth() &&
          lastCompletion.getYear() === now.getYear()
        ) {
          printToTerminal(
            "This daily quest was already completed today!",
            "warning"
          );
          return;
        }
      }
    }

    // Calculate base rewards
    const expReward = 50;
    const goldReward = 25;

    await db.runTransaction(async (transaction) => {
      const playerDoc = await transaction.get(playerRef);
      if (!playerDoc.exists) return;

      const player = playerDoc.data();

      // Initialize arrays if they don't exist
      if (!player.achievements) {
        await playerRef.update({ achievements: [] });
        player.achievements = [];
      }
      if (!player.failures) {
        await playerRef.update({ failures: [] });
        player.failures = [];
      }

      // Apply active item effects
      const activeItems =
        player.inventory?.filter(
          (item) => item.expiresAt && item.expiresAt > Date.now()
        ) || [];

      let expMultiplier = 1;
      let goldMultiplier = 1;

      activeItems.forEach((item) => {
        const itemData = ITEMS[item.id];
        if (itemData?.effect?.type === "exp_multiplier") {
          expMultiplier *= itemData.effect.value;
        } else if (itemData?.effect?.type === "gold_multiplier") {
          goldMultiplier *= itemData.effect.value;
        }
      });

      // Calculate final rewards
      const finalExpReward = Math.floor(expReward * expMultiplier);
      const finalGoldReward = Math.floor(goldReward * goldMultiplier);

      // Calculate new total exp and check for level up
      const newTotalExp = player.exp + finalExpReward;
      const expNeeded = 100;
      const levelsToGain = Math.floor(newTotalExp / expNeeded);
      const remainingExp = newTotalExp % expNeeded;

      // Prepare updates object
      const updates = {
        gold: firebase.firestore.FieldValue.increment(finalGoldReward),
        questsCompleted: firebase.firestore.FieldValue.increment(1),
      };

      // Add exp and level updates
      if (levelsToGain > 0) {
        updates.level = firebase.firestore.FieldValue.increment(levelsToGain);
        updates.exp = remainingExp;
      } else {
        updates.exp = firebase.firestore.FieldValue.increment(finalExpReward);
      }

      // Update streak for daily quests
      let isNextDay = false;
      if (type === "daily") {
        const lastCompletion =
          player.lastDailyCompletion?.toDate() || new Date(0);
        const now = new Date();
        isNextDay =
          lastCompletion.getDate() !== now.getDate() ||
          lastCompletion.getMonth() !== now.getMonth() ||
          lastCompletion.getYear() !== now.getYear();

        if (isNextDay) {
          updates.streak = firebase.firestore.FieldValue.increment(1);
          updates.lastDailyCompletion =
            firebase.firestore.FieldValue.serverTimestamp();
        }
      }

      // Apply all updates in one transaction
      transaction.update(playerRef, updates);

      // Handle quest completion
      if (type === "daily") {
        transaction.update(questRef, {
          completed: true,
          lastCompletion: firebase.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        transaction.delete(questRef);
      }

      // Update local stats immediately
      if (levelsToGain > 0) {
        playerStats.level += levelsToGain;
        playerStats.exp = remainingExp;
      } else {
        playerStats.exp += finalExpReward;
      }
      playerStats.gold += finalGoldReward;
      playerStats.questsCompleted = (playerStats.questsCompleted || 0) + 1;
      if (type === "daily" && isNextDay) {
        playerStats.streak = (playerStats.streak || 0) + 1;
      }
      updateStatusBar();

      // Store level up info for after transaction
      if (levelsToGain > 0) {
        setTimeout(() => {
          const levelUpMessage = getRandomItem(
            MOTIVATION.MILESTONE_MESSAGES.LEVEL_UP
          );
          printToTerminal(`\n${levelUpMessage}`, "system");
          printToTerminal(
            `🎉 LEVEL UP! You gained ${levelsToGain} level${
              levelsToGain > 1 ? "s" : ""
            }!`,
            "success"
          );
          printToTerminal(`You are now level ${playerStats.level}!`, "success");
          showNotification(
            `Level Up! You are now level ${playerStats.level}! 🎉`
          );
        }, 100);
      }
    });

    // Check for achievements after transaction
    await checkAchievements();

    const questMessage = getRandomItem(
      MOTIVATION.MILESTONE_MESSAGES.QUEST_COMPLETE
    );
    printToTerminal(`\n${questMessage}`, "system");
    printToTerminal(`Quest completed successfully!`, "success");
    printToTerminal(
      `Earned ${expReward} EXP and ${goldReward} gold!`,
      "reward"
    );

    if (type === "daily") {
      const player = (await playerRef.get()).data();
      printToTerminal(`Daily streak: ${player.streak} days`, "info");
    }

    // Update windows
    windowSystem.updateWindowContent("questsWindow");
    windowSystem.updateWindowContent("dailyQuestsWindow");
    windowSystem.updateWindowContent("achievementsWindow");

    // After quest completion and rewards
    await checkAndUpdateRank(playerRef, playerStats);
    await checkAchievements();
  } catch (error) {
    printToTerminal("Error completing quest: " + error.message, "error");
    console.error("Complete quest error:", error);
  }
}

async function updateQuestProgress(questId, type, amount) {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  try {
    const questRef = db
      .collection("players")
      .doc(currentUser.uid)
      .collection(type === "daily" ? "dailyQuests" : "quests")
      .doc(questId);

    const questDoc = await questRef.get();
    if (!questDoc.exists) {
      printToTerminal("Quest not found.", "error");
      return;
    }

    const quest = questDoc.data();

    // For daily quests, check if already completed today
    if (type === "daily" && quest.completed && quest.lastCompletion) {
      const lastCompletion = quest.lastCompletion.toDate();
      const now = new Date();

      // Check if completed today
      if (
        lastCompletion.getDate() === now.getDate() &&
        lastCompletion.getMonth() === now.getMonth() &&
        lastCompletion.getYear() === now.getYear()
      ) {
        printToTerminal(
          "This daily quest was already completed today!",
          "warning"
        );
        return;
      }
    }

    let newCount;

    if (amount === "complete") {
      // Complete the quest instantly
      await completeQuest(questId, type);
      return;
    } else if (amount) {
      // Add specified amount
      const addAmount = parseInt(amount);
      if (isNaN(addAmount)) {
        printToTerminal(
          "Please specify a valid number or 'complete'",
          "warning"
        );
        return;
      }
      newCount = quest.currentCount + addAmount;
    } else {
      // Default to adding 1 if no amount specified
      newCount = quest.currentCount + 1;
    }

    if (newCount >= quest.targetCount) {
      // Complete the quest if target reached
      await completeQuest(questId, type);
    } else {
      // Update progress
      await questRef.update({
        currentCount: newCount,
      });
      printToTerminal(
        `Progress updated: ${newCount}/${quest.targetCount} ${quest.metric}`,
        "success"
      );
    }
  } catch (error) {
    printToTerminal("Error updating quest progress: " + error.message, "error");
  }
}

// Add this function to check if a quest was completed today
function wasCompletedToday(lastCompletion) {
  if (!lastCompletion) return false;

  const completionDate = lastCompletion.toDate();
  const now = new Date();

  return (
    completionDate.getDate() === now.getDate() &&
    completionDate.getMonth() === now.getMonth() &&
    completionDate.getYear() === now.getYear()
  );
}

// Modify completeAllQuests to respect daily completion restriction
async function completeAllQuests(type) {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  try {
    const questsRef = db
      .collection("players")
      .doc(currentUser.uid)
      .collection(type === "daily" ? "dailyQuests" : "quests");

    const snapshot = await questsRef.get();
    const completionPromises = [];

    snapshot.forEach((doc) => {
      const quest = doc.data();
      if (
        !quest.completed ||
        (type === "daily" && !wasCompletedToday(quest.lastCompletion))
      ) {
        completionPromises.push(completeQuest(doc.id, type));
      }
    });

    await Promise.all(completionPromises);
    printToTerminal(`All ${type} quests completed!`, "success");
    windowSystem.updateWindowContent(
      type === "daily" ? "dailyQuestsWindow" : "questsWindow"
    );
  } catch (error) {
    printToTerminal(`Error completing all quests: ${error.message}`, "error");
  }
}

// Add timer and failure tracking
const DAILY_QUEST_PENALTY = {
  exp: 50,
  gold: 25,
};

// Add these utility functions for time management
function getEndOfDay() {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return end;
}

function formatTimeRemaining(milliseconds) {
  const hours = Math.floor(milliseconds / (1000 * 60 * 60));
  const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000);
  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

// Add the failure logging function
async function logFailure(type, details) {
  if (!currentUser) return;

  const playerRef = db.collection("players").doc(currentUser.uid);
  const failure = {
    type,
    details,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    penaltyExp: DAILY_QUEST_PENALTY.exp,
    penaltyGold: DAILY_QUEST_PENALTY.gold,
  };

  try {
    await playerRef.update({
      failures: firebase.firestore.FieldValue.arrayUnion(failure),
      exp: firebase.firestore.FieldValue.increment(-DAILY_QUEST_PENALTY.exp),
      gold: firebase.firestore.FieldValue.increment(-DAILY_QUEST_PENALTY.gold),
    });

    printToTerminal(`Failed: ${details}`, "error");
    printToTerminal(
      `Penalty: -${DAILY_QUEST_PENALTY.exp} EXP, -${DAILY_QUEST_PENALTY.gold} gold`,
      "error"
    );
    updateStatusBar();
  } catch (error) {
    console.error("Error logging failure:", error);
  }
}

// Add the showFailures command
async function showFailures() {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  const playerRef = db.collection("players").doc(currentUser.uid);
  const player = (await playerRef.get()).data();

  if (!player.failures || player.failures.length === 0) {
    printToTerminal("=== FAILURES LOG ===", "error");
    printToTerminal("No failures recorded.", "info");
    return;
  }

  printToTerminal("=== FAILURES LOG ===", "error");
  player.failures
    .slice()
    .reverse()
    .forEach((failure) => {
      const date = failure.timestamp?.toDate() || new Date();
      printToTerminal(
        `[${date.toLocaleDateString()} ${date.toLocaleTimeString()}]`,
        "system"
      );
      printToTerminal(`Type: ${failure.type}`, "error");
      printToTerminal(`Details: ${failure.details}`, "error");
      printToTerminal(
        `Penalty: -${failure.penaltyExp} EXP, -${failure.penaltyGold} gold`,
        "error"
      );
      printToTerminal("---", "system");
    });
}

// Add timer check interval
let timerInterval;

function startDailyQuestTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
  }

  timerInterval = setInterval(async () => {
    const now = new Date();
    const endOfDay = getEndOfDay();

    if (now >= endOfDay) {
      // Check for incomplete daily quests
      if (!currentUser) return;

      const dailyQuestsRef = db
        .collection("players")
        .doc(currentUser.uid)
        .collection("dailyQuests");

      const snapshot = await dailyQuestsRef.get();
      snapshot.forEach(async (doc) => {
        const quest = doc.data();
        if (!quest.completed) {
          await logFailure(
            "daily_quest",
            `Failed to complete daily quest: ${quest.title}`
          );
        }
      });

      // Reset timer for next day
      setTimeout(startDailyQuestTimer, 1000);
    }
  }, 1000);
}

// Add this function before completeQuest
async function addExperiencePoints(args) {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  if (!args || args.length === 0) {
    printToTerminal("Usage: !addxp <amount>", "warning");
    printToTerminal("Example: !addxp 50 - Adds 50 XP", "info");
    return;
  }

  const amount = parseInt(args[0]);
  if (isNaN(amount) || amount <= 0) {
    printToTerminal("Please specify a valid positive number", "error");
    return;
  }

  try {
    const playerRef = db.collection("players").doc(currentUser.uid);
    const player = (await playerRef.get()).data();

    // Calculate new total exp and check for level up
    const newTotalExp = player.exp + amount;
    const expNeeded = 100;
    const levelsToGain = Math.floor(newTotalExp / expNeeded);
    const remainingExp = newTotalExp % expNeeded;

    if (levelsToGain > 0) {
      // Level up case
      await playerRef.update({
        level: firebase.firestore.FieldValue.increment(levelsToGain),
        exp: remainingExp,
      });

      // Update local stats
      playerStats.level += levelsToGain;
      playerStats.exp = remainingExp;

      printToTerminal(`Added ${amount} XP!`, "success");
      printToTerminal(
        `🎉 LEVEL UP! You gained ${levelsToGain} level${
          levelsToGain > 1 ? "s" : ""
        }!`,
        "success"
      );
      printToTerminal(`You are now level ${playerStats.level}!`, "success");
      showNotification(`Level Up! You are now level ${playerStats.level}! 🎉`);
    } else {
      // Just add XP case
      await playerRef.update({
        exp: firebase.firestore.FieldValue.increment(amount),
      });

      // Update local stats
      playerStats.exp += amount;
      printToTerminal(
        `Added ${amount} XP! (${playerStats.exp}/100)`,
        "success"
      );
    }

    updateStatusBar();
  } catch (error) {
    printToTerminal("Error adding XP: " + error.message, "error");
    console.error("Add XP error:", error);
  }
}

// Add this after the command handler
let awaitingResetConfirmation = false;

async function handleReset(args) {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  const confirmationPhrase = "Reset the dungeon";
  const userInput = args.join(" ");

  if (!awaitingResetConfirmation) {
    printToTerminal("⚠️ WARNING: This will reset your progress!", "warning");
    printToTerminal(
      "Resetting: Level, EXP, Gold, Rank, Achievements, Streak, Title, Class, Water, Inventory, Items, Bosses, Quests.",
      "warning"
    );
    printToTerminal(`\nTo confirm, type "${confirmationPhrase}"`, "warning");

    awaitingResetConfirmation = true;
    return;
  }

  if (userInput === confirmationPhrase) {
    try {
      const playerRef = db.collection("players").doc(currentUser.uid);

      // Reset level, exp, gold, rank, achievements, streak, and quests count
      await playerRef.update({
        inventory: [],
        title: "Novice",
        class: "Hunter",
        level: 1,
        exp: 0,
        gold: 0,
        rank: "E",
        achievements: [],
        streak: 0,
        waterIntake: 0,
        questsCompleted: 0,
        workoutStreak: {
          current: 0,
          lastWorkout: null,
          totalWorkouts: 0,
          xpMultiplier: 1.0,
        },
      });

      // Update local stats
      playerStats.level = 1;
      playerStats.exp = 0;
      playerStats.gold = 0;
      playerStats.rank = "E";
      playerStats.achievements = [];
      playerStats.streak = 0;
      playerStats.questsCompleted = 0;
      playerStats.workoutStreak = {
        current: 0,
        lastWorkout: null,
        totalWorkouts: 0,
        xpMultiplier: 1.0,
      };

      // Update UI
      updateStatusBar();
      windowSystem.updateWindowContent("achievementsWindow");
      windowSystem.updateWindowContent("profileWindow");
      windowSystem.updateWindowContent("questsWindow");
      windowSystem.updateWindowContent("dailyQuestsWindow");

      printToTerminal("Progress has been reset!", "success");
      printToTerminal("Level reset to 1", "info");
      printToTerminal("Experience reset to 0", "info");
      printToTerminal("Gold reset to 0", "info");
      printToTerminal("Rank reset to E", "info");
      printToTerminal("Achievements progress reset", "info");
      printToTerminal("Workout streak reset to 0", "info");
      printToTerminal("Completed quests count reset to 0", "info");
      showNotification("Progress has been reset!");
    } catch (error) {
      printToTerminal("Error resetting progress: " + error.message, "error");
      console.error("Reset error:", error);
    }
  } else {
    printToTerminal(
      `Please type "${confirmationPhrase}" exactly to confirm reset`,
      "warning"
    );
  }

  // Always reset the confirmation flag after handling
  awaitingResetConfirmation = false;
}

// Boss Battle definitions
const BOSSES = {
  SHADOW_KING: {
    id: "shadow_king",
    name: "Shadow King",
    description:
      "Train in the darkness to unlock your hidden strength. Complete 60 minutes of night training (after 8 PM).",
    baseTargetCount: 60,
    targetCount: 60,
    metric: "minutes",
    timeLimit: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
    rewards: {
      exp: 500,
      gold: 250,
      title: "Ruler of Shadows",
    },
    scaling: {
      targetCount: 5, // Increase by 5 minutes per defeat
      rewards: {
        exp: 75,
        gold: 35,
      },
    },
  },

  MONARCH_OF_FLESH: {
    id: "monarch_of_flesh",
    name: "Monarch of Flesh",
    description:
      "Push your body to its limit. Complete 150 push-ups within 24 hours.",
    baseTargetCount: 150,
    targetCount: 150,
    metric: "push-ups",
    timeLimit: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
    rewards: {
      exp: 600,
      gold: 300,
      title: "Body of a Warrior",
    },
    scaling: {
      targetCount: 10, // Increase by 10 push-ups per defeat
      rewards: {
        exp: 100,
        gold: 50,
      },
    },
  },

  IRON_FIST: {
    id: "iron_fist",
    name: "Iron Fist",
    description:
      "Forge your fists in fire. Complete 200 push-ups in a single session.",
    baseTargetCount: 200,
    targetCount: 200,
    metric: "push-ups",
    timeLimit: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
    rewards: {
      exp: 800,
      gold: 400,
      title: "Unbreakable Fist",
    },
    scaling: {
      targetCount: 20, // Increase by 20 push-ups per defeat
      rewards: {
        exp: 100,
        gold: 50,
      },
    },
  },

  CORE_OVERLORD: {
    id: "core_overlord",
    name: "Core Overlord",
    description:
      "Dominate your core. Complete 300 sit-ups in a single session.",
    baseTargetCount: 300,
    targetCount: 300,
    metric: "sit-ups",
    timeLimit: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
    rewards: {
      exp: 900,
      gold: 450,
      title: "Master of the Core",
    },
    scaling: {
      targetCount: 30, // Increase by 30 sit-ups per defeat
      rewards: {
        exp: 100,
        gold: 50,
      },
    },
  },

  PUSHUP_WARLORD: {
    id: "pushup_warlord",
    name: "Push-Up Warlord",
    description:
      "Conquer the ultimate push-up challenge. Complete 100 push-ups in 10 minutes.",
    baseTargetCount: 100,
    targetCount: 100,
    metric: "push-ups",
    timeLimit: 10 * 60 * 1000, // 10 minutes in milliseconds
    rewards: {
      exp: 700,
      gold: 350,
      title: "Push-Up Champion",
    },
    scaling: {
      targetCount: 10, // Increase by 10 push-ups per defeat
      rewards: {
        exp: 75,
        gold: 35,
      },
    },
  },

  SITUP_SORCERER: {
    id: "situp_sorcerer",
    name: "Sit-Up Sorcerer",
    description:
      "Harness the magic of endurance. Complete 150 sit-ups in 15 minutes.",
    baseTargetCount: 150,
    targetCount: 150,
    metric: "sit-ups",
    timeLimit: 15 * 60 * 1000, // 15 minutes in milliseconds
    rewards: {
      exp: 750,
      gold: 375,
      title: "Core Mage",
    },
    scaling: {
      targetCount: 15, // Increase by 15 sit-ups per defeat
      rewards: {
        exp: 75,
        gold: 35,
      },
    },
  },

  PUSHUP_TITAN: {
    id: "pushup_titan",
    name: "Push-Up Titan",
    description: "Prove your might. Complete 500 push-ups in a week.",
    baseTargetCount: 500,
    targetCount: 500,
    metric: "push-ups",
    timeLimit: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    rewards: {
      exp: 1000,
      gold: 500,
      title: "Titan of Push-Ups",
    },
    scaling: {
      targetCount: 50, // Increase by 50 push-ups per defeat
      rewards: {
        exp: 150,
        gold: 75,
      },
    },
  },

  SITUP_SENTINEL: {
    id: "situp_sentinel",
    name: "Sit-Up Sentinel",
    description: "Guard your core. Complete 1,000 sit-ups in a week.",
    baseTargetCount: 1000,
    targetCount: 1000,
    metric: "sit-ups",
    timeLimit: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    rewards: {
      exp: 1200,
      gold: 600,
      title: "Core Sentinel",
    },
    scaling: {
      targetCount: 100, // Increase by 100 sit-ups per defeat
      rewards: {
        exp: 150,
        gold: 75,
      },
    },
  },

  PUSHUP_PHANTOM: {
    id: "pushup_phantom",
    name: "Push-Up Phantom",
    description: "Move like a shadow. Complete 50 push-ups in 5 minutes.",
    baseTargetCount: 50,
    targetCount: 50,
    metric: "push-ups",
    timeLimit: 5 * 60 * 1000, // 5 minutes in milliseconds
    rewards: {
      exp: 600,
      gold: 300,
      title: "Shadow Pusher",
    },
    scaling: {
      targetCount: 5, // Increase by 5 push-ups per defeat
      rewards: {
        exp: 50,
        gold: 25,
      },
    },
  },

  SITUP_SPECTER: {
    id: "situp_specter",
    name: "Sit-Up Specter",
    description: "Haunt your core. Complete 75 sit-ups in 7 minutes.",
    baseTargetCount: 75,
    targetCount: 75,
    metric: "sit-ups",
    timeLimit: 7 * 60 * 1000, // 7 minutes in milliseconds
    rewards: {
      exp: 650,
      gold: 325,
      title: "Ghost of the Core",
    },
    scaling: {
      targetCount: 7, // Increase by 7 sit-ups per defeat
      rewards: {
        exp: 50,
        gold: 25,
      },
    },
  },

  PUSHUP_DRAGON: {
    id: "pushup_dragon",
    name: "Push-Up Dragon",
    description:
      "Breathe fire into your arms. Complete 300 push-ups in 30 minutes.",
    baseTargetCount: 300,
    targetCount: 300,
    metric: "push-ups",
    timeLimit: 30 * 60 * 1000, // 30 minutes in milliseconds
    rewards: {
      exp: 900,
      gold: 450,
      title: "Dragon of Strength",
    },
    scaling: {
      targetCount: 30, // Increase by 30 push-ups per defeat
      rewards: {
        exp: 100,
        gold: 50,
      },
    },
  },

  SITUP_SERPENT: {
    id: "situp_serpent",
    name: "Sit-Up Serpent",
    description: "Coil your core. Complete 200 sit-ups in 20 minutes.",
    baseTargetCount: 200,
    targetCount: 200,
    metric: "sit-ups",
    timeLimit: 20 * 60 * 1000, // 20 minutes in milliseconds
    rewards: {
      exp: 800,
      gold: 400,
      title: "Serpent of the Core",
    },
    scaling: {
      targetCount: 20, // Increase by 20 sit-ups per defeat
      rewards: {
        exp: 100,
        gold: 50,
      },
    },
  },

  GATE_KEEPER: {
    id: "gate_keeper",
    name: "Gate Keeper",
    description:
      "Pass through the threshold of strength. Run 5 kilometers in a single session.",
    baseTargetCount: 5,
    targetCount: 5,
    metric: "kilometers",
    timeLimit: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
    rewards: {
      exp: 700,
      gold: 350,
      title: "Breaker of Chains",
    },
    scaling: {
      targetCount: 0.5, // Increase by 0.5 km per defeat
      rewards: {
        exp: 100,
        gold: 50,
      },
    },
  },

  RULER_OF_STAMINA: {
    id: "ruler_of_stamina",
    name: "Ruler of Stamina",
    description:
      "Survive the test of endurance. Burn 2,000 calories in a week.",
    baseTargetCount: 2000,
    targetCount: 2000,
    metric: "calories",
    timeLimit: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    rewards: {
      exp: 800,
      gold: 400,
      title: "Everlasting Hunter",
    },
    scaling: {
      targetCount: 200, // Increase by 200 calories per defeat
      rewards: {
        exp: 100,
        gold: 50,
      },
    },
  },

  TITAN_SLAYER: {
    id: "titan_slayer",
    name: "Titan Slayer",
    description:
      "Overcome the mightiest. Lift a total of 5,000 kg in weight training.",
    baseTargetCount: 5000,
    targetCount: 5000,
    metric: "kilograms lifted",
    timeLimit: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    rewards: {
      exp: 1000,
      gold: 500,
      title: "Crusher of Giants",
    },
    scaling: {
      targetCount: 500, // Increase by 500 kg per defeat
      rewards: {
        exp: 150,
        gold: 75,
      },
    },
  },
  PHANTOM_RUNNER: {
    id: "phantom_runner",
    name: "Phantom Runner",
    description: "Outpace the unseen. Run 10 kilometers in under 60 minutes.",
    baseTargetCount: 10,
    targetCount: 10,
    metric: "kilometers",
    timeLimit: 60 * 60 * 1000, // 60 minutes in milliseconds
    rewards: {
      exp: 750,
      gold: 375,
      title: "Speed Demon",
    },
    scaling: {
      targetCount: 1, // Increase by 1 km per defeat
      rewards: {
        exp: 100,
        gold: 50,
      },
    },
  },

  IRON_WILL: {
    id: "iron_will",
    name: "Iron Will",
    description: "Forge your mind and body. Hold a plank for 5 minutes.",
    baseTargetCount: 5,
    targetCount: 5,
    metric: "minutes",
    timeLimit: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
    rewards: {
      exp: 400,
      gold: 200,
      title: "Unbreakable",
    },
    scaling: {
      targetCount: 0.5, // Increase by 0.5 minutes per defeat
      rewards: {
        exp: 50,
        gold: 25,
      },
    },
  },

  STORM_CALLER: {
    id: "storm_caller",
    name: "Storm Caller",
    description: "Summon the storm within. Complete 100 burpees in 20 minutes.",
    baseTargetCount: 100,
    targetCount: 100,
    metric: "burpees",
    timeLimit: 20 * 60 * 1000, // 20 minutes in milliseconds
    rewards: {
      exp: 600,
      gold: 300,
      title: "Thunder Lord",
    },
    scaling: {
      targetCount: 10, // Increase by 10 burpees per defeat
      rewards: {
        exp: 75,
        gold: 35,
      },
    },
  },

  ABYSS_WALKER: {
    id: "abyss_walker",
    name: "Abyss Walker",
    description:
      "Descend into the depths. Perform 50 pull-ups in a single session.",
    baseTargetCount: 50,
    targetCount: 50,
    metric: "pull-ups",
    timeLimit: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
    rewards: {
      exp: 700,
      gold: 350,
      title: "Void Strider",
    },
    scaling: {
      targetCount: 5, // Increase by 5 pull-ups per defeat
      rewards: {
        exp: 100,
        gold: 50,
      },
    },
  },

  FLAME_EMPEROR: {
    id: "flame_emperor",
    name: "Flame Emperor",
    description:
      "Burn with intensity. Complete 30 minutes of high-intensity interval training (HIIT).",
    baseTargetCount: 30,
    targetCount: 30,
    metric: "minutes",
    timeLimit: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
    rewards: {
      exp: 550,
      gold: 275,
      title: "Inferno Lord",
    },
    scaling: {
      targetCount: 2, // Increase by 2 minutes per defeat
      rewards: {
        exp: 75,
        gold: 35,
      },
    },
  },

  FROST_GIANT: {
    id: "frost_giant",
    name: "Frost Giant",
    description: "Endure the cold. Swim 1 kilometer in open water or a pool.",
    baseTargetCount: 1,
    targetCount: 1,
    metric: "kilometers",
    timeLimit: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
    rewards: {
      exp: 650,
      gold: 325,
      title: "Ice Breaker",
    },
    scaling: {
      targetCount: 0.2, // Increase by 0.2 km per defeat
      rewards: {
        exp: 75,
        gold: 35,
      },
    },
  },

  EARTH_SHAKER: {
    id: "earth_shaker",
    name: "Earth Shaker",
    description:
      "Shake the ground beneath you. Perform 200 squats in a single session.",
    baseTargetCount: 200,
    targetCount: 200,
    metric: "squats",
    timeLimit: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
    rewards: {
      exp: 800,
      gold: 400,
      title: "Titan of Strength",
    },
    scaling: {
      targetCount: 20, // Increase by 20 squats per defeat
      rewards: {
        exp: 100,
        gold: 50,
      },
    },
  },

  WIND_RIDER: {
    id: "wind_rider",
    name: "Wind Rider",
    description:
      "Ride the winds of speed. Cycle 20 kilometers in a single session.",
    baseTargetCount: 20,
    targetCount: 20,
    metric: "kilometers",
    timeLimit: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
    rewards: {
      exp: 700,
      gold: 350,
      title: "Gale Force",
    },
    scaling: {
      targetCount: 2, // Increase by 2 km per defeat
      rewards: {
        exp: 100,
        gold: 50,
      },
    },
  },

  VOID_SEEKER: {
    id: "void_seeker",
    name: "Void Seeker",
    description: "Seek the unknown. Meditate for 30 minutes daily for 7 days.",
    baseTargetCount: 7,
    targetCount: 7,
    metric: "days",
    timeLimit: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    rewards: {
      exp: 900,
      gold: 450,
      title: "Mind of the Void",
    },
    scaling: {
      targetCount: 1, // Increase by 1 day per defeat
      rewards: {
        exp: 100,
        gold: 50,
      },
    },
  },

  BLAZE_ARCHER: {
    id: "blaze_archer",
    name: "Blaze Archer",
    description:
      "Strike with precision. Complete 100 archery shots or similar precision training.",
    baseTargetCount: 100,
    targetCount: 100,
    metric: "shots",
    timeLimit: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
    rewards: {
      exp: 600,
      gold: 300,
      title: "Eagle Eye",
    },
    scaling: {
      targetCount: 10, // Increase by 10 shots per defeat
      rewards: {
        exp: 75,
        gold: 35,
      },
    },
  },

  THUNDER_GOD: {
    id: "thunder_god",
    name: "Thunder God",
    description:
      "Channel the power of thunder. Perform 50 box jumps in 10 minutes.",
    baseTargetCount: 50,
    targetCount: 50,
    metric: "box jumps",
    timeLimit: 10 * 60 * 1000, // 10 minutes in milliseconds
    rewards: {
      exp: 650,
      gold: 325,
      title: "Storm Bringer",
    },
    scaling: {
      targetCount: 5, // Increase by 5 box jumps per defeat
      rewards: {
        exp: 75,
        gold: 35,
      },
    },
  },

  MOONLIGHT_ASSASSIN: {
    id: "moonlight_assassin",
    name: "Moonlight Assassin",
    description:
      "Move in silence. Complete 30 minutes of yoga or flexibility training.",
    baseTargetCount: 30,
    targetCount: 30,
    metric: "minutes",
    timeLimit: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
    rewards: {
      exp: 500,
      gold: 250,
      title: "Shadow Dancer",
    },
    scaling: {
      targetCount: 2, // Increase by 2 minutes per defeat
      rewards: {
        exp: 50,
        gold: 25,
      },
    },
  },

  STARGAZER: {
    id: "stargazer",
    name: "Stargazer",
    description:
      "Reach for the stars. Climb 500 meters on a climbing wall or rock face.",
    baseTargetCount: 500,
    targetCount: 500,
    metric: "meters climbed",
    timeLimit: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
    rewards: {
      exp: 800,
      gold: 400,
      title: "Celestial Climber",
    },
    scaling: {
      targetCount: 50, // Increase by 50 meters per defeat
      rewards: {
        exp: 100,
        gold: 50,
      },
    },
  },
  DRAGON_TAMER: {
    id: "dragon_tamer",
    name: "Dragon Tamer",
    description:
      "Tame the beast within. Complete 3 consecutive days of intense training.",
    baseTargetCount: 3,
    targetCount: 3,
    metric: "days",
    timeLimit: 3 * 24 * 60 * 60 * 1000, // 3 days in milliseconds
    rewards: {
      exp: 1000,
      gold: 500,
      title: "Beast Master",
    },
    scaling: {
      targetCount: 1, // Increase by 1 day per defeat
      rewards: {
        exp: 150,
        gold: 75,
      },
    },
  },
  ETERNAL_GUARDIAN: {
    id: "eternal_guardian",
    name: "Eternal Guardian",
    description: "Protect the realm. Complete 10,000 steps in a single day.",
    baseTargetCount: 10000,
    targetCount: 10000,
    metric: "steps",
    timeLimit: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
    rewards: {
      exp: 700,
      gold: 350,
      title: "Guardian of Eternity",
    },
    scaling: {
      targetCount: 500, // Increase by 500 steps per defeat
      rewards: {
        exp: 75,
        gold: 35,
      },
    },
  },
};

// Boss Battle System Functions
async function showBossBattles() {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  printToTerminal("=== AVAILABLE BOSS BATTLES ===", "system");
  Object.values(BOSSES).forEach((boss) => {
    printToTerminal(`\n[${boss.name}]`, "quest");
    printToTerminal(`Description: ${boss.description}`, "info");
    printToTerminal(`Target: ${boss.targetCount} ${boss.metric}`, "info");
    printToTerminal(`Time Limit: ${formatTimeLimit(boss.timeLimit)}`, "info");
    printToTerminal("\nRewards:", "reward");
    printToTerminal(`- ${boss.rewards.exp} EXP`, "reward");
    printToTerminal(`- ${boss.rewards.gold} Gold`, "reward");
    printToTerminal(`- Title: ${boss.rewards.title}`, "reward");
    printToTerminal(`\nTo start: !challenge ${boss.id}`, "info");
    printToTerminal("---", "system");
  });
}

async function startBossBattle(args) {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  if (!args || args.length === 0) {
    printToTerminal("Usage: !challenge <boss_id>", "warning");
    printToTerminal("Use !battle to see available bosses", "info");
    return;
  }

  const bossId = args[0].toLowerCase();
  const boss = Object.values(BOSSES).find((b) => b.id === bossId);
  if (!boss) {
    printToTerminal("Invalid boss battle ID.", "error");
    return;
  }

  try {
    const playerRef = db.collection("players").doc(currentUser.uid);
    const player = (await playerRef.get()).data();
    const defeatCount = player.defeatedBosses?.[bossId] || 0;

    // Calculate scaled target and rewards
    const scaledTarget =
      boss.baseTargetCount + defeatCount * boss.scaling.targetCount;
    const scaledExp = boss.rewards.exp + defeatCount * boss.scaling.rewards.exp;
    const scaledGold =
      boss.rewards.gold + defeatCount * boss.scaling.rewards.gold;

    // Start the battle
    const now = new Date();
    const endTime = new Date(now.getTime() + boss.timeLimit);

    await playerRef
      .collection("activeBattles")
      .doc(bossId)
      .set({
        bossId,
        bossName: boss.name,
        currentCount: 0,
        targetCount: scaledTarget,
        startTime: firebase.firestore.Timestamp.fromDate(now),
        endTime: firebase.firestore.Timestamp.fromDate(endTime),
        completed: false,
      });

    printToTerminal(`\n🗡️ Boss Battle Started: ${boss.name}`, "success");
    printToTerminal(`Target: ${scaledTarget} ${boss.metric}`, "info");
    printToTerminal(`Time Limit: ${formatTimeLimit(boss.timeLimit)}`, "info");
    printToTerminal(`\nRewards if victorious:`, "reward");
    printToTerminal(`- ${scaledExp} XP`, "reward");
    printToTerminal(`- ${scaledGold} Gold`, "reward");
    printToTerminal(`- Title: ${boss.rewards.title}`, "reward");

    windowSystem.updateWindowContent("BattleWindow");
  } catch (error) {
    printToTerminal("Error starting boss battle: " + error.message, "error");
  }
}

async function updateBattleProgress(args) {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  if (!args || args.length < 2) {
    printToTerminal("Usage: !progress <boss_id> <amount>", "warning");
    printToTerminal("Example: !progress step_master 1000", "info");
    return;
  }

  const [bossId, amount] = args;
  const boss = Object.values(BOSSES).find((b) => b.id === bossId);
  if (!boss) {
    printToTerminal("Invalid boss battle ID.", "error");
    return;
  }

  try {
    const playerRef = db.collection("players").doc(currentUser.uid);
    const activeBattleRef = playerRef.collection("activeBattles").doc(bossId);
    const activeBattle = await activeBattleRef.get();

    if (!activeBattle.exists) {
      printToTerminal("You haven't started this boss battle yet!", "error");
      printToTerminal(`Use !challenge ${bossId} to start`, "info");
      return;
    }

    const battle = activeBattle.data();
    const now = new Date();
    const endTime = battle.endTime.toDate();

    if (now > endTime) {
      await handleBossBattleTimeout(playerRef, bossId, battle);
      return;
    }

    const newCount =
      amount === "complete" ? battle.targetCount : parseInt(amount);
    if (isNaN(newCount)) {
      printToTerminal("Please provide a valid number.", "error");
      return;
    }

    if (newCount >= battle.targetCount && !battle.completed) {
      // Boss defeated!
      const player = (await playerRef.get()).data();
      const defeatCount = player.defeatedBosses?.[bossId] || 0;

      // Calculate scaled rewards
      const scaledExp =
        boss.rewards.exp + defeatCount * boss.scaling.rewards.exp;
      const scaledGold =
        boss.rewards.gold + defeatCount * boss.scaling.rewards.gold;

      // Update defeat count
      const defeatedBossesUpdate = {
        [`defeatedBosses.${bossId}`]:
          firebase.firestore.FieldValue.increment(1),
      };

      // Award rewards
      await playerRef.update({
        exp: firebase.firestore.FieldValue.increment(scaledExp),
        gold: firebase.firestore.FieldValue.increment(scaledGold),
        "profile.title": boss.rewards.title,
        ...defeatedBossesUpdate,
      });

      // Update local stats
      playerStats.exp += scaledExp;
      playerStats.gold += scaledGold;
      playerStats.profile.title = boss.rewards.title;
      if (!playerStats.defeatedBosses) playerStats.defeatedBosses = {};
      playerStats.defeatedBosses[bossId] =
        (playerStats.defeatedBosses[bossId] || 0) + 1;

      // Delete completed battle
      await activeBattleRef.delete();

      printToTerminal(`\n🎉 BOSS DEFEATED: ${boss.name}! 🎉`, "success");
      printToTerminal(`This was defeat #${defeatCount + 1}!`, "success");
      printToTerminal(`Rewards earned:`, "reward");
      printToTerminal(`- ${scaledExp} XP`, "reward");
      printToTerminal(`- ${scaledGold} Gold`, "reward");
      printToTerminal(`- New Title: ${boss.rewards.title}`, "reward");
      printToTerminal(`\nNext time the boss will be stronger:`, "info");
      printToTerminal(
        `- Target: +${boss.scaling.targetCount} ${boss.metric}`,
        "info"
      );
      printToTerminal(
        `- Rewards: +${boss.scaling.rewards.exp} XP, +${boss.scaling.rewards.gold} Gold`,
        "info"
      );
    } else {
      // Update progress
      await activeBattleRef.update({
        currentCount: newCount,
      });
    }

    // Check for level up and achievements
    await checkLevelUp(playerRef, playerStats.exp);
    await checkAchievements();
    updateStatusBar();
    windowSystem.updateWindowContent("BattleWindow");
  } catch (error) {
    printToTerminal(
      "Error updating battle progress: " + error.message,
      "error"
    );
  }
}

function formatTimeLimit(milliseconds) {
  const days = Math.floor(milliseconds / (1000 * 60 * 60 * 24));
  const hours = Math.floor(
    (milliseconds % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
  );

  if (days > 0) {
    return `${days} day${days > 1 ? "s" : ""}`;
  } else {
    return `${hours} hour${hours > 1 ? "s" : ""}`;
  }
}

// Add water intake constants
const WATER_INTAKE = {
  DAILY_GOAL: 14, // glasses per day
  GLASS_ML: 250, // ml per glass
  ENCOURAGEMENTS: [
    { threshold: 0.25, message: "Great start! Keep going! 💧" },
    {
      threshold: 0.5,
      message: "Halfway there! Your body thanks you! 💪",
    },
    {
      threshold: 0.75,
      message: "Almost there! You're doing amazing! 🌊",
    },
    {
      threshold: 1,
      message: "Daily goal achieved! You're a hydration champion! 🏆",
    },
  ],
  REWARDS: {
    exp: 50, // EXP reward for reaching daily goal
    gold: 25, // Gold reward for reaching daily goal
  },
};

// Water intake tracking functions
async function handleWaterIntake(args) {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  // Check if we need to reset daily progress
  await checkWaterIntakeReset();

  const glasses = args && args.length > 0 ? parseInt(args[0]) : 1;

  if (isNaN(glasses) || glasses <= 0) {
    printToTerminal("Please enter a valid number of glasses.", "error");
    return;
  }

  try {
    const playerRef = db.collection("players").doc(currentUser.uid);
    const player = (await playerRef.get()).data();
    const currentIntake = player.waterIntake?.current || 0;
    const newIntake = Math.min(
      currentIntake + glasses,
      WATER_INTAKE.DAILY_GOAL
    );
    const wasGoalReached =
      currentIntake < WATER_INTAKE.DAILY_GOAL &&
      newIntake >= WATER_INTAKE.DAILY_GOAL;

    // Update water intake
    await playerRef.update({
      "waterIntake.current": newIntake,
      "waterIntake.lastReset":
        player.waterIntake?.lastReset ||
        firebase.firestore.FieldValue.serverTimestamp(),
    });

    // Update local stats
    playerStats.waterIntake.current = newIntake;

    // Show progress
    const progressPercentage = newIntake / WATER_INTAKE.DAILY_GOAL;
    printToTerminal(
      `Added ${glasses} glass${glasses > 1 ? "es" : ""} of water!`,
      "success"
    );
    printToTerminal(
      `Current Water Intake: ${newIntake}/${WATER_INTAKE.DAILY_GOAL} glasses`,
      "info"
    );
    printToTerminal(
      `Total: ${newIntake * WATER_INTAKE.GLASS_ML}ml / ${
        WATER_INTAKE.DAILY_GOAL * WATER_INTAKE.GLASS_ML
      }ml`,
      "info"
    );

    // Show encouragement message
    for (let i = WATER_INTAKE.ENCOURAGEMENTS.length - 1; i >= 0; i--) {
      if (progressPercentage >= WATER_INTAKE.ENCOURAGEMENTS[i].threshold) {
        printToTerminal(WATER_INTAKE.ENCOURAGEMENTS[i].message, "system");
        break;
      }
    }

    // Award rewards if daily goal is reached
    if (wasGoalReached) {
      await playerRef.update({
        exp: firebase.firestore.FieldValue.increment(WATER_INTAKE.REWARDS.exp),
        gold: firebase.firestore.FieldValue.increment(
          WATER_INTAKE.REWARDS.gold
        ),
        "waterIntake.streakDays": firebase.firestore.FieldValue.increment(1),
      });

      // Update local stats
      playerStats.exp += WATER_INTAKE.REWARDS.exp;
      playerStats.gold += WATER_INTAKE.REWARDS.gold;
      playerStats.waterIntake.streakDays++;

      printToTerminal("\n🎉 Daily Water Goal Achieved! 🎉", "success");
      printToTerminal(`Rewards:`, "reward");
      printToTerminal(`- ${WATER_INTAKE.REWARDS.exp} EXP`, "reward");
      printToTerminal(`- ${WATER_INTAKE.REWARDS.gold} Gold`, "reward");
      printToTerminal(
        `Water Streak: ${playerStats.waterIntake.streakDays} days`,
        "info"
      );

      // Check for level up and achievements
      await checkLevelUp(playerRef, playerStats.exp);
      await checkAchievements();
      updateStatusBar();
    }

    showNotification(
      `Water intake updated: ${newIntake}/${WATER_INTAKE.DAILY_GOAL} glasses`
    );
  } catch (error) {
    printToTerminal("Error updating water intake: " + error.message, "error");
  }
}

async function showWaterStatus() {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  await checkWaterIntakeReset();

  try {
    const playerRef = db.collection("players").doc(currentUser.uid);
    const player = (await playerRef.get()).data();
    const currentIntake = player.waterIntake?.current || 0;
    const streakDays = player.waterIntake?.streakDays || 0;

    printToTerminal("=== WATER INTAKE STATUS ===", "system");
    printToTerminal(
      `Current Progress: ${currentIntake}/${WATER_INTAKE.DAILY_GOAL} glasses`,
      "info"
    );
    printToTerminal(
      `Total: ${currentIntake * WATER_INTAKE.GLASS_ML}ml / ${
        WATER_INTAKE.DAILY_GOAL * WATER_INTAKE.GLASS_ML
      }ml`,
      "info"
    );
    printToTerminal(`Streak: ${streakDays} days`, "info");

    const remaining = WATER_INTAKE.DAILY_GOAL - currentIntake;
    if (remaining > 0) {
      printToTerminal(
        `\nRemaining: ${remaining} glass${
          remaining > 1 ? "es" : ""
        } to reach your daily goal`,
        "warning"
      );
      const endOfDay = getEndOfDay();
      const timeRemaining = endOfDay - new Date();
      printToTerminal(
        `Time remaining: ${formatTimeRemaining(timeRemaining)}`,
        "warning"
      );
    } else {
      printToTerminal("\nDaily goal achieved! 🎉", "success");
    }
  } catch (error) {
    printToTerminal("Error showing water status: " + error.message, "error");
  }
}

async function checkWaterIntakeReset() {
  if (!currentUser) return;

  try {
    const playerRef = db.collection("players").doc(currentUser.uid);
    const player = (await playerRef.get()).data();
    const lastReset = player.waterIntake?.lastReset?.toDate() || new Date(0);
    const now = new Date();

    // Check if it's a new day
    if (
      lastReset.getDate() !== now.getDate() ||
      lastReset.getMonth() !== now.getMonth() ||
      lastReset.getYear() !== now.getYear()
    ) {
      // Check if we need to break the streak
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const wasYesterdayGoalMet =
        player.waterIntake?.current >= WATER_INTAKE.DAILY_GOAL;

      await playerRef.update({
        "waterIntake.current": 0,
        "waterIntake.lastReset":
          firebase.firestore.FieldValue.serverTimestamp(),
        "waterIntake.streakDays": wasYesterdayGoalMet
          ? player.waterIntake?.streakDays || 0
          : 0,
      });

      // Update local stats
      playerStats.waterIntake.current = 0;
      playerStats.waterIntake.streakDays = wasYesterdayGoalMet
        ? player.waterIntake?.streakDays || 0
        : 0;

      if (!wasYesterdayGoalMet && player.waterIntake?.streakDays > 0) {
        printToTerminal(
          "Water streak reset! Remember to drink water daily!",
          "warning"
        );
      }
    }
  } catch (error) {
    console.error("Error checking water intake reset:", error);
  }
}

// Add motivational quotes and tips system
const MOTIVATION = {
  FITNESS_TIPS: [
    "Remember to warm up before exercising to prevent injury.",
    "Staying hydrated improves physical performance by up to 25%.",
    "Getting enough sleep is crucial for muscle recovery.",
    "Mix cardio and strength training for optimal results.",
    "Proper form > Heavy weights. Quality over quantity.",
    "Take rest days to allow your body to recover and grow stronger.",
    "Consistency beats intensity. Make it a lifestyle.",
    "Track your progress to stay motivated and see how far you've come.",
  ],
  MILESTONE_MESSAGES: {
    LEVEL_UP: [
      "Breaking through limits! Your journey continues! 🚀",
      "Level up! New heights await you! ⭐",
      "You've grown stronger! Keep pushing forward! 💪",
    ],
    STREAK: [
      "Another day conquered! Your consistency is inspiring! 🔥",
      "Streak maintained! You're building something special! ⚡",
      "Unstoppable! Your dedication shows in your streak! 🌟",
    ],
    QUEST_COMPLETE: [
      "Quest complete! One step closer to greatness! 🎯",
      "Victory achieved! What's your next conquest! 🏆",
      "Challenge overcome! You're proving your worth! ⚔️",
    ],
  },
  QUOTES: [
    { text: "The obstacle is the way.", author: "Marcus Aurelius" },
    { text: "What you seek is seeking you.", author: "Rumi" },
    {
      text: "The journey of a thousand miles begins with one step.",
      author: "Lao Tzu",
    },
    {
      text: "Arise, hunter. Your path to strength awaits.",
      author: "System",
    },
    {
      text: "Every challenge is an opportunity for growth.",
      author: "System",
    },
  ],
};

// Motivation system functions
async function showMotivation() {
  try {
    const response = await fetch("https://stoic-quotes.com/api/quote");
    if (!response.ok) {
      throw new Error("Failed to fetch quote");
    }
    const data = await response.json();

    printToTerminal("\n=== DAILY MOTIVATION ===", "system");
    printToTerminal(`"${data.text}"`, "quest");
    printToTerminal(`- ${data.author}`, "info");
  } catch (error) {
    printToTerminal("Error fetching quote: " + error.message, "error");
    // Fallback to a default quote if API fails
    printToTerminal('"The obstacle is the way."', "quest");
    printToTerminal("- Marcus Aurelius", "info");
  }
}

function showFitnessTip() {
  const tip = getRandomItem(MOTIVATION.FITNESS_TIPS);
  printToTerminal("\n=== FITNESS TIP ===", "system");
  printToTerminal(tip, "info");
}

function getRandomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// Add these constants for workout system
const WORKOUT_SYSTEM = {
  STREAK_REWARDS: {
    3: { xpBoost: 1.1, message: "Day Streak! 🔥 (10% XP Boost)" },
    7: { xpBoost: 1.2, message: "7-Day Streak! 🌟 (20% XP Boost)" },
    14: { xpBoost: 1.3, message: "14-Day Streak! ⚡ (30% XP Boost)" },
    30: { xpBoost: 1.5, message: "30-Day Streak! 👑 (50% XP Boost)" },
  },
  STREAK_BREAK_PENALTY: {
    exp: 30,
    gold: 15,
  },
  BASE_WORKOUT_REWARD: {
    exp: 50,
    gold: 25,
  },
};

// Add workout streak functions
async function logWorkout(args) {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  const playerRef = db.collection("players").doc(currentUser.uid);
  const player = (await playerRef.get()).data();
  const now = new Date();
  const lastWorkout =
    player.workoutStreak?.lastWorkout?.toDate() || new Date(0);

  // Check if already worked out today
  if (
    lastWorkout.getDate() === now.getDate() &&
    lastWorkout.getMonth() === now.getMonth() &&
    lastWorkout.getYear() === now.getYear()
  ) {
    printToTerminal("You've already logged a workout today!", "warning");
    printToTerminal("Come back tomorrow to maintain your streak!", "info");
    return;
  }

  // Check if streak should continue or reset
  const daysSinceLastWorkout = Math.floor(
    (now - lastWorkout) / (1000 * 60 * 60 * 24)
  );
  let newStreak = player.workoutStreak?.current || 0;

  if (daysSinceLastWorkout <= 1) {
    // Maintain or increase streak
    newStreak++;
    const streakReward = getStreakReward(newStreak);
    if (streakReward) {
      printToTerminal(streakReward.message, "success");
    }
  } else if (daysSinceLastWorkout > 1 && player.workoutStreak?.current > 0) {
    // Break streak
    const oldStreak = player.workoutStreak.current;
    newStreak = 1;
    printToTerminal(
      `Streak broken! You had a ${oldStreak}-day streak.`,
      "error"
    );
    await handleStreakBreak(playerRef);
  } else {
    // First workout or starting new streak
    newStreak = 1;
    printToTerminal("Starting a new workout streak! 💪", "success");
  }

  // Calculate rewards with streak multiplier
  const multiplier = getXPMultiplier(newStreak);
  const expReward = Math.floor(
    WORKOUT_SYSTEM.BASE_WORKOUT_REWARD.exp * multiplier
  );
  const goldReward = WORKOUT_SYSTEM.BASE_WORKOUT_REWARD.gold;

  // Update player stats
  await playerRef.update({
    "workoutStreak.current": newStreak,
    "workoutStreak.lastWorkout":
      firebase.firestore.FieldValue.serverTimestamp(),
    "workoutStreak.totalWorkouts": firebase.firestore.FieldValue.increment(1),
    "workoutStreak.xpMultiplier": multiplier,
    exp: firebase.firestore.FieldValue.increment(expReward),
    gold: firebase.firestore.FieldValue.increment(goldReward),
  });

  // Update local stats
  playerStats.workoutStreak = {
    ...playerStats.workoutStreak,
    current: newStreak,
    lastWorkout: now,
    totalWorkouts: (playerStats.workoutStreak?.totalWorkouts || 0) + 1,
    xpMultiplier: multiplier,
  };
  playerStats.exp += expReward;
  playerStats.gold += goldReward;

  // Show workout logged message
  printToTerminal(`Workout logged successfully!`, "success");
  printToTerminal(`Current streak: ${newStreak} days`, "info");
  printToTerminal(
    `XP Multiplier: ${(multiplier * 100 - 100).toFixed(0)}% boost`,
    "info"
  );
  printToTerminal(`Rewards:`, "reward");
  printToTerminal(`- ${expReward} XP (with streak bonus)`, "reward");
  printToTerminal(`- ${goldReward} Gold`, "reward");

  // Check for level up and achievements
  await checkLevelUp(playerRef, playerStats.exp);
  await checkAchievements();
  updateStatusBar();
}

async function showWorkoutStreak() {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  const playerRef = db.collection("players").doc(currentUser.uid);
  const player = (await playerRef.get()).data();
  const streak = player.workoutStreak?.current || 0;
  const totalWorkouts = player.workoutStreak?.totalWorkouts || 0;
  const multiplier = player.workoutStreak?.xpMultiplier || 1;
  const lastWorkout = player.workoutStreak?.lastWorkout?.toDate();

  printToTerminal("\n=== WORKOUT STREAK STATUS ===", "system");
  printToTerminal(
    `Current Streak: ${streak} day${streak !== 1 ? "s" : ""}`,
    "info"
  );
  printToTerminal(`Total Workouts: ${totalWorkouts}`, "info");
  printToTerminal(
    `XP Multiplier: ${(multiplier * 100 - 100).toFixed(0)}% boost`,
    "info"
  );

  if (lastWorkout) {
    const now = new Date();
    const daysSince = Math.floor((now - lastWorkout) / (1000 * 60 * 60 * 24));
    if (daysSince === 0) {
      printToTerminal("✅ You've worked out today!", "success");
    } else {
      printToTerminal(
        `Last workout: ${daysSince} day${daysSince !== 1 ? "s" : ""} ago`,
        "warning"
      );
      if (daysSince === 1) {
        printToTerminal(
          "⚠️ Work out today to maintain your streak!",
          "warning"
        );
      }
    }
  }

  // Show next streak milestone
  const nextMilestone = getNextStreakMilestone(streak);
  if (nextMilestone) {
    const daysUntilMilestone = nextMilestone - streak;
    printToTerminal("\nNext Milestone:", "info");
    printToTerminal(
      `${nextMilestone} - ${WORKOUT_SYSTEM.STREAK_REWARDS[nextMilestone].message}`,
      "quest"
    );
    printToTerminal(
      `${daysUntilMilestone} day${daysUntilMilestone !== 1 ? "s" : ""} to go!`,
      "info"
    );
  }
}

// Helper functions for workout system
function getStreakReward(streak) {
  return WORKOUT_SYSTEM.STREAK_REWARDS[streak];
}

function getXPMultiplier(streak) {
  let multiplier = 1.0;
  for (const [days, reward] of Object.entries(WORKOUT_SYSTEM.STREAK_REWARDS)) {
    if (streak >= parseInt(days)) {
      multiplier = reward.xpBoost;
    }
  }
  return multiplier;
}

function getNextStreakMilestone(currentStreak) {
  const milestones = Object.keys(WORKOUT_SYSTEM.STREAK_REWARDS)
    .map(Number)
    .sort((a, b) => a - b);

  for (const milestone of milestones) {
    if (milestone > currentStreak) {
      return milestone;
    }
  }
  return null;
}

async function handleStreakBreak(playerRef) {
  const penalty = WORKOUT_SYSTEM.STREAK_BREAK_PENALTY;

  await playerRef.update({
    exp: firebase.firestore.FieldValue.increment(-penalty.exp),
    gold: firebase.firestore.FieldValue.increment(-penalty.gold),
  });

  // Update local stats
  playerStats.exp = Math.max(0, playerStats.exp - penalty.exp);
  playerStats.gold = Math.max(0, playerStats.gold - penalty.gold);

  printToTerminal("Streak Break Penalty:", "error");
  printToTerminal(`- ${penalty.exp} XP`, "error");
  printToTerminal(`- ${penalty.gold} Gold`, "error");
  updateStatusBar();
}

// Add fitness report constants
const FITNESS_REPORT = {
  DAILY_METRICS: {
    steps: 0,
    caloriesBurned: 0,
    workoutsCompleted: 0,
    waterGlasses: 0,
    xpEarned: 0,
    questsCompleted: 0,
  },
  WEEKLY_METRICS: {
    totalSteps: 0,
    totalCaloriesBurned: 0,
    totalWorkouts: 0,
    averageWaterIntake: 0,
    totalXPEarned: 0,
    totalQuestsCompleted: 0,
    streakMaintained: false,
    achievementsUnlocked: [],
  },
};

// Add fitness report functions
async function generateFitnessReport(args) {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  const reportType = args && args.length > 0 ? args[0].toLowerCase() : "daily";

  if (reportType !== "daily" && reportType !== "weekly") {
    printToTerminal("Usage: !report [daily/weekly]", "warning");
    printToTerminal(
      "Example: !report daily - Shows today's fitness report",
      "info"
    );
    printToTerminal(
      "Example: !report weekly - Shows this week's summary",
      "info"
    );
    return;
  }

  try {
    const playerRef = db.collection("players").doc(currentUser.uid);
    const player = (await playerRef.get()).data();
    const now = new Date();

    if (reportType === "daily") {
      await showDailyReport(player, now);
    } else {
      await showWeeklyReport(player, now);
    }
  } catch (error) {
    printToTerminal("Error generating report: " + error.message, "error");
  }
}

async function showDailyReport(player, date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  // Gather daily metrics
  const metrics = { ...FITNESS_REPORT.DAILY_METRICS };
  metrics.waterGlasses = player.waterIntake?.current || 0;
  metrics.workoutsCompleted =
    player.workoutStreak?.lastWorkout?.toDate() >= startOfDay ? 1 : 0;

  // Calculate daily XP earned
  const activityLogs = await getDailyActivityLogs(startOfDay);
  metrics.xpEarned = activityLogs.reduce(
    (total, log) => total + (log.xpEarned || 0),
    0
  );
  metrics.questsCompleted = activityLogs.filter(
    (log) => log.type === "quest_complete"
  ).length;

  // Display daily report
  printToTerminal("\n=== DAILY FITNESS REPORT ===", "system");
  printToTerminal(`Date: ${date.toLocaleDateString()}`, "info");
  printToTerminal("\nActivity Metrics:", "info");
  printToTerminal(`Steps: ${metrics.steps.toLocaleString()}`, "info");
  printToTerminal(`Calories Burned: ${metrics.caloriesBurned}`, "info");
  printToTerminal(`Workouts Completed: ${metrics.workoutsCompleted}`, "info");
  printToTerminal(
    `Water Intake: ${metrics.waterGlasses}/${WATER_INTAKE.DAILY_GOAL} glasses`,
    "info"
  );

  printToTerminal("\nProgress:", "info");
  printToTerminal(`XP Earned: ${metrics.xpEarned}`, "reward");
  printToTerminal(`Quests Completed: ${metrics.questsCompleted}`, "quest");

  if (player.workoutStreak?.current > 0) {
    printToTerminal(
      `Current Workout Streak: ${player.workoutStreak.current} days`,
      "success"
    );
  }

  // Show remaining goals
  printToTerminal("\nRemaining Goals:", "warning");
  if (metrics.waterGlasses < WATER_INTAKE.DAILY_GOAL) {
    printToTerminal(
      `- Drink ${
        WATER_INTAKE.DAILY_GOAL - metrics.waterGlasses
      } more glasses of water`,
      "warning"
    );
  }
  if (metrics.workoutsCompleted === 0) {
    printToTerminal("- Complete today's workout", "warning");
  }
}

async function showWeeklyReport(player, date) {
  const startOfWeek = new Date(date);
  startOfWeek.setDate(date.getDate() - date.getDay()); // Start from Sunday
  startOfWeek.setHours(0, 0, 0, 0);

  // Gather weekly metrics
  const metrics = { ...FITNESS_REPORT.WEEKLY_METRICS };

  // Get activity logs for the week
  const weeklyLogs = await getWeeklyActivityLogs(startOfWeek);
  metrics.totalXPEarned = weeklyLogs.reduce(
    (total, log) => total + (log.xpEarned || 0),
    0
  );
  metrics.totalQuestsCompleted = weeklyLogs.filter(
    (log) => log.type === "quest_complete"
  ).length;
  metrics.totalWorkouts = weeklyLogs.filter(
    (log) => log.type === "workout"
  ).length;
  metrics.averageWaterIntake = Math.round(
    weeklyLogs.reduce((total, log) => total + (log.waterIntake || 0), 0) / 7
  );

  // Display weekly report
  printToTerminal("\n=== WEEKLY FITNESS REPORT ===", "system");
  printToTerminal(`Week of ${startOfWeek.toLocaleDateString()}`, "info");

  printToTerminal("\nWeekly Summary:", "info");
  printToTerminal(
    `Total Steps: ${metrics.totalSteps.toLocaleString()}`,
    "info"
  );
  printToTerminal(
    `Total Calories Burned: ${metrics.totalCaloriesBurned}`,
    "info"
  );
  printToTerminal(`Workouts Completed: ${metrics.totalWorkouts}/7`, "info");
  printToTerminal(
    `Average Daily Water Intake: ${metrics.averageWaterIntake} glasses`,
    "info"
  );

  printToTerminal("\nAchievements:", "info");
  printToTerminal(`Total XP Earned: ${metrics.totalXPEarned}`, "reward");
  printToTerminal(`Quests Completed: ${metrics.totalQuestsCompleted}`, "quest");

  if (player.workoutStreak?.current >= 7) {
    printToTerminal(
      `🏆 Maintained workout streak for the entire week!`,
      "success"
    );
  }

  // Show weekly stats comparison
  const previousWeekLogs = await getWeeklyActivityLogs(
    new Date(startOfWeek.getTime() - 7 * 24 * 60 * 60 * 1000)
  );
  const previousXP = previousWeekLogs.reduce(
    (total, log) => total + (log.xpEarned || 0),
    0
  );
  const xpDifference = metrics.totalXPEarned - previousXP;

  printToTerminal("\nComparison to Last Week:", "info");
  printToTerminal(
    `XP Earned: ${xpDifference >= 0 ? "+" : ""}${xpDifference} XP`,
    xpDifference >= 0 ? "success" : "error"
  );
}

async function getDailyActivityLogs(startOfDay) {
  const endOfDay = new Date(startOfDay);
  endOfDay.setHours(23, 59, 59, 999);

  const logsRef = db
    .collection("players")
    .doc(currentUser.uid)
    .collection("activityLogs");
  const snapshot = await logsRef
    .where("timestamp", ">=", startOfDay)
    .where("timestamp", "<=", endOfDay)
    .get();

  return snapshot.docs.map((doc) => doc.data());
}

async function getWeeklyActivityLogs(startOfWeek) {
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  const logsRef = db
    .collection("players")
    .doc(currentUser.uid)
    .collection("activityLogs");
  const snapshot = await logsRef
    .where("timestamp", ">=", startOfWeek)
    .where("timestamp", "<=", endOfWeek)
    .get();

  return snapshot.docs.map((doc) => doc.data());
}

// Update logWorkout function to log activity
const originalLogWorkout = logWorkout;
logWorkout = async function (args) {
  await originalLogWorkout(args);

  // Log the workout activity
  const activityLogsRef = db
    .collection("players")
    .doc(currentUser.uid)
    .collection("activityLogs");
  await activityLogsRef.add({
    type: "workout",
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    xpEarned: WORKOUT_SYSTEM.BASE_WORKOUT_REWARD.exp,
  });
};

// Update handleWaterIntake to log activity
const originalHandleWaterIntake = handleWaterIntake;
handleWaterIntake = async function (args) {
  const beforeWater = playerStats.waterIntake?.current || 0;
  await originalHandleWaterIntake(args);
  const afterWater = playerStats.waterIntake?.current || 0;

  if (afterWater > beforeWater) {
    const activityLogsRef = db
      .collection("players")
      .doc(currentUser.uid)
      .collection("activityLogs");
    await activityLogsRef.add({
      type: "water_intake",
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      waterIntake: afterWater - beforeWater,
    });
  }
};

// Profile customization functions
async function setPlayerName(args) {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  if (args.length === 0) {
    printToTerminal("Please provide a name.", "error");
    return;
  }

  const name = args[0];
  const playerRef = db.collection("players").doc(currentUser.uid);

  try {
    await playerRef.update({
      "profile.name": name,
    });
    playerStats.profile.name = name;
    printToTerminal(`Name set to: ${name}`, "success");
    updateTerminalPrompt();
    if (windowSystem) {
      windowSystem.updateWindowContent("profileWindow");
    }
  } catch (error) {
    printToTerminal("Error setting name: " + error.message, "error");
  }
}

async function setPlayerTitle(args) {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  if (!args || args.length === 0) {
    // printToTerminal("Usage: !settitle <title>", "warning");
    // printToTerminal("Example: !settitle Shadow Monarch", "info");
    return;
  }

  const title = args.join(" ");
  if (title.length > 50) {
    printToTerminal("Title must be 50 characters or less.", "error");
    return;
  }

  try {
    const playerRef = db.collection("players").doc(currentUser.uid);
    await playerRef.update({
      "profile.title": title,
    });

    // Update local stats
    playerStats.profile.title = title;
    printToTerminal(`Title updated to: ${title}`, "success");
    showNotification("Title updated successfully!");
  } catch (error) {
    printToTerminal("Error updating title: " + error.message, "error");
  }
}

async function setPlayerBio(args) {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  if (!args || args.length === 0) {
    printToTerminal("Usage: !setbio <text>", "warning");
    printToTerminal("Example: !setbio A hunter who never gives up", "info");
    return;
  }

  const bio = args.join(" ");
  if (bio.length > 200) {
    printToTerminal("Bio must be 200 characters or less.", "error");
    return;
  }

  try {
    const playerRef = db.collection("players").doc(currentUser.uid);
    await playerRef.update({
      "profile.bio": bio,
    });

    // Update local stats
    playerStats.profile.bio = bio;
    printToTerminal(`Bio updated successfully!`, "success");
    showNotification("Bio updated!");
  } catch (error) {
    printToTerminal("Error updating bio: " + error.message, "error");
  }
}

async function setPlayerClass(args) {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  if (!args || args.length === 0) {
    printToTerminal("Usage: !setclass <class>", "warning");
    printToTerminal("Available classes:", "info");
    printToTerminal("- Hunter", "info");
    printToTerminal("- Healer", "info");
    printToTerminal("- Tank", "info");
    printToTerminal("- Assassin", "info");
    printToTerminal("Example: !setclass Hunter", "info");
    return;
  }

  const className = args.join(" ");
  const validClasses = ["Hunter", "Healer", "Tank", "Assassin"];

  if (!validClasses.includes(className)) {
    printToTerminal("Invalid class. Available classes:", "error");
    validClasses.forEach((c) => printToTerminal(`- ${c}`, "info"));
    return;
  }

  try {
    const playerRef = db.collection("players").doc(currentUser.uid);
    await playerRef.update({
      "profile.class": className,
    });

    // Update local stats
    playerStats.profile.class = className;
    printToTerminal(`Class updated to: ${className}`, "success");
    showNotification("Class updated successfully!");
  } catch (error) {
    printToTerminal("Error updating class: " + error.message, "error");
  }
}

// Add the simulation function
async function simulateQuestTimeout() {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  try {
    const playerRef = db.collection("players").doc(currentUser.uid);
    const dailyQuestsRef = playerRef.collection("dailyQuests");

    const [playerDoc, questsSnapshot] = await Promise.all([
      playerRef.get(),
      dailyQuestsRef.get(),
    ]);

    if (questsSnapshot.empty) {
      printToTerminal("No daily quests found to simulate timeout.", "warning");
      return;
    }

    printToTerminal("\n=== SIMULATING DAILY QUEST TIMEOUT ===", "system");
    let failureCount = 0;
    const player = playerDoc.data();

    // Calculate penalties
    const XP_PENALTY_PER_QUEST = 50;
    const GOLD_PENALTY_PER_QUEST = 25;
    let totalXpPenalty = 0;
    let totalGoldPenalty = 0;

    for (const doc of questsSnapshot.docs) {
      const quest = doc.data();
      // Check if quest is incomplete (currentCount < targetCount)
      if (!quest.completed && quest.currentCount < quest.targetCount) {
        await logFailure(
          "daily_quest",
          `Failed to complete daily quest: ${quest.title} (Progress: ${quest.currentCount}/${quest.targetCount} ${quest.metric})`
        );
        failureCount++;
        totalXpPenalty += XP_PENALTY_PER_QUEST;
        totalGoldPenalty += GOLD_PENALTY_PER_QUEST;
      }
    }

    if (failureCount > 0) {
      // Apply penalties
      const newXp = Math.max(0, player.xp - totalXpPenalty);
      const newGold = Math.max(0, player.gold - totalGoldPenalty);

      await playerRef.update({
        xp: newXp,
        gold: newGold,
      });

      printToTerminal(
        `${failureCount} quest(s) failed due to timeout!`,
        "error"
      );
      printToTerminal(`Penalties applied:`, "warning");
      printToTerminal(`- XP Penalty: -${totalXpPenalty}`, "warning");
      printToTerminal(`- Gold Penalty: -${totalGoldPenalty}`, "warning");
      printToTerminal("Check !failures to see the failure log.", "info");
      printToTerminal("Use !status to see your updated stats.", "info");
    } else {
      printToTerminal("No incomplete daily quests found.", "info");
    }
  } catch (error) {
    printToTerminal("Error simulating timeout: " + error.message, "error");
  }
}

// Window System
const windowSystem = {
  windows: {},
  zIndex: 1000,

  init() {
    // Add taskbar to the body
    const taskbar = document.createElement("div");
    taskbar.className = "window-taskbar";
    document.body.appendChild(taskbar);

    // Initialize all windows
    document.querySelectorAll(".window").forEach((window) => {
      const id = window.id;
      this.windows[id] = window;

      // Set initial position if not set
      if (!window.style.top && !window.style.left) {
        window.style.top = "50px";
        window.style.left = "50px";
      }

      // Update window header
      const header = window.querySelector(".window-header");
      const closeBtn = window.querySelector(".window-close");
      if (!closeBtn) {
        const closeBtn = document.createElement("button");
        closeBtn.className = "window-close";
        closeBtn.innerHTML = "×";
        closeBtn.addEventListener("click", () => this.closeWindow(id));
        header.appendChild(closeBtn);
      } else {
        closeBtn.addEventListener("click", () => this.closeWindow(id));
      }

      // Add dragging functionality
      this.makeDraggable(window);
    });

    // Add taskbar items for all windows including rank progress
    const windowConfigs = [
      { id: "profileWindow", icon: "fa-user", title: "Profile" },
      { id: "questsWindow", icon: "fa-tasks", title: "Quests" },
      {
        id: "dailyQuestsWindow",
        icon: "fa-calendar-check",
        title: "Daily Quests",
      },
      { id: "achievementsWindow", icon: "fa-star", title: "Achievements" },
      { id: "shopWindow", icon: "fa-store", title: "Shop" },
      { id: "inventoryWindow", icon: "fa-box", title: "Inventory" },
      {
        id: "rankProgressWindow",
        icon: "fa-medal",
        title: "Rank Progress",
      },
      { id: "BattleWindow", icon: "fa-dragon", title: "Boss Battles" },
      {
        id: "leaderboardWindow",
        icon: "fa-trophy",
        title: "Leaderboard",
      },
    ];

    windowConfigs.forEach((config) => {
      const taskbarItem = document.createElement("div");
      taskbarItem.className = "taskbar-item";
      taskbarItem.title = config.title;
      taskbarItem.innerHTML = `<i class="fas ${config.icon}"></i>`;
      taskbarItem.addEventListener("click", () => this.toggleWindow(config.id));
      taskbar.appendChild(taskbarItem);
    });

    // Add click handler to bring window to front
    document.addEventListener("mousedown", (e) => {
      const window = e.target.closest(".window");
      if (window) {
        this.bringToFront(window.id);
      }
    });
  },

  makeDraggable(window) {
    const header = window.querySelector(".window-header");
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;

    header.addEventListener("mousedown", (e) => {
      if (e.target.closest(".window-close")) return;

      isDragging = true;
      initialX = e.clientX - xOffset;
      initialY = e.clientY - yOffset;

      window.style.cursor = "grabbing";
    });

    document.addEventListener("mousemove", (e) => {
      if (!isDragging) return;

      e.preventDefault();
      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;

      xOffset = currentX;
      yOffset = currentY;

      window.style.transform = `translate(${currentX}px, ${currentY}px)`;
    });

    document.addEventListener("mouseup", () => {
      if (!isDragging) return;

      isDragging = false;
      window.style.cursor = "default";

      // Update the window's position
      const rect = window.getBoundingClientRect();
      window.style.left = rect.left + "px";
      window.style.top = rect.top + "px";
      window.style.transform = "";
      xOffset = 0;
      yOffset = 0;
    });
  },

  showWindow(windowId) {
    const window = this.windows[windowId];
    if (window) {
      // Play system sound when opening window
      notificationSystem.playSound("system");

      // Add delay before showing the window
      setTimeout(() => {
        window.classList.add("show");
        this.bringToFront(windowId);
        this.updateWindowContent(windowId);

        // Update taskbar
        const taskbarItem = this.getTaskbarItem(windowId);
        if (taskbarItem) {
          taskbarItem.classList.add("active");
        }
      }, 250);
    }
  },

  toggleWindow(windowId) {
    const window = this.windows[windowId];
    // Play sound instantly if window exists and is not shown
    if (window && !window.classList.contains("show")) {
    }

    // Rest of the window logic
    if (window) {
      if (window.classList.contains("show")) {
        this.closeWindow(windowId);
      } else {
        if (windowId === "rankProgressWindow") {
          showRankProgress();
        } else {
          this.showWindow(windowId);
        }
      }
    }
  },

  closeWindow(windowId) {
    const window = this.windows[windowId];
    if (window) {
      // Play close sound
      notificationSystem.playSound("close");

      // Add delay before closing
      setTimeout(() => {
        window.classList.remove("show");
        const taskbarItem = this.getTaskbarItem(windowId);
        if (taskbarItem) {
          taskbarItem.classList.remove("active");
        }
      }, 200);
    }
  },

  bringToFront(windowId) {
    const window = this.windows[windowId];
    if (window) {
      this.zIndex += 1;
      window.style.zIndex = this.zIndex;
    }
  },

  getTaskbarItem(windowId) {
    const title =
      this.windows[windowId].querySelector(".window-title").textContent;
    return Array.from(document.querySelectorAll(".taskbar-item")).find(
      (item) => item.title === title
    );
  },

  // Add updateWindowContent method
  async updateWindowContent(windowId) {
    switch (windowId) {
      case "profileWindow":
        await this.updateProfileWindow();
        break;
      case "questsWindow":
        await this.updateQuestsWindow();
        break;
      case "dailyQuestsWindow":
        await this.updateDailyQuestsWindow();
        break;
      case "achievementsWindow":
        await this.updateAchievementsWindow();
        break;
      case "shopWindow":
        await this.updateShopWindow();
        break;
      case "inventoryWindow":
        await this.updateInventoryWindow();
        break;
      case "BattleWindow":
        await this.updateBattleWindow();
        break;
      case "leaderboardWindow":
        await this.updateLeaderboardWindow();
        break;
    }
  },

  // Rest of the methods remain the same...

  async updateProfileWindow() {
    try {
      const playerRef = db.collection("players").doc(currentUser.uid);
      const playerDoc = await playerRef.get();
      if (!playerDoc.exists) return;

      const player = playerDoc.data();

      // Update Character Info section
      document.getElementById("profileName").textContent =
        player?.profile?.name || "Not set";
      document.getElementById("profileTitle").textContent =
        player?.profile?.title || "Novice";
      document.getElementById("profileClass").textContent =
        player?.profile?.class || "Hunter";
      document.getElementById("profileBio").textContent =
        player?.profile?.bio || "Not set";

      // Update Stats section
      document.getElementById("profileRank").textContent = player?.rank || "E";
      document.getElementById("profileLevel").textContent = player?.level || 1;

      // Calculate XP progress to next level
      const xpForNextLevel = 100;
      document.getElementById("profileExp").textContent = `${
        player?.exp || 0
      }/${xpForNextLevel}`;
      document.getElementById("profileExpBar").style.width = `${
        ((player?.exp || 0) / xpForNextLevel) * 100
      }%`;

      document.getElementById("profileGold").textContent = player?.gold || 0;

      // Update Progress section
      document.getElementById("profileQuestsCompleted").textContent =
        player?.questsCompleted || 0;
      document.getElementById("profileStreak").textContent = `${
        player?.streak || 0
      } days`;

      // Update Water Intake section
      const waterIntake = player?.waterIntake || {
        current: 0,
        lastReset: null,
        streakDays: 0,
      };
      const waterGoal = 8;
      document.getElementById(
        "profileWaterIntake"
      ).textContent = `${waterIntake.current}/${waterGoal} glasses`;
      document.getElementById("profileWaterBar").style.width = `${
        (waterIntake.current / waterGoal) * 100
      }%`;
      document.getElementById(
        "profileWaterStreak"
      ).textContent = `Streak: ${waterIntake.streakDays} days`;

      // Update Join Date
      if (player?.profile?.joinDate) {
        const joinDate = player.profile.joinDate.toDate();
        document.getElementById("profileJoinDate").textContent =
          joinDate.toLocaleString();
      } else {
        document.getElementById("profileJoinDate").textContent = "Not set";
      }

      // Update Achievements count if displayed
      if (document.getElementById("profileAchievements")) {
        document.getElementById("profileAchievements").textContent = `${
          player?.achievements?.length || 0
        } unlocked`;
      }

      // Update Workout Streak if displayed
      if (document.getElementById("profileWorkoutStreak")) {
        const workoutStreak = player?.workoutStreak || {
          current: 0,
          totalWorkouts: 0,
          xpMultiplier: 1.0,
        };
        document.getElementById(
          "profileWorkoutStreak"
        ).textContent = `${workoutStreak.current} days (${workoutStreak.totalWorkouts} total)`;
      }

      // Update local playerStats
      playerStats = {
        level: player?.level || 1,
        exp: player?.exp || 0,
        gold: player?.gold || 0,
        rank: player?.rank || "E",
        streak: player?.streak || 0,
        questsCompleted: player?.questsCompleted || 0,
        achievements: player?.achievements || [],
        inventory: player?.inventory || [],
        lastDailyCompletion: player?.lastDailyCompletion || null,
        profile: {
          name: player?.profile?.name || "",
          title: player?.profile?.title || "Novice",
          picture: player?.profile?.picture || "default.png",
          bio: player?.profile?.bio || "",
          class: player?.profile?.class || "Hunter",
          joinDate: player?.profile?.joinDate || null,
        },
        failures: player?.failures || [],
        waterIntake: {
          current: player?.waterIntake?.current || 0,
          lastReset: player?.waterIntake?.lastReset || null,
          streakDays: player?.waterIntake?.streakDays || 0,
        },
        workoutStreak: {
          current: player?.workoutStreak?.current || 0,
          lastWorkout: player?.workoutStreak?.lastWorkout || null,
          totalWorkouts: player?.workoutStreak?.totalWorkouts || 0,
          xpMultiplier: player?.workoutStreak?.xpMultiplier || 1.0,
        },
      };

      // Update status bar
      const statusBar = document.querySelector(".status-bar");
      statusBar.innerHTML = `
  <span>RANK: ${playerStats.rank}</span>
  <span>LEVEL: ${playerStats.level}</span>
  <span>EXP: ${playerStats.exp}/100</span>
  <span>GOLD: ${playerStats.gold}</span>
`;
    } catch (error) {
      console.error("Error updating profile window:", error);
      printToTerminal("Error updating profile: " + error.message, "error");
    }
  },

  async updateQuestsWindow() {
    if (!currentUser) return;
    try {
      const questsRef = db
        .collection("players")
        .doc(currentUser.uid)
        .collection("quests");
      const snapshot = await questsRef.get();
      const questsList = document.getElementById("activeQuestsList");
      questsList.innerHTML = "";

      if (snapshot.empty) {
        questsList.innerHTML =
          '<div class="window-item">No active quests</div>';
        return;
      }

      // Add Complete All button at the top
      const completeAllBtn = document.createElement("button");
      completeAllBtn.className = "window-button";
      completeAllBtn.textContent = "Complete All Quests";
      completeAllBtn.onclick = () => completeAllQuests("normal");
      questsList.appendChild(completeAllBtn);

      snapshot.forEach((doc) => {
        const quest = doc.data();
        const questElement = document.createElement("div");
        questElement.className = "window-item";

        // Add completed class if quest is completed
        if (quest.completed) {
          questElement.classList.add("completed-quest");
        }

        questElement.innerHTML = `
          <div class="window-item-title">
            ${quest.title}
            ${quest.completed ? '<span class="completion-badge">✓</span>' : ""}
          </div>
          <div class="window-item-description">
            Progress: 
            <input type="number" 
                   value="${
                     quest.completed ? quest.targetCount : quest.currentCount
                   }" 
                   min="0" 
                   max="${quest.targetCount}" 
                   onchange="updateQuestCount('${
                     doc.id
                   }', 'normal', this.value)"
                   style="width: 60px; background: transparent; color: var(--text-color); border: 1px solid var(--system-blue);"
                   ${quest.completed ? "disabled" : ""}>
            /${quest.targetCount} ${quest.metric}
          </div>
          <div class="window-item-description">${quest.description}</div>
          <div class="window-item-progress">
            <div class="window-item-progress-bar" style="width: ${
              quest.completed
                ? 100
                : (quest.currentCount / quest.targetCount) * 100
            }%"></div>
          </div>
          <div class="window-actions" style="margin-top: 10px;">
            <button class="window-button" 
                    onclick="updateQuestProgress('${
                      doc.id
                    }', 'normal', 'complete')"
                    ${quest.completed ? "disabled" : ""}>
              ${quest.completed ? "Completed" : "Complete Quest"}
            </button>
          </div>
        `;
        questsList.appendChild(questElement);
      });
    } catch (error) {
      console.error("Error updating quests window:", error);
    }
  },

  async updateDailyQuestsWindow() {
    if (!currentUser) return;
    try {
      const questsRef = db
        .collection("players")
        .doc(currentUser.uid)
        .collection("dailyQuests");
      const snapshot = await questsRef.get();
      const questsList = document.getElementById("dailyQuestsList");
      questsList.innerHTML = "";

      if (snapshot.empty) {
        questsList.innerHTML = '<div class="window-item">No daily quests</div>';
        return;
      }

      // Add Complete All button at the top
      const completeAllBtn = document.createElement("button");
      completeAllBtn.className = "window-button";
      completeAllBtn.textContent = "Complete All Daily Quests";
      completeAllBtn.onclick = () => completeAllQuests("daily");
      questsList.appendChild(completeAllBtn);

      snapshot.forEach((doc) => {
        const quest = doc.data();
        const questElement = document.createElement("div");
        questElement.className = "window-item";
        const endOfDay = getEndOfDay();
        const timeRemaining = endOfDay - new Date();

        // Check if quest was completed today
        const isCompletedToday =
          quest.completed &&
          quest.lastCompletion &&
          wasCompletedToday(quest.lastCompletion);

        // Add completed class if quest is completed today
        if (isCompletedToday) {
          questElement.classList.add("completed-quest");
        }

        questElement.innerHTML = `
          <div class="window-item-title">
            ${quest.title}
            ${isCompletedToday ? '<span class="completion-badge">✓</span>' : ""}
          </div>
          <div class="window-item-description">
            Progress: 
            <input type="number" 
                   value="${
                     isCompletedToday ? quest.targetCount : quest.currentCount
                   }" 
                   min="0" 
                   max="${quest.targetCount}" 
                   onchange="updateQuestCount('${doc.id}', 'daily', this.value)"
                   style="width: 60px; background: transparent; color: var(--text-color); border: 1px solid var(--system-blue);"
                   ${isCompletedToday ? "disabled" : ""}>
            /${quest.targetCount} ${quest.metric}
          </div>
          <div class="window-item-description">${quest.description}</div>
          <div class="window-item-description">
            ${
              isCompletedToday
                ? "Completed Today"
                : `Time remaining: ${formatTimeRemaining(timeRemaining)}`
            }
          </div>
          <div class="window-item-progress">
            <div class="window-item-progress-bar" style="width: ${
              isCompletedToday
                ? 100
                : (quest.currentCount / quest.targetCount) * 100
            }%"></div>
          </div>
          <div class="window-actions" style="margin-top: 10px;">
            <button class="window-button" 
                    onclick="updateQuestProgress('${
                      doc.id
                    }', 'daily', 'complete')"
                    ${isCompletedToday ? "disabled" : ""}>
              ${isCompletedToday ? "Completed Today" : "Complete Quest"}
            </button>
          </div>
        `;
        questsList.appendChild(questElement);
      });
    } catch (error) {
      console.error("Error updating daily quests window:", error);
    }
  },

  async updateAchievementsWindow() {
    if (!currentUser) return;
    try {
      const playerRef = db.collection("players").doc(currentUser.uid);
      const player = (await playerRef.get()).data();
      const achievementsList = document.getElementById("achievementsList");
      achievementsList.innerHTML = "";

      // Group achievements by category
      const categories = {
        level: "Level Achievements",
        quests_completed: "Quest Achievements",
        daily_streak: "Streak Achievements",
        total_workouts: "Workout Achievements",
        water_streak: "Hydration Achievements",
        total_gold: "Gold Achievements",
        rank: "Rank Achievements",
      };

      Object.entries(categories).forEach(([type, categoryName]) => {
        const categoryAchievements = Object.values(ACHIEVEMENTS).filter(
          (a) => a.type === type
        );
        if (categoryAchievements.length > 0) {
          const categoryHeader = document.createElement("div");
          categoryHeader.className = "achievement-category";
          categoryHeader.textContent = categoryName;
          achievementsList.appendChild(categoryHeader);

          categoryAchievements.forEach((achievement) => {
            const achievementElement = document.createElement("div");
            const currentRank =
              player.achievements?.[achievement.id]?.currentRank || 0;
            const isMaxRank = currentRank === achievement.ranks.length;
            const nextRank = isMaxRank ? null : achievement.ranks[currentRank];

            achievementElement.className = `achievement-item${
              currentRank === 0 ? " locked" : ""
            }`;

            // Calculate progress
            let currentValue = 0;
            let progressText = "";
            let progressPercentage = 0;

            if (nextRank) {
              switch (achievement.type) {
                case "level":
                  currentValue = Math.min(
                    player.level || 0,
                    nextRank.requirement
                  );
                  progressText = `Level ${currentValue}/${nextRank.requirement}`;
                  break;
                case "quests_completed":
                  currentValue = Math.min(
                    player.questsCompleted || 0,
                    nextRank.requirement
                  );
                  progressText = `${currentValue}/${nextRank.requirement} Quests`;
                  break;
                case "daily_streak":
                  currentValue = Math.min(
                    player.streak || 0,
                    nextRank.requirement
                  );
                  progressText = `${currentValue}/${nextRank.requirement} Days`;
                  break;
                case "total_workouts":
                  currentValue = Math.min(
                    player.workoutStreak?.totalWorkouts || 0,
                    nextRank.requirement
                  );
                  progressText = `${currentValue}/${nextRank.requirement} Workouts`;
                  break;
                case "water_streak":
                  currentValue = Math.min(
                    player.waterIntake?.streakDays || 0,
                    nextRank.requirement
                  );
                  progressText = `${currentValue}/${nextRank.requirement} Days`;
                  break;
                case "total_gold":
                  currentValue = Math.min(
                    player.gold || 0,
                    nextRank.requirement
                  );
                  progressText = `${currentValue.toLocaleString()}/${nextRank.requirement.toLocaleString()} Gold`;
                  break;
                case "rank":
                  const ranks = ["E", "D", "C", "B", "A", "S"];
                  const currentRankIndex = ranks.indexOf(player.rank || "E");
                  const requiredRankIndex = ranks.indexOf(nextRank.requirement);
                  currentValue =
                    currentRankIndex >= requiredRankIndex
                      ? requiredRankIndex
                      : currentRankIndex;
                  progressText = `Current: ${player.rank || "E"} / Required: ${
                    nextRank.requirement
                  }`;
                  break;
              }

              // Calculate progress percentage
              if (achievement.type === "rank") {
                const ranks = ["E", "D", "C", "B", "A", "S"];
                const currentRankIndex = ranks.indexOf(player.rank || "E");
                const requiredRankIndex = ranks.indexOf(nextRank.requirement);
                progressPercentage =
                  (currentRankIndex / requiredRankIndex) * 100;
              } else {
                progressPercentage =
                  (currentValue / nextRank.requirement) * 100;
              }

              achievementElement.innerHTML = `
                    <div class="achievement-rank ${isMaxRank ? "max" : ""}">
                        ${isMaxRank ? "MAX" : `Rank ${currentRank}`}
                    </div>
                    <div class="achievement-glow"></div>
                    <div class="achievement-header">
                        <div class="achievement-name">
                            <span class="achievement-icon">${
                              achievement.icon
                            }</span>
                            ${achievement.name}
                        </div>
                    </div>
                    <div class="achievement-description">${
                      achievement.description
                    }</div>
                    ${
                      nextRank
                        ? `
                        <div class="achievement-rewards">
                            Next Rank Rewards: ${nextRank.reward.exp} XP, ${
                            nextRank.reward.gold
                          } Gold
                        </div>
                        <div class="achievement-progress-container">
                            <div class="achievement-progress-bar" style="width: ${progressPercentage}%"></div>
                        </div>
                        <div class="achievement-progress-text">${progressText}</div>
                        <div class="achievement-next-rank">Next: Rank ${
                          currentRank + 1
                        }</div>
                    `
                        : `
                        <div class="achievement-rewards">
                            Achievement Mastered!
                        </div>
                    `
                    }
                `;

              // Ensure achievementsList exists before appending
              const achievementsList =
                document.getElementById("achievementsList");
              if (achievementsList) {
                achievementsList.appendChild(achievementElement);
              } else {
                console.error("Error: 'achievementsList' element not found.");
              }
            }
          });
        }
      });
    } catch (error) {
      console.error("Error updating achievements window:", error);
    }
  },

  async updateShopWindow() {
    if (!currentUser) return;
    try {
      const shopItemsList = document.getElementById("shopItemsList");
      shopItemsList.innerHTML = "";

      // Group items by category
      const categories = {
        booster: { name: "🎓 XP & Level Boosters", items: [] },
        enhancer: { name: "🎯 Quest Enhancers", items: [] },
        training: { name: "💪 Training Boosters", items: [] },
        upgrade: { name: "🏆 Permanent Upgrades", items: [] },
        economy: { name: "💰 Gold & Economy", items: [] },
        title: { name: "🏅 Special Titles & Cosmetics", items: [] },
        special: { name: "🌟 Special Items", items: [] },
      };

      // Sort items into categories
      Object.entries(ITEMS).forEach(([itemId, item]) => {
        if (categories[item.category]) {
          categories[item.category].items.push({ id: itemId, ...item });
        }
      });

      // Create sections for each category
      Object.values(categories).forEach((category) => {
        if (category.items.length > 0) {
          // Add category header
          const categorySection = document.createElement("div");
          categorySection.className = "shop-category-section";

          const categoryHeader = document.createElement("div");
          categoryHeader.className = "shop-category-header";
          categoryHeader.textContent = category.name;
          categorySection.appendChild(categoryHeader);

          // Add items container
          const itemsContainer = document.createElement("div");
          itemsContainer.className = "shop-items-container";

          // Add items in category
          category.items.forEach((item) => {
            const itemElement = document.createElement("div");
            itemElement.className = "shop-item";

            // Check if player meets rank requirement
            const canPurchase =
              !item.rankRequired ||
              isRankSufficient(playerStats.rank, item.rankRequired);

            if (!canPurchase) {
              itemElement.classList.add("shop-item-locked");
            }

            itemElement.innerHTML = `
              <div class="shop-item-header">
                <span class="shop-item-name">${item.name}</span>
                ${
                  item.rankRequired
                    ? `<span class="shop-item-rank">Rank ${item.rankRequired}</span>`
                    : ""
                }
              </div>
              <div class="shop-item-description">${item.description}</div>
              <div class="shop-item-footer">
                <span class="shop-item-price">${item.price} Gold</span>
                ${
                  canPurchase
                    ? `<button onclick="purchaseItem('${item.id}')" class="shop-button">Purchase</button>`
                    : `<div class="shop-item-requirement">Requires Rank ${item.rankRequired}</div>`
                }
              </div>
              ${
                item.duration
                  ? `<div class="shop-item-duration">Duration: ${formatDuration(
                      item.duration
                    )}</div>`
                  : ""
              }
            `;
            itemsContainer.appendChild(itemElement);
          });

          categorySection.appendChild(itemsContainer);
          shopItemsList.appendChild(categorySection);
        }
      });

      // Add CSS if not already present
      if (!document.getElementById("shopStyles")) {
        const styleSheet = document.createElement("style");
        styleSheet.id = "shopStyles";
        styleSheet.textContent = `
          #shopItemsList {
            padding: 10px;
          }
          .shop-category-section {
            margin-bottom: 15px;
          }
          .shop-category-header {
            font-size: 1em;
            font-weight: bold;
            color: #00ffff;
            margin: 10px 0 5px 0;
            padding: 3px 0;
            border-bottom: 1px solid #0088ff;
            text-transform: uppercase;
            letter-spacing: 1px;
            text-shadow: 0 0 10px rgba(0, 255, 255, 0.3);
          }
          .shop-items-container {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 8px;
            padding: 5px 0;
          }
          .shop-item {
            background: rgba(0, 16, 32, 0.95);
            border: 1px solid #0088ff;
            border-radius: 4px;
            padding: 8px;
            transition: all 0.2s ease;
            position: relative;
            overflow: hidden;
            font-size: 0.9em;
          }
          .shop-item::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 1px;
            background: linear-gradient(90deg, transparent, #00ffff, transparent);
          }
          .shop-item:hover {
            transform: translateY(-1px);
            box-shadow: 0 0 10px rgba(0, 136, 255, 0.2);
            border-color: #00ffff;
          }
          .shop-item-locked {
            opacity: 0.7;
            border-color: #444;
          }
          .shop-item-locked::after {
            background: linear-gradient(90deg, transparent, #444, transparent);
          }
          .shop-item-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 4px;
            border-bottom: 1px solid rgba(0, 136, 255, 0.2);
            padding-bottom: 4px;
            gap: 8px;
          }
          .shop-item-name {
            font-weight: bold;
            color: #fff;
            text-shadow: 0 0 5px rgba(0, 255, 255, 0.3);
            font-size: 0.9em;
          }
          .shop-item-rank {
            color: #00ffff;
            font-size: 0.8em;
            background: rgba(0, 136, 255, 0.1);
            padding: 1px 6px;
            border-radius: 3px;
            border: 1px solid rgba(0, 136, 255, 0.3);
            white-space: nowrap;
          }
          .shop-item-description {
            color: #88ccff;
            font-size: 0.85em;
            margin-bottom: 8px;
            min-height: 32px;
            line-height: 1.3;
          }
          .shop-item-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 4px;
            background: rgba(0, 16, 32, 0.3);
            padding: 4px 6px;
            border-radius: 3px;
            gap: 8px;
          }
          .shop-item-price {
            color: #00ffff;
            font-weight: bold;
            text-shadow: 0 0 5px rgba(0, 255, 255, 0.3);
            font-size: 0.85em;
            white-space: nowrap;
          }
          .shop-button {
            background: linear-gradient(180deg, #0088ff, #0066cc);
            color: white;
            border: none;
            padding: 3px 8px;
            border-radius: 3px;
            cursor: pointer;
            transition: all 0.2s ease;
            text-transform: uppercase;
            font-size: 0.8em;
            font-weight: bold;
            letter-spacing: 0.5px;
            border: 1px solid #00aaff;
            white-space: nowrap;
          }
          .shop-button:hover {
            background: linear-gradient(180deg, #00aaff, #0088ff);
            box-shadow: 0 0 5px rgba(0, 136, 255, 0.3);
          }
          .shop-item-requirement {
            color: #ff4444;
            font-size: 0.8em;
            background: rgba(255, 68, 68, 0.1);
            padding: 1px 6px;
            border-radius: 3px;
            border: 1px solid rgba(255, 68, 68, 0.3);
          }
          .shop-item-duration {
            color: #88ccff;
            font-size: 0.75em;
            margin-top: 4px;
            text-align: right;
            font-style: italic;
          }

          /* Scrollbar Styling */
          #shopItemsList::-webkit-scrollbar {
            width: 8px;
          }
          #shopItemsList::-webkit-scrollbar-track {
            background: rgba(0, 16, 32, 0.95);
            border-radius: 4px;
          }
          #shopItemsList::-webkit-scrollbar-thumb {
            background: #0088ff;
            border-radius: 4px;
          }
          #shopItemsList::-webkit-scrollbar-thumb:hover {
            background: #00aaff;
          }
        `;
        document.head.appendChild(styleSheet);
      }
    } catch (error) {
      console.error("Error updating shop window:", error);
    }
  },

  async updateInventoryWindow() {
    if (!currentUser) return;
    try {
      const playerRef = db.collection("players").doc(currentUser.uid);
      const player = (await playerRef.get()).data();
      const inventoryList = document.getElementById("inventoryItemsList");
      inventoryList.innerHTML = "";

      if (!player.inventory || player.inventory.length === 0) {
        inventoryList.innerHTML =
          '<div class="window-item">Your inventory is empty</div>';
        return;
      }

      const now = Date.now();

      player.inventory.forEach((inventoryItem) => {
        const item = Object.values(ITEMS).find(
          (item) => item.id === inventoryItem.id
        );
        if (item) {
          const itemElement = document.createElement("div");
          itemElement.className = "window-item";

          const isExpired =
            inventoryItem.expiresAt && inventoryItem.expiresAt <= now;
          const isPermanent = !inventoryItem.expiresAt;
          const timeLeft = inventoryItem.expiresAt
            ? Math.max(0, inventoryItem.expiresAt - now)
            : null;

          if (isExpired) {
            itemElement.classList.add("expired-item");
          }

          // Check if item is usable
          const isUsable =
            item.effect &&
            (item.effect.type === "name_color" ||
              item.effect.type === "gold" ||
              item.effect.type === "complete_quest" ||
              item.effect.type === "reset_daily" ||
              item.effect.type === "remove_fatigue");

          itemElement.innerHTML = `
            <div class="window-item-title">${item.name}</div>
            <div class="window-item-description">${item.description}</div>
            ${
              timeLeft !== null
                ? `<div class="window-item-description ${
                    isExpired ? "text-error" : ""
                  }">
                  ${
                    isExpired
                      ? "EXPIRED"
                      : `Time remaining: ${Math.ceil(timeLeft / 60000)} minutes`
                  }
                 </div>`
                : ""
            }
            <div class="window-actions">
              ${
                isExpired || isPermanent
                  ? `<div class="window-item-price">Sell price: ${calculateSellPrice(
                      item
                    )} gold</div>
                   <button onclick="sellItem('${
                     item.id
                   }')" class="window-button">Sell</button>`
                  : isUsable
                  ? `<button onclick="useItem('${item.id}')" class="window-button">Use</button>`
                  : ""
              }
            </div>
          `;
          inventoryList.appendChild(itemElement);
        }
      });

      // Add CSS if not already present
      if (!document.getElementById("inventoryStyles")) {
        const styleSheet = document.createElement("style");
        styleSheet.id = "inventoryStyles";
        styleSheet.textContent = `
          .window-actions {
            display: flex;
            gap: 10px;
            justify-content: flex-end;
            align-items: center;
            margin-top: 10px;
          }
          .window-item-price {
            color: #00ffff;
            font-size: 0.9em;
          }
          .expired-item {
            opacity: 0.7;
          }
          .text-error {
            color: #ff4444;
          }
        `;
        document.head.appendChild(styleSheet);
      }
    } catch (error) {
      console.error("Error updating inventory window:", error);
    }
  },

  async updateBattleWindow() {
    if (!currentUser) return;
    try {
      const bossBattlesList = document.getElementById("bossBattlesList");
      bossBattlesList.innerHTML = "";

      // Get player's active battles and defeated bosses
      const playerRef = db.collection("players").doc(currentUser.uid);
      const playerDoc = await playerRef.get();
      const defeatedBosses = playerDoc.data()?.defeatedBosses || {};

      const activeBattlesRef = playerRef.collection("activeBattles");
      const activeBattles = await activeBattlesRef.get();
      const activeBattleMap = new Map();

      activeBattles.forEach((doc) => {
        const battle = doc.data();
        activeBattleMap.set(doc.id, battle);

        // Check for timeout
        const now = new Date();
        const endTime = battle.endTime.toDate();
        if (now > endTime) {
          handleBossBattleTimeout(playerRef, doc.id, battle);
          activeBattleMap.delete(doc.id);
        }
      });

      // Display available boss battles
      Object.entries(BOSSES).forEach(([bossKey, boss]) => {
        const defeatCount = defeatedBosses[boss.id] || 0;
        const activeBattle = activeBattleMap.get(boss.id);
        const bossElement = document.createElement("div");
        bossElement.className = "window-item";

        // Calculate scaled values
        const scaledTarget =
          boss.baseTargetCount + defeatCount * boss.scaling.targetCount;

        bossElement.innerHTML = `
          <div class="window-item-title">
            ${boss.name}
            ${
              defeatCount > 0
                ? `<span class="defeat-count">💀 ${defeatCount}</span>`
                : ""
            }
            ${
              activeBattle
                ? '<span class="active-battle-badge">⚔️ In Progress</span>'
                : ""
            }
          </div>
          <div class="window-item-description">${boss.description}</div>
          <div class="window-item-description">
            Target: ${scaledTarget} ${boss.metric}
            <br>Time Limit: ${formatTimeLimit(boss.timeLimit)}
            ${
              defeatCount > 0
                ? `<br>Scaling: +${boss.scaling.targetCount} ${boss.metric} per defeat`
                : ""
            }
          </div>
          <div class="window-item-description">
            Rewards:
            <br>- ${
              boss.rewards.exp + defeatCount * boss.scaling.rewards.exp
            } XP
            <br>- ${
              boss.rewards.gold + defeatCount * boss.scaling.rewards.gold
            } Gold
            <br>- Title: ${boss.rewards.title}
          </div>
          ${
            activeBattle
              ? `
            <div class="window-item-progress">
              <div class="progress-input">
                <label>Current Progress:</label>
                <input type="number" 
                       value="${activeBattle.currentCount}"
                       min="0"
                       max="${activeBattle.targetCount}"
                       onchange="updateBattleProgress(['${
                         boss.id
                       }', this.value])"
                       style="width: 80px; margin: 0 10px; background: transparent; color: var(--text-color); border: 1px solid var(--system-blue);">
                /${activeBattle.targetCount} ${boss.metric}
              </div>
              <div class="battle-time-remaining">
                Time Remaining: ${formatTimeRemaining(
                  activeBattle.endTime.toDate() - new Date()
                )}
              </div>
              <div class="window-item-progress-bar" style="width: ${
                (activeBattle.currentCount / activeBattle.targetCount) * 100
              }%"></div>
            </div>
          `
              : ""
          }
          <div class="window-actions">
            <button class="window-button" 
                    onclick="startBossBattle(['${boss.id}'])"
                    ${activeBattle ? "disabled" : ""}>
              ${activeBattle ? "Battle in Progress" : "Start Battle"}
            </button>
          </div>
        `;

        bossBattlesList.appendChild(bossElement);
      });
    } catch (error) {
      console.error("Error updating boss battles window:", error);
    }
  },

  // Add updateLeaderboardWindow function
  async updateLeaderboardWindow() {
    if (!currentUser) return;
    try {
      const leaderboardList = document.getElementById("leaderboardList");
      leaderboardList.innerHTML = "";

      // Get all players sorted by level and exp
      const playersSnapshot = await db.collection("players").get();
      const players = [];

      playersSnapshot.forEach((doc) => {
        const player = doc.data();
        if (player.profile && player.profile.name) {
          players.push({
            name: player.profile.name,
            level: player.level || 1,
            exp: player.exp || 0,
            rank: player.rank || "E",
            nameColor: player.profile.nameColor || null,
          });
        }
      });

      // Sort players by level and exp
      players.sort((a, b) => {
        if (b.level !== a.level) {
          return b.level - a.level;
        }
        return b.exp - a.exp;
      });

      // Display top players
      players.forEach((player, index) => {
        const playerElement = document.createElement("div");
        playerElement.className = "window-item leaderboard-entry";

        const nameStyle = player.nameColor ? `color: ${player.nameColor};` : "";

        playerElement.innerHTML = `
          <div class="window-item-title">
            #${index + 1}. <span style="${nameStyle}">${player.name}</span>
          </div>
          <div class="window-item-description">
            Level ${player.level} | Rank ${player.rank}
          </div>
          <div class="window-item-description">
            EXP: ${player.exp}
          </div>
        `;
        leaderboardList.appendChild(playerElement);
      });

      // Add CSS if not already present
      if (!document.getElementById("leaderboardStyles")) {
        const styleSheet = document.createElement("style");
        styleSheet.id = "leaderboardStyles";
        styleSheet.textContent = `
          .leaderboard-entry {
            border: 1px solid #0088ff;
            margin-bottom: 8px;
            padding: 10px;
            border-radius: 4px;
            background: rgba(0, 16, 32, 0.95);
            transition: all 0.2s ease;
          }
          .leaderboard-entry:hover {
            transform: translateY(-2px);
            box-shadow: 0 2px 8px rgba(0, 136, 255, 0.2);
            border-color: #00ffff;
          }
          .leaderboard-entry .window-item-title {
            font-size: 1.1em;
            color: #fff;
            text-shadow: 0 0 5px rgba(0, 255, 255, 0.3);
          }
        `;
        document.head.appendChild(styleSheet);
      }
    } catch (error) {
      console.error("Error updating leaderboard window:", error);
    }
  },
};

// Initialize window system
document.addEventListener("DOMContentLoaded", () => {
  windowSystem.init();
});

// Update the existing command functions to use windows
function showProfile() {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }
  windowSystem.showWindow("profileWindow");
}

function showQuestWindow(type) {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }
  windowSystem.showWindow(
    type === "daily" ? "dailyQuestsWindow" : "questsWindow"
  );
}

function showAchievements() {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }
  windowSystem.showWindow("achievementsWindow");
}

function showShop() {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }
  windowSystem.showWindow("shopWindow");
}

function showInventory() {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }
  windowSystem.showWindow("inventoryWindow");
}

// Add prompt functions for profile settings
function showSetNamePrompt() {
  const name = prompt("Enter your new name:");
  if (name) {
    setPlayerName([name]);
    windowSystem.updateWindowContent("profileWindow");
  }
}

function showSetTitlePrompt() {
  const title = prompt("Enter your new title:");
  if (title) {
    setPlayerTitle([title]);
    windowSystem.updateWindowContent("profileWindow");
  }
}

function showSetClassPrompt() {
  const validClasses = ["Hunter", "Healer", "Tank", "Assassin"];
  const className = prompt(
    `Enter your new class (${validClasses.join(", ")}):`
  );
  if (className && validClasses.includes(className)) {
    setPlayerClass([className]);
    windowSystem.updateWindowContent("profileWindow");
  } else if (className) {
    alert("Invalid class. Please choose from: " + validClasses.join(", "));
  }
}

// Add purchase function for shop
async function purchaseItem(itemId) {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  // Find item by matching the id property
  const item = Object.values(ITEMS).find((item) => item.id === itemId);
  if (!item) {
    printToTerminal("Item not found.", "error");
    return;
  }

  if (playerStats.gold < item.price) {
    printToTerminal("Not enough gold!", "error");
    return;
  }

  // Play purchase sound immediately
  notificationSystem.playSound("buy");

  try {
    const playerRef = db.collection("players").doc(currentUser.uid);

    await playerRef.update({
      gold: firebase.firestore.FieldValue.increment(-item.price),
      inventory: firebase.firestore.FieldValue.arrayUnion({
        id: itemId,
        expiresAt: item.duration ? Date.now() + item.duration : null,
      }),
    });

    // Update local stats
    playerStats.gold -= item.price;
    if (!playerStats.inventory) playerStats.inventory = [];
    playerStats.inventory.push({
      id: itemId,
      expiresAt: item.duration ? Date.now() + item.duration : null,
    });

    showNotification(`Purchased ${item.name}!`);
    updateStatusBar();
    windowSystem.updateWindowContent("shopWindow");
    windowSystem.updateWindowContent("inventoryWindow");
  } catch (error) {
    printToTerminal("Error purchasing item: " + error.message, "error");
  }
}

async function sellItem(itemId) {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  const playerRef = db.collection("players").doc(currentUser.uid);
  const playerDoc = await playerRef.get();
  const playerData = playerDoc.data();

  // Find the item in the player's inventory
  const inventoryItem = playerData.inventory.find((item) => item.id === itemId);
  if (!inventoryItem) {
    printToTerminal("Item not found in your inventory.", "error");
    return;
  }

  const item = Object.values(ITEMS).find((item) => item.id === itemId);
  if (!item) {
    printToTerminal("Invalid item.", "error");
    return;
  }

  // Play sell sound immediately
  notificationSystem.playSound("sell");

  try {
    const sellPrice = calculateSellPrice(item);

    // Remove item from inventory and add gold
    await playerRef.update({
      gold: firebase.firestore.FieldValue.increment(sellPrice),
      inventory: firebase.firestore.FieldValue.arrayRemove(inventoryItem),
    });

    // Update local stats
    playerStats.gold += sellPrice;
    playerStats.inventory = playerStats.inventory.filter(
      (item) => item.id !== itemId
    );

    printToTerminal(
      `Sold ${item.name} for ${sellPrice} gold! (50% of original price)`,
      "success"
    );
    showNotification(`Sold ${item.name} for ${sellPrice} gold!`);
    updateStatusBar();
    windowSystem.updateWindowContent("shopWindow");
    windowSystem.updateWindowContent("inventoryWindow");
  } catch (error) {
    printToTerminal("Error selling item: " + error.message, "error");
  }
}

window.addEventListener("load", function () {
  setTimeout(function () {
    const prompt = document.querySelector(".terminal-prompt");
    if (prompt) {
      prompt.style.display = "block";
      setTimeout(() => (prompt.style.opacity = "1"), 100); // Smooth fade-in
    }
  }, 5500);
});

// Add bio prompt function
function showSetBioPrompt() {
  const bio = prompt("Enter your bio:");
  if (bio) {
    const playerRef = db.collection("players").doc(currentUser.uid);
    playerRef
      .update({
        "profile.bio": bio,
      })
      .then(() => {
        printToTerminal("Bio updated successfully!", "success");
        windowSystem.updateWindowContent("profileWindow");
      })
      .catch((error) => {
        printToTerminal("Error updating bio: " + error.message, "error");
      });
  }
}

// Add function to update terminal prompt
function updateTerminalPrompt() {
  const promptUser = document.querySelector(".terminal-prompt-user");
  if (playerStats && playerStats.profile && playerStats.profile.name) {
    promptUser.textContent = playerStats.profile.name.toUpperCase();
  } else {
    promptUser.textContent = "PLAYER";
  }
}

// Add functions for quest management
async function completeAllQuests(type) {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  try {
    const questsRef = db
      .collection("players")
      .doc(currentUser.uid)
      .collection(type === "daily" ? "dailyQuests" : "quests");

    const snapshot = await questsRef.get();
    const completionPromises = [];

    snapshot.forEach((doc) => {
      const quest = doc.data();
      if (
        !quest.completed ||
        (type === "daily" && !wasCompletedToday(quest.lastCompletion))
      ) {
        completionPromises.push(completeQuest(doc.id, type));
      }
    });

    await Promise.all(completionPromises);
    printToTerminal(`All ${type} quests completed!`, "success");
    windowSystem.updateWindowContent(
      type === "daily" ? "dailyQuestsWindow" : "questsWindow"
    );
  } catch (error) {
    printToTerminal(`Error completing all quests: ${error.message}`, "error");
  }
}

async function updateQuestCount(questId, type, newCount) {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  try {
    const questRef = db
      .collection("players")
      .doc(currentUser.uid)
      .collection(type === "daily" ? "dailyQuests" : "quests")
      .doc(questId);

    const questDoc = await questRef.get();
    if (!questDoc.exists) {
      printToTerminal("Quest not found.", "error");
      return;
    }

    const quest = questDoc.data();
    const count = parseInt(newCount);

    if (isNaN(count) || count < 0 || count > quest.targetCount) {
      printToTerminal("Invalid count value.", "error");
      windowSystem.updateWindowContent(
        type === "daily" ? "dailyQuestsWindow" : "questsWindow"
      );
      return;
    }

    if (count >= quest.targetCount) {
      // Complete the quest if target reached
      await completeQuest(questId, type);
    } else {
      // Update progress
      await questRef.update({
        currentCount: count,
      });
      printToTerminal(
        `Progress updated: ${count}/${quest.targetCount} ${quest.metric}`,
        "success"
      );
    }

    windowSystem.updateWindowContent(
      type === "daily" ? "dailyQuestsWindow" : "questsWindow"
    );
  } catch (error) {
    printToTerminal("Error updating quest count: " + error.message, "error");
  }
}

// Make these functions available globally
window.completeAllQuests = completeAllQuests;
window.updateQuestCount = updateQuestCount;
window.updateQuestProgress = updateQuestProgress;

// Helper function to check if player's rank is sufficient
function isRankSufficient(playerRank, requiredRank) {
  const ranks = ["E", "D", "C", "B", "A", "S"];
  const playerRankIndex = ranks.indexOf(playerRank);
  const requiredRankIndex = ranks.indexOf(requiredRank);
  return playerRankIndex >= requiredRankIndex;
}

// Helper function to format duration
function formatDuration(milliseconds) {
  const hours = Math.floor(milliseconds / (1000 * 60 * 60));
  const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) {
    return `${hours} hour${hours > 1 ? "s" : ""}`;
  }
  return `${minutes} minutes`;
}

// Add these helper functions to handle item effects
function getActiveItemEffects(playerInventory) {
  if (!playerInventory) return [];

  const now = Date.now();
  return playerInventory
    .filter((item) => !item.expiresAt || item.expiresAt > now)
    .map((inventoryItem) => {
      const item = Object.values(ITEMS).find((i) => i.id === inventoryItem.id);
      return item ? item.effect : null;
    })
    .filter((effect) => effect !== null);
}

function calculateTotalBoost(type, activeEffects) {
  let multiplier = 1;

  activeEffects.forEach((effect) => {
    if (
      effect.type === type ||
      effect.type === "global_xp" ||
      effect.type === "all_stats"
    ) {
      multiplier *= effect.value;
    }
  });

  return multiplier;
}

// Modify the addExperiencePoints function to apply XP boosts
async function addExperiencePoints(args) {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  try {
    const amount = parseInt(args[0]) || 0;
    if (amount <= 0) {
      printToTerminal("Please specify a valid amount of XP.", "error");
      return;
    }

    const playerRef = db.collection("players").doc(currentUser.uid);
    const playerDoc = await playerRef.get();
    const playerData = playerDoc.data();

    // Calculate XP boost from active items
    const activeEffects = getActiveItemEffects(playerData.inventory);
    const xpMultiplier = calculateTotalBoost("global_xp", activeEffects);
    const boostedXP = Math.floor(amount * xpMultiplier);

    // Update the player's XP
    await playerRef.update({
      exp: firebase.firestore.FieldValue.increment(boostedXP),
    });

    // Update local stats
    playerStats.exp += boostedXP;

    if (xpMultiplier > 1) {
      printToTerminal(
        `Gained ${boostedXP} XP! (${amount} × ${xpMultiplier.toFixed(
          2
        )} boost)`,
        "success"
      );
    } else {
      printToTerminal(`Gained ${boostedXP} XP!`, "success");
    }

    // Check for level up
    await checkLevelUp(playerRef, playerStats.exp);
    updateStatusBar();
  } catch (error) {
    printToTerminal(
      "Error adding experience points: " + error.message,
      "error"
    );
  }
}

// Add function to use consumable items
async function useItem(itemId) {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  const playerRef = db.collection("players").doc(currentUser.uid);
  const playerDoc = await playerRef.get();
  const playerData = playerDoc.data();

  // Find the item in the player's inventory
  const inventoryItem = playerData.inventory.find((item) => item.id === itemId);
  if (!inventoryItem) {
    printToTerminal("Item not found in your inventory.", "error");
    return;
  }

  const item = Object.values(ITEMS).find((item) => item.id === itemId);
  if (!item) {
    printToTerminal("Invalid item.", "error");
    return;
  }

  try {
    // Handle different item effects
    switch (item.effect.type) {
      case "name_color":
        const selectedColor = await showColorPickerDialog();
        if (selectedColor) {
          await playerRef.update({
            "profile.nameColor": selectedColor,
            inventory: firebase.firestore.FieldValue.arrayRemove(inventoryItem),
          });
          printToTerminal(
            `Used ${item.name} and changed your name color to ${selectedColor}!`,
            "success"
          );
          // Update local playerStats
          if (!playerStats.profile) playerStats.profile = {};
          playerStats.profile.nameColor = selectedColor;
          // Update all windows that show the player's name
          windowSystem.updateWindowContent("profileWindow");
          windowSystem.updateWindowContent("leaderboardWindow");
        }
        break;

      case "gold":
        await playerRef.update({
          gold: firebase.firestore.FieldValue.increment(item.effect.value),
          inventory: firebase.firestore.FieldValue.arrayRemove(inventoryItem),
        });
        playerStats.gold += item.effect.value;
        printToTerminal(
          `Used ${item.name} and gained ${item.effect.value} gold!`,
          "success"
        );
        break;

      case "complete_quest":
      case "reset_daily":
      case "remove_fatigue":
        // These items are handled by their respective functions
        // They should be called here when implemented
        printToTerminal(`Used ${item.name}!`, "success");
        break;

      default:
        // For items with duration-based effects, they're automatically applied
        // through the getActiveItemEffects function
        printToTerminal(`${item.name} is already active!`, "info");
        return;
    }

    // Update UI
    updateStatusBar();
    windowSystem.updateWindowContent("inventoryWindow");
  } catch (error) {
    printToTerminal("Error using item: " + error.message, "error");
  }
}

// Modify the updateInventoryWindow to add "Use" buttons for usable items
async function updateInventoryWindow() {
  if (!currentUser) return;
  try {
    const playerRef = db.collection("players").doc(currentUser.uid);
    const player = (await playerRef.get()).data();
    const inventoryList = document.getElementById("inventoryItemsList");
    inventoryList.innerHTML = "";

    if (!player.inventory || player.inventory.length === 0) {
      inventoryList.innerHTML =
        '<div class="window-item">Your inventory is empty</div>';
      return;
    }

    player.inventory.forEach((inventoryItem) => {
      const item = Object.values(ITEMS).find(
        (item) => item.id === inventoryItem.id
      );
      if (item) {
        const itemElement = document.createElement("div");
        itemElement.className = "window-item";
        let timeLeft = "";
        if (inventoryItem.expiresAt) {
          const remaining = inventoryItem.expiresAt - Date.now();
          if (remaining > 0) {
            timeLeft = `Time remaining: ${Math.ceil(
              remaining / 60000
            )} minutes`;
          }
        }
        itemElement.innerHTML = `
            <div class="window-item-title">${item.name}</div>
            <div class="window-item-description">${item.description}</div>
            ${
              timeLeft
                ? `<div class="window-item-description">${timeLeft}</div>`
                : ""
            }
            ${
              !timeLeft &&
              item.effect.type !== "permanent_xp" &&
              item.effect.type !== "all_stats"
                ? `<button onclick="useItem('${item.id}')" class="shop-button">Use</button>`
                : ""
            }
          `;
        inventoryList.appendChild(itemElement);
      }
    });
  } catch (error) {
    console.error("Error updating inventory window:", error);
  }
}

// Make functions available to the window
window.useItem = useItem;

// Add rank system constants
const RANK_SYSTEM = {
  E: {
    name: "E Rank",
    requirements: {
      level: 1,
      questsCompleted: 0,
      achievements: 0,
    },
    color: "#808080", // Gray
  },
  D: {
    name: "D Rank",
    requirements: {
      level: 5,
      questsCompleted: 10,
      achievements: 3,
    },
    color: "#CD7F32", // Bronze
  },
  C: {
    name: "C Rank",
    requirements: {
      level: 10,
      questsCompleted: 25,
      achievements: 7,
    },
    color: "#C0C0C0", // Silver
  },
  B: {
    name: "B Rank",
    requirements: {
      level: 20,
      questsCompleted: 50,
      achievements: 12,
    },
    color: "#FFD700", // Gold
  },
  A: {
    name: "A Rank",
    requirements: {
      level: 35,
      questsCompleted: 100,
      achievements: 20,
    },
    color: "#E5E4E2", // Platinum
  },
  S: {
    name: "S Rank",
    requirements: {
      level: 50,
      questsCompleted: 200,
      achievements: 30,
    },
    color: "#B9F2FF", // Diamond
  },
};

// Add function to check rank progress
function checkRankProgress(player) {
  const currentRank = player.rank || "E";
  const nextRank = RANKS[RANKS.indexOf(currentRank) + 1];

  // If player is at max rank, return early
  if (!nextRank) {
    return {
      currentRank,
      nextRank: null,
      progress: {
        level: 100,
        quests: 100,
        achievements: 100,
        overall: 100,
      },
    };
  }

  // Get requirements for next rank
  const nextRankReqs = RANK_REQUIREMENTS[nextRank];

  // Calculate progress percentages
  const levelProgress = Math.min(
    100,
    ((player.level || 1) / nextRankReqs.level) * 100
  );
  const questProgress = Math.min(
    100,
    ((player.questsCompleted || 0) / nextRankReqs.quests) * 100
  );
  const achievementProgress = Math.min(
    100,
    ((player.achievements?.length || 0) / nextRankReqs.achievements) * 100
  );
  const overallProgress = Math.min(
    100,
    (levelProgress + questProgress + achievementProgress) / 3
  );

  return {
    currentRank,
    nextRank,
    progress: {
      level: Math.round(levelProgress),
      quests: Math.round(questProgress),
      achievements: Math.round(achievementProgress),
      overall: Math.round(overallProgress),
    },
    requirements: nextRankReqs,
    currentValues: {
      level: player.level || 1,
      questsCompleted: player.questsCompleted || 0,
      achievements: player.achievements?.length || 0,
    },
  };
}

// Add function to show rank progress window
async function showRankProgress() {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  try {
    const playerRef = db.collection("players").doc(currentUser.uid);
    const player = (await playerRef.get()).data();
    const rankProgress = checkRankProgress(player);

    const rankProgressContent = document.getElementById("rankProgressContent");
    rankProgressContent.innerHTML = `
      <div class="window-section">
        ${
          rankProgress.nextRank
            ? `
            <div class="rank-info">
              <div class="current-rank">
                <div class="rank-circle">${rankProgress.currentRank}</div>
                <div class="rank-label">Current Rank</div>
              </div>
              <div class="rank-arrow">→</div>
              <div class="next-rank">
                <div class="rank-circle next">${rankProgress.nextRank}</div>
                <div class="rank-label">Next Rank</div>
              </div>
            </div>

            <div class="requirements-section">
              <div class="requirement-item">
                <div class="requirement-header">
                  <span class="requirement-title">Level</span>
                  <span class="requirement-value">${rankProgress.currentValues.level}/${rankProgress.requirements.level}</span>
              </div>
              <div class="window-item-progress">
                  <div class="window-item-progress-bar" style="width: ${rankProgress.progress.level}%"></div>
              </div>
            </div>

              <div class="requirement-item">
                <div class="requirement-header">
                  <span class="requirement-title">Quests Completed</span>
                  <span class="requirement-value">${rankProgress.currentValues.questsCompleted}/${rankProgress.requirements.quests}</span>
              </div>
              <div class="window-item-progress">
                  <div class="window-item-progress-bar" style="width: ${rankProgress.progress.quests}%"></div>
              </div>
            </div>

              <div class="requirement-item">
                <div class="requirement-header">
                  <span class="requirement-title">Achievements</span>
                  <span class="requirement-value">${rankProgress.currentValues.achievements}/${rankProgress.requirements.achievements}</span>
              </div>
              <div class="window-item-progress">
                  <div class="window-item-progress-bar" style="width: ${rankProgress.progress.achievements}%"></div>
              </div>
            </div>

              <div class="requirement-item overall">
                <div class="requirement-header">
                  <span class="requirement-title">Overall Progress</span>
                  <span class="requirement-value">${rankProgress.progress.overall}%</span>
              </div>
              <div class="window-item-progress">
                  <div class="window-item-progress-bar" style="width: ${rankProgress.progress.overall}%"></div>
              </div>
            </div>
          </div>
        `
            : `
            <div class="max-rank-message">
              <div class="rank-circle max">${rankProgress.currentRank}</div>
              <div class="max-rank-text">
              Congratulations! You have reached the maximum rank!
            </div>
          </div>
        `
        }
      </div>
    `;

    // Add CSS if not already present
    if (!document.getElementById("rankProgressStyles")) {
      const styleSheet = document.createElement("style");
      styleSheet.id = "rankProgressStyles";
      styleSheet.textContent = `
        .rank-info {
          display: flex;
          justify-content: center;
          align-items: center;
          margin-bottom: 30px;
          gap: 20px;
        }
        .rank-circle {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: linear-gradient(135deg, #0088ff, #00ffff);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          font-weight: bold;
          color: #fff;
          text-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
          border: 2px solid #00ffff;
          box-shadow: 0 0 15px rgba(0, 136, 255, 0.3);
        }
        .rank-circle.next {
          background: linear-gradient(135deg, #4CAF50, #8BC34A);
          border-color: #8BC34A;
        }
        .rank-circle.max {
          background: linear-gradient(135deg, #FFD700, #FFA500);
          border-color: #FFD700;
          width: 80px;
          height: 80px;
          font-size: 32px;
        }
        .rank-arrow {
          font-size: 24px;
          color: #00ffff;
          text-shadow: 0 0 10px rgba(0, 255, 255, 0.3);
        }
        .rank-label {
          text-align: center;
          margin-top: 8px;
          color: #88ccff;
          font-size: 0.9em;
        }
        .requirements-section {
          display: flex;
          flex-direction: column;
          gap: 15px;
          padding: 15px;
          background: rgba(0, 16, 32, 0.5);
          border-radius: 8px;
          border: 1px solid rgba(0, 136, 255, 0.3);
        }
        .requirement-item {
          background: rgba(0, 16, 32, 0.7);
          padding: 12px;
          border-radius: 6px;
          border: 1px solid rgba(0, 136, 255, 0.2);
        }
        .requirement-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          color: #fff;
        }
        .requirement-title {
          color: #00ffff;
          font-weight: bold;
        }
        .requirement-value {
          color: #88ccff;
        }
        .requirement-item.overall {
          background: rgba(0, 136, 255, 0.1);
          border-color: #00ffff;
        }
        .max-rank-message {
          text-align: center;
          padding: 20px;
        }
        .max-rank-text {
          margin-top: 15px;
          color: #FFD700;
          font-size: 1.2em;
          text-shadow: 0 0 10px rgba(255, 215, 0, 0.3);
        }
      `;
      document.head.appendChild(styleSheet);
    }

    // Show the window using the window system
    windowSystem.showWindow("rankProgressWindow");
  } catch (error) {
    console.error("Error showing rank progress:", error);
    printToTerminal("Error showing rank progress: " + error.message, "error");
  }
}

// Add function to check and update rank
async function checkAndUpdateRank(playerRef, player) {
  const rankProgress = checkRankProgress(player);
  if (rankProgress.nextRank && rankProgress.progress.overall >= 100) {
    const newRank = rankProgress.nextRank;

    await playerRef.update({
      rank: newRank,
    });

    // Update local stats
    playerStats.rank = newRank;

    // Show rank up message
    showNotification(`🎉 Ranked Up to ${newRank} Rank! 🎉`);
    printToTerminal(`\n=== RANK UP! ===`, "success");
    printToTerminal(
      `Congratulations! You've achieved ${newRank} Rank!`,
      "success"
    );
    printToTerminal(`Keep up the great work!`, "success");

    // Update UI
    updateStatusBar();
    windowSystem.updateWindowContent("profileWindow");

    // Check for rank-related achievements
    await checkAchievements();

    return true;
  }
  return false;
}

// Make functions available to the window
window.showRankProgress = showRankProgress;

// Add rank command handler
async function handleRankCommand() {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  const playerRef = db.collection("players").doc(currentUser.uid);
  const player = (await playerRef.get()).data();
  const rankProgress = checkRankProgress(player);

  printToTerminal("\n=== RANK STATUS ===", "system");
  printToTerminal(`Current Rank: ${player.rank}`, "info");

  if (rankProgress.nextRank) {
    printToTerminal(`Next Rank: ${rankProgress.nextRank}`, "info");
    printToTerminal("\nRequirements for next rank:", "info");
    printToTerminal(
      `Level: ${rankProgress.currentValues.level}/${
        rankProgress.requirements.level
      } (${Math.floor(rankProgress.progress.level)}%)`,
      "info"
    );
    printToTerminal(
      `Quests: ${rankProgress.currentValues.questsCompleted}/${
        rankProgress.requirements.questsCompleted
      } (${Math.floor(rankProgress.progress.quests)}%)`,
      "info"
    );
    printToTerminal(
      `Achievements: ${rankProgress.currentValues.achievements}/${
        rankProgress.requirements.achievements
      } (${Math.floor(rankProgress.progress.achievements)}%)`,
      "info"
    );
    printToTerminal(
      `\nOverall Progress: ${Math.floor(rankProgress.progress.overall)}%`,
      "success"
    );
  } else {
    printToTerminal("Maximum rank achieved!", "success");
  }

  printToTerminal(
    "\nTip: Use !rankprogress to open detailed rank progress window",
    "system"
  );
}

function showBossBattles() {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }
  windowSystem.showWindow("BattleWindow");
}

// Add boss battle penalties
const BOSS_PENALTIES = {
  exp: -100,
  gold: -50,
};

// Add function to handle boss battle timeout
async function handleBossBattleTimeout(playerRef, bossId, battle) {
  try {
    // Apply penalties
    await playerRef.update({
      exp: firebase.firestore.FieldValue.increment(BOSS_PENALTIES.exp),
      gold: firebase.firestore.FieldValue.increment(BOSS_PENALTIES.gold),
    });

    // Update local stats
    playerStats.exp = Math.max(0, playerStats.exp + BOSS_PENALTIES.exp);
    playerStats.gold = Math.max(0, playerStats.gold + BOSS_PENALTIES.gold);

    // Delete the failed battle
    await playerRef.collection("activeBattles").doc(bossId).delete();

    // Show failure message
    printToTerminal(`\n⚠️ Boss Battle Failed: ${battle.bossName}`, "error");
    printToTerminal(`Time's up! You've suffered penalties:`, "error");
    printToTerminal(`${BOSS_PENALTIES.exp} XP`, "error");
    printToTerminal(`${BOSS_PENALTIES.gold} Gold`, "error");

    // Update UI
    updateStatusBar();
    windowSystem.updateWindowContent("BattleWindow");
  } catch (error) {
    console.error("Error handling boss battle timeout:", error);
  }
}

// Update updateBattleWindow to include defeat counts and progress input
async function updateBattleWindow() {
  if (!currentUser) return;
  try {
    const bossBattlesList = document.getElementById("bossBattlesList");
    bossBattlesList.innerHTML = "";

    // Get player's active battles and defeated bosses
    const playerRef = db.collection("players").doc(currentUser.uid);
    const playerDoc = await playerRef.get();
    const defeatedBosses = playerDoc.data()?.defeatedBosses || {};

    const activeBattlesRef = playerRef.collection("activeBattles");
    const activeBattles = await activeBattlesRef.get();
    const activeBattleMap = new Map();

    activeBattles.forEach((doc) => {
      const battle = doc.data();
      activeBattleMap.set(doc.id, battle);

      // Check for timeout
      const now = new Date();
      const endTime = battle.endTime.toDate();
      if (now > endTime) {
        handleBossBattleTimeout(playerRef, doc.id, battle);
        activeBattleMap.delete(doc.id);
      }
    });

    // Display available boss battles
    Object.entries(BOSSES).forEach(([bossKey, boss]) => {
      const defeatCount = defeatedBosses[boss.id] || 0;
      const activeBattle = activeBattleMap.get(boss.id);
      const bossElement = document.createElement("div");
      bossElement.className = "window-item";

      bossElement.innerHTML = `
        <div class="window-item-title">
          ${boss.name}
          ${
            defeatCount > 0
              ? `<span class="defeat-count">💀 ${defeatCount}</span>`
              : ""
          }
          ${
            activeBattle
              ? '<span class="active-battle-badge">⚔️ In Progress</span>'
              : ""
          }
        </div>
        <div class="window-item-description">${boss.description}</div>
        <div class="window-item-description">
          Target: ${boss.currentCount} ${boss.metric}
          <br>Time Limit: ${formatTimeLimit(boss.timeLimit)}
          ${
            defeatCount > 0
              ? `<br>Scaling: +${boss.scaling.targetCount} ${boss.metric} per defeat`
              : ""
          }
        </div>
        <div class="window-item-description">
          Rewards:
          <br>- ${boss.rewards.exp + defeatCount * boss.scaling.rewards.exp} XP
          <br>- ${
            boss.rewards.gold + defeatCount * boss.scaling.rewards.gold
          } Gold
          <br>- Title: ${boss.rewards.title}
        </div>
        ${
          activeBattle
            ? `
          <div class="window-item-progress">
            <div class="progress-input">
              <label>Current Progress:</label>
              <input type="number" 
                     value="${activeBattle.currentCount}"
                     min="0"
                     max="${boss.targetCount}"
                     onchange="updateBattleProgress(['${boss.id}', this.value])"
                     style="width: 80px; margin: 0 10px; background: transparent; color: var(--text-color); border: 1px solid var(--system-blue);">
                  /${boss.targetCount} ${boss.metric}
            </div>
            <div class="battle-time-remaining">
              Time Remaining: ${formatTimeRemaining(
                activeBattle.endTime.toDate() - new Date()
              )}
            </div>
            <div class="window-item-progress-bar" style="width: ${
              (activeBattle.currentCount / boss.targetCount) * 100
            }%"></div>
          </div>
        `
            : ""
        }
        <div class="window-actions">
          <button class="window-button" 
                  onclick="startBossBattle(['${boss.id}'])"
                  ${activeBattle ? "disabled" : ""}>
            ${activeBattle ? "Battle in Progress" : "Start Battle"}
          </button>
        </div>
      `;

      bossBattlesList.appendChild(bossElement);
    });
  } catch (error) {
    console.error("Error updating boss battles window:", error);
  }
}

// Update startBossBattle to handle scaling
async function startBossBattle(args) {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  if (!args || args.length === 0) {
    printToTerminal("Usage: !challenge <boss_id>", "warning");
    printToTerminal("Example: !challenge step_master", "info");
    return;
  }

  const bossId = args[0];
  const boss = Object.values(BOSSES).find((b) => b.id === bossId);
  if (!boss) {
    printToTerminal("Invalid boss battle ID.", "error");
    return;
  }

  try {
    const playerRef = db.collection("players").doc(currentUser.uid);
    const player = (await playerRef.get()).data();
    const defeatCount = player.defeatedBosses?.[bossId] || 0;

    // Calculate scaled target and rewards
    const scaledTarget =
      boss.baseTargetCount + defeatCount * boss.scaling.targetCount;
    const scaledExp = boss.rewards.exp + defeatCount * boss.scaling.rewards.exp;
    const scaledGold =
      boss.rewards.gold + defeatCount * boss.scaling.rewards.gold;

    // Start the battle
    const now = new Date();
    const endTime = new Date(now.getTime() + boss.timeLimit);

    await playerRef
      .collection("activeBattles")
      .doc(bossId)
      .set({
        bossId,
        bossName: boss.name,
        currentCount: 0,
        targetCount: scaledTarget,
        startTime: firebase.firestore.Timestamp.fromDate(now),
        endTime: firebase.firestore.Timestamp.fromDate(endTime),
        completed: false,
      });

    printToTerminal(`\n🗡️ Boss Battle Started: ${boss.name}`, "success");
    printToTerminal(`Target: ${scaledTarget} ${boss.metric}`, "info");
    printToTerminal(`Time Limit: ${formatTimeLimit(boss.timeLimit)}`, "info");
    printToTerminal(`\nRewards if victorious:`, "reward");
    printToTerminal(`- ${scaledExp} XP`, "reward");
    printToTerminal(`- ${scaledGold} Gold`, "reward");
    printToTerminal(`- Title: ${boss.rewards.title}`, "reward");

    windowSystem.updateWindowContent("BattleWindow");
  } catch (error) {
    printToTerminal("Error starting boss battle: " + error.message, "error");
  }
}

// Update updateBattleProgress to handle victory and scaling
async function updateBattleProgress(args) {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  if (!args || args.length < 2) {
    printToTerminal("Usage: !progress <boss_id> <amount>", "warning");
    printToTerminal("Example: !progress step_master 1000", "info");
    return;
  }

  const [bossId, amount] = args;
  const boss = Object.values(BOSSES).find((b) => b.id === bossId);
  if (!boss) {
    printToTerminal("Invalid boss battle ID.", "error");
    return;
  }

  try {
    const playerRef = db.collection("players").doc(currentUser.uid);
    const activeBattleRef = playerRef.collection("activeBattles").doc(bossId);
    const activeBattle = await activeBattleRef.get();

    if (!activeBattle.exists) {
      printToTerminal("You haven't started this boss battle yet!", "error");
      printToTerminal(`Use !challenge ${bossId} to start`, "info");
      return;
    }

    const battle = activeBattle.data();
    const now = new Date();
    const endTime = battle.endTime.toDate();

    if (now > endTime) {
      await handleBossBattleTimeout(playerRef, bossId, battle);
      return;
    }

    const newCount =
      amount === "complete" ? battle.targetCount : parseInt(amount);
    if (isNaN(newCount)) {
      printToTerminal("Please provide a valid number.", "error");
      return;
    }

    if (newCount >= battle.targetCount && !battle.completed) {
      // Boss defeated!
      const player = (await playerRef.get()).data();
      const defeatCount = player.defeatedBosses?.[bossId] || 0;

      // Calculate scaled rewards
      const scaledExp =
        boss.rewards.exp + defeatCount * boss.scaling.rewards.exp;
      const scaledGold =
        boss.rewards.gold + defeatCount * boss.scaling.rewards.gold;

      // Update defeat count
      const defeatedBossesUpdate = {
        [`defeatedBosses.${bossId}`]:
          firebase.firestore.FieldValue.increment(1),
      };

      // Award rewards
      await playerRef.update({
        exp: firebase.firestore.FieldValue.increment(scaledExp),
        gold: firebase.firestore.FieldValue.increment(scaledGold),
        "profile.title": boss.rewards.title,
        ...defeatedBossesUpdate,
      });

      // Update local stats
      playerStats.exp += scaledExp;
      playerStats.gold += scaledGold;
      playerStats.profile.title = boss.rewards.title;
      if (!playerStats.defeatedBosses) playerStats.defeatedBosses = {};
      playerStats.defeatedBosses[bossId] =
        (playerStats.defeatedBosses[bossId] || 0) + 1;

      // Delete completed battle
      await activeBattleRef.delete();

      printToTerminal(`\n🎉 BOSS DEFEATED: ${boss.name}! 🎉`, "success");
      printToTerminal(`This was defeat #${defeatCount + 1}!`, "success");
      printToTerminal(`Rewards earned:`, "reward");
      printToTerminal(`- ${scaledExp} XP`, "reward");
      printToTerminal(`- ${scaledGold} Gold`, "reward");
      printToTerminal(`- New Title: ${boss.rewards.title}`, "reward");
      printToTerminal(`\nNext time the boss will be stronger:`, "info");
      printToTerminal(
        `- Target: +${boss.scaling.targetCount} ${boss.metric}`,
        "info"
      );
      printToTerminal(
        `- Rewards: +${boss.scaling.rewards.exp} XP, +${boss.scaling.rewards.gold} Gold`,
        "info"
      );
    } else {
      // Update progress
      await activeBattleRef.update({
        currentCount: newCount,
      });
    }

    // Check for level up and achievements
    await checkLevelUp(playerRef, playerStats.exp);
    await checkAchievements();
    updateStatusBar();
    windowSystem.updateWindowContent("BattleWindow");
  } catch (error) {
    printToTerminal(
      "Error updating battle progress: " + error.message,
      "error"
    );
  }
}

// Calculate sell price for items (50% of original price)
function calculateSellPrice(item) {
  return Math.floor(item.price * 0.5);
}

// Add function to sell an item
async function sellItem(itemId) {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  const playerRef = db.collection("players").doc(currentUser.uid);
  const playerDoc = await playerRef.get();
  const playerData = playerDoc.data();

  // Find the item in the player's inventory
  const inventoryItem = playerData.inventory.find((item) => item.id === itemId);
  if (!inventoryItem) {
    printToTerminal("Item not found in your inventory.", "error");
    return;
  }

  const item = Object.values(ITEMS).find((item) => item.id === itemId);
  if (!item) {
    printToTerminal("Invalid item.", "error");
    return;
  }

  try {
    const sellPrice = calculateSellPrice(item);

    // Remove item from inventory and add gold
    await playerRef.update({
      gold: firebase.firestore.FieldValue.increment(sellPrice),
      inventory: firebase.firestore.FieldValue.arrayRemove(inventoryItem),
    });

    // Update local stats
    playerStats.gold += sellPrice;
    playerStats.inventory = playerStats.inventory.filter(
      (item) => item.id !== itemId
    );

    // Play sell sound
    notificationSystem.playSound("sell");

    printToTerminal(
      `Sold ${item.name} for ${sellPrice} gold! (50% of original price)`,
      "success"
    );
    showNotification(`Sold ${item.name} for ${sellPrice} gold!`);

    updateStatusBar();
    windowSystem.updateWindowContent("inventoryWindow");
  } catch (error) {
    printToTerminal("Error selling item: " + error.message, "error");
  }
}

// Add function to show color picker dialog
async function showColorPickerDialog() {
  return new Promise((resolve) => {
    const dialog = document.createElement("div");
    dialog.className = "color-picker-dialog";
    dialog.innerHTML = `
      <div class="color-picker-content">
        <h3>Choose Your Name Color</h3>
        <input type="color" id="colorPicker" value="#00ffff">
        <div class="color-picker-actions">
          <button class="window-button" id="confirmColor">Confirm</button>
          <button class="window-button" id="cancelColor">Cancel</button>
        </div>
      </div>
    `;

    // Add CSS if not already present
    if (!document.getElementById("colorPickerStyles")) {
      const styleSheet = document.createElement("style");
      styleSheet.id = "colorPickerStyles";
      styleSheet.textContent = `
        .color-picker-dialog {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 10000;
        }
        .color-picker-content {
          background: rgba(0, 16, 32, 0.95);
          border: 1px solid #0088ff;
          border-radius: 4px;
          padding: 20px;
          text-align: center;
        }
        .color-picker-content h3 {
          color: #00ffff;
          margin-bottom: 15px;
        }
        .color-picker-actions {
          margin-top: 15px;
          display: flex;
          gap: 10px;
          justify-content: center;
        }
        #colorPicker {
          width: 100px;
          height: 40px;
          padding: 0;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
      `;
      document.head.appendChild(styleSheet);
    }

    document.body.appendChild(dialog);

    const colorPicker = dialog.querySelector("#colorPicker");
    const confirmBtn = dialog.querySelector("#confirmColor");
    const cancelBtn = dialog.querySelector("#cancelColor");

    confirmBtn.addEventListener("click", () => {
      const color = colorPicker.value;
      document.body.removeChild(dialog);
      resolve(color);
    });

    cancelBtn.addEventListener("click", () => {
      document.body.removeChild(dialog);
      resolve(null);
    });
  });
}

// Define ranks and their requirements
const RANKS = ["E", "D", "C", "B", "A", "S"];

const RANK_REQUIREMENTS = {
  D: {
    level: 5,
    quests: 10,
    achievements: 3,
  },
  C: {
    level: 10,
    quests: 25,
    achievements: 5,
  },
  B: {
    level: 20,
    quests: 50,
    achievements: 10,
  },
  A: {
    level: 35,
    quests: 100,
    achievements: 15,
  },
  S: {
    level: 50,
    quests: 200,
    achievements: 25,
  },
};

function checkRankProgress(player) {
  const currentRank = player.rank || "E";
  const nextRank = RANKS[RANKS.indexOf(currentRank) + 1];

  // If player is at max rank, return early
  if (!nextRank) {
    return {
      currentRank,
      nextRank: null,
      progress: {
        level: 100,
        quests: 100,
        achievements: 100,
        overall: 100,
      },
    };
  }

  // Get requirements for next rank
  const nextRankReqs = RANK_REQUIREMENTS[nextRank];

  // Calculate progress percentages
  const levelProgress = Math.min(
    100,
    ((player.level || 1) / nextRankReqs.level) * 100
  );
  const questProgress = Math.min(
    100,
    ((player.questsCompleted || 0) / nextRankReqs.quests) * 100
  );
  const achievementProgress = Math.min(
    100,
    ((player.achievements?.length || 0) / nextRankReqs.achievements) * 100
  );
  const overallProgress = Math.min(
    100,
    (levelProgress + questProgress + achievementProgress) / 3
  );

  return {
    currentRank,
    nextRank,
    progress: {
      level: Math.round(levelProgress),
      quests: Math.round(questProgress),
      achievements: Math.round(achievementProgress),
      overall: Math.round(overallProgress),
    },
    requirements: nextRankReqs,
    currentValues: {
      level: player.level || 1,
      questsCompleted: player.questsCompleted || 0,
      achievements: player.achievements?.length || 0,
    },
  };
}

// Add speech recognition system
const speechRecognitionSystem = {
  recognition: null,
  isListening: false,
  isActivated: false,

  init() {
    console.log("Initializing speech recognition system...");
    if (
      !("webkitSpeechRecognition" in window) &&
      !("SpeechRecognition" in window)
    ) {
      console.warn("Speech recognition not supported in this browser");
      return;
    }

    // Initialize speech recognition
    this.recognition = new (window.SpeechRecognition ||
      window.webkitSpeechRecognition)();
    this.recognition.continuous = true;
    this.recognition.interimResults = false;
    this.recognition.lang = "en-US";

    console.log("Speech recognition object created:", this.recognition);

    // Store the recognized text for use in onend
    this.lastRecognizedText = "";

    // Handle recognition results
    this.recognition.onresult = (event) => {
      console.log("Speech recognition event received:", event);
      const text = event.results[event.results.length - 1][0].transcript
        .toLowerCase()
        .trim();
      console.log("Speech recognized:", text);

      // Check for activation phrase
      if (!this.isActivated && text.includes("activate voice")) {
        console.log("Activation phrase detected!");
        this.isActivated = true;
        notificationSystem.playSound("activated");
        showNotification("Voice commands activated!", "success");
        this.updateMicButton();
        return;
      }

      // If not activated, ignore all other commands
      if (!this.isActivated) return;

      // Convert and send command immediately when we get a result
      let command = text
        // Remove any "exclamation mark" or "exclamation point" prefix
        .replace(/^(exclamation mark|exclamation point|exclamation)\s+/i, "")
        // Convert common speech patterns to commands
        .replace(/^(show|display|open|view)\s+(my\s+)?(the\s+)?/i, "")
        .replace(/^(go\s+to|navigate\s+to)\s+/i, "")
        // Check for deactivation phrase
        .replace(/^(deactivate|disable)\s+voice$/i, "deactivatevoice")
        // Convert multi-word commands to single words
        .replace(/daily\s+quests?/i, "dailyquests")
        .replace(/daily\s+quest/i, "dailyquest")
        .replace(/boss\s+battles?/i, "bossbattle")
        .replace(/water\s+status/i, "waterstatus")
        .replace(/work\s+out/i, "workout")
        .replace(/add\s+quest/i, "addquest")
        .replace(/show\s+quests?/i, "quests")
        .replace(/show\s+profile/i, "profile")
        .replace(/show\s+inventory/i, "inventory")
        .replace(/show\s+achievements?/i, "achievements")
        .replace(/show\s+leaderboard/i, "leaderboard")
        .replace(/clear\s+terminal/i, "clear")
        // Remove all spaces
        .replace(/\s+/g, "")
        // Add exclamation mark if not present
        .replace(/^(?!!)/i, "!");

      console.log("Processed command:", command);

      // Check for deactivation
      if (command === "!deactivatevoice") {
        this.isActivated = false;
        showNotification(
          "Voice commands deactivated. Say 'activate voice' to enable again.",
          "warning"
        );
        this.updateMicButton();
        return;
      }

      // Don't process empty commands or just exclamation mark
      if (!command || command === "!" || command === "! ") {
        return;
      }

      // Handle window closing commands
      if (
        text.includes("close all window") ||
        text.includes("close all windows")
      ) {
        Object.keys(windowSystem.windows).forEach((windowId) => {
          windowSystem.closeWindow(windowId);
        });
        return;
      }

      // Handle specific window closing commands
      const windowCloseMatch = text.match(/close\s+(\w+)\s+window/i);
      if (windowCloseMatch) {
        const windowType = windowCloseMatch[1].toLowerCase();
        let windowId = null;

        // Map spoken window names to actual window IDs
        switch (windowType) {
          case "quest":
          case "quests":
            windowId = "questsWindow";
            break;
          case "shop":
            windowId = "shopWindow";
            break;
          case "inventory":
            windowId = "inventoryWindow";
            break;
          case "profile":
            windowId = "profileWindow";
            break;
          case "achievement":
          case "achievements":
            windowId = "achievementsWindow";
            break;
          case "leaderboard":
            windowId = "leaderboardWindow";
            break;
          case "boss":
          case "bosses":
          case "boss battle":
          case "boss battles":
            windowId = "BattleWindow";
            break;
          case "rank":
          case "rank progress":
            windowId = "rankProgressWindow";
            break;
        }

        if (windowId && windowSystem.windows[windowId]) {
          windowSystem.closeWindow(windowId);
        }
        return;
      }

      // Set the input value
      input.value = command;

      // Process the command directly
      if (commands[command]) {
        commands[command]();
      } else {
        printToTerminal(`Unknown command: ${command}`, "error");
        printToTerminal(
          "Try saying 'show commands' for available commands",
          "info"
        );
      }

      // Clear the input after processing
      setTimeout(() => {
        input.value = "";
      }, 100);
    };

    // Handle errors
    this.recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      this.lastRecognizedText = "";
      this.restartListening();
    };

    // Handle end of recognition
    this.recognition.onend = () => {
      this.restartListening();
    };

    // Start listening immediately
    this.startListening();

    // Add microphone button to UI
    this.addMicrophoneButton();
  },

  addMicrophoneButton() {
    const micButton = document.createElement("button");
    micButton.id = "micButton";
    micButton.innerHTML = '<i class="fas fa-microphone-slash"></i>';
    micButton.title = "Say 'activate voice' to enable voice commands";
    micButton.className = "mic-button";

    // Add styles if not already present
    if (!document.getElementById("micStyles")) {
      const styleSheet = document.createElement("style");
      styleSheet.id = "micStyles";
      styleSheet.textContent = `
        .mic-button {
          position: fixed;
          bottom: 54px;
          right: 15px;
          width: 50px;
          height: 50px;
          border-radius: 50%;
          background: #1a1a1a;
          border: 2px solid #0088ff;
          color: #fff;
          font-size: 17px;
          cursor: pointer;
          justify-content: center;
          display: flex;
          transition: all 0.3s ease;
          align-items: center;
          z-index: 9999;
          box-shadow: 0 0 10px rgba(0, 136, 255, 0.3);
          animation: float 2s ease-in-out infinite;
          opacity: 0.5;
        }
        .mic-button.activated {
          opacity: 1;
          border-color: #00ff88;
          background: #1a1a1a;
        }
        // ... existing styles ...
      `;
      document.head.appendChild(styleSheet);
    }

    document.body.appendChild(micButton);
  },

  startListening() {
    if (!this.recognition) return;

    try {
      console.log("Starting speech recognition...");
      this.recognition.start();
      this.isListening = true;
      console.log("Speech recognition started successfully");
    } catch (error) {
      console.error("Error starting speech recognition:", error);
    }
  },

  restartListening() {
    if (!this.recognition) return;

    try {
      console.log("Restarting speech recognition...");
      this.isListening = false;
      this.recognition.start();
      this.isListening = true;
      console.log("Speech recognition restarted successfully");
    } catch (error) {
      console.error("Error restarting speech recognition:", error);
      // Try again after a short delay
      setTimeout(() => this.startListening(), 1000);
    }
  },

  updateMicButton() {
    const micButton = document.getElementById("micButton");
    if (micButton) {
      if (this.isActivated) {
        micButton.classList.add("activated");
        micButton.title =
          "Voice commands active. Say 'deactivate voice' to disable";
        micButton.innerHTML = '<i class="fas fa-microphone"></i>';
      } else {
        micButton.classList.remove("activated");
        micButton.title = "Say 'activate voice' to enable voice commands";
        micButton.innerHTML = '<i class="fas fa-microphone-slash"></i>';
      }
    }
  },
};

// Initialize speech recognition system when the page loads
document.addEventListener("DOMContentLoaded", () => {
  console.log("Document loaded, initializing speech recognition...");
  speechRecognitionSystem.init();
});

// Add fuzzy matching utilities
const fuzzyMatch = {
  // Calculate Levenshtein distance between two strings
  levenshteinDistance(str1, str2) {
    const m = str1.length;
    const n = str2.length;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(
            dp[i - 1][j - 1] + 1,
            dp[i - 1][j] + 1,
            dp[i][j - 1] + 1
          );
        }
      }
    }
    return dp[m][n];
  },

  // Calculate similarity ratio between two strings
  similarity(str1, str2) {
    const maxLength = Math.max(str1.length, str2.length);
    const distance = this.levenshteinDistance(str1, str2);
    return (maxLength - distance) / maxLength;
  },

  // Find the best matching command
  findBestMatch(spokenCommand, availableCommands) {
    let bestMatch = null;
    let bestSimilarity = 0;
    const threshold = 0.6; // Minimum similarity threshold

    for (const command of availableCommands) {
      // Remove the ! prefix for comparison
      const cleanCommand = command.replace("!", "");
      const similarity = this.similarity(spokenCommand, cleanCommand);

      if (similarity > bestSimilarity && similarity >= threshold) {
        bestSimilarity = similarity;
        bestMatch = command;
      }
    }

    return { command: bestMatch, similarity: bestSimilarity };
  },
};

// Add these properties to the existing speechRecognitionSystem object
Object.assign(speechRecognitionSystem, {
  // Add common command variations
  commandVariations: {
    battle: ["battle", "bottle", "battles", "bottles", "battling", "fight"],
    quests: ["quest", "quests", "tasks", "missions", "objectives"],
    inventory: ["inventory", "items", "backpack", "stuff", "gear"],
    profile: ["profile", "stats", "status", "character"],
    achievements: ["achievements", "achieve", "badges", "trophies"],
    shop: ["shop", "store", "market", "buy"],
    leaderboard: ["leaderboard", "rankings", "leaders", "top players"],
    clear: ["clear", "clean", "reset", "wipe"],
    help: ["help", "commands", "options", "what can i do", "what to do"],
    dailyquests: ["daily quests", "daily tasks", "daily missions", "dailies"],
    waterDrank: ["water drank", "drink water", "water intake", "hydrate"],
    workout: ["workout", "exercise", "training", "work out", "train"],
    motivation: ["motivation", "motivate", "inspire", "encourage"],
  },

  // Add natural language patterns
  naturalPatterns: [
    { pattern: /^(show|display|open|view|go to|check|see)\s+/i, replace: "" },
    { pattern: /^(what are|what is|what's)\s+/i, replace: "show " },
    { pattern: /^(i want to|let me|can i|please)\s+/i, replace: "" },
    { pattern: /^(start|begin|initiate)\s+/i, replace: "" },
    { pattern: /my\s+/i, replace: "" },
    { pattern: /the\s+/i, replace: "" },
    { pattern: /window$/i, replace: "" },
    { pattern: /screen$/i, replace: "" },
    { pattern: /page$/i, replace: "" },
  ],

  processVoiceCommand(text) {
    console.log("Processing voice command:", text);

    // Clean up the text
    let processedText = text.toLowerCase().trim();

    // Apply natural language patterns
    this.naturalPatterns.forEach(({ pattern, replace }) => {
      processedText = processedText.replace(pattern, replace);
    });

    // Remove filler words
    processedText = processedText.replace(/\b(um|uh|like|so|yeah|well)\b/g, "");

    // Check for variations first
    for (const [baseCommand, variations] of Object.entries(
      this.commandVariations
    )) {
      if (variations.some((v) => processedText.includes(v))) {
        return `!${baseCommand}`;
      }
    }

    // If no direct match found, try fuzzy matching
    const availableCommands = Object.keys(commands);
    const cleanText = processedText.replace(/[^a-z0-9]/g, "");
    const { command: bestMatch, similarity } = fuzzyMatch.findBestMatch(
      cleanText,
      availableCommands
    );

    if (bestMatch) {
      console.log(
        `Fuzzy matched "${processedText}" to "${bestMatch}" with similarity ${similarity}`
      );
      return bestMatch;
    }

    return null;
  },
});

// Update the onresult handler in the init method
const originalInit = speechRecognitionSystem.init;
speechRecognitionSystem.init = function () {
  originalInit.call(this);

  this.recognition.onresult = (event) => {
    console.log("Speech recognition event received:", event);
    const text = event.results[event.results.length - 1][0].transcript
      .toLowerCase()
      .trim();
    console.log("Speech recognized:", text);

    // Check for activation/deactivation phrases
    if (!this.isActivated && text.includes("activate voice")) {
      this.isActivated = true;
      notificationSystem.playSound("activated");
      showNotification(
        "Voice commands activated! You can now speak commands.",
        "success"
      );
      this.updateMicButton();
      return;
    }

    if (!this.isActivated) return;

    if (text.includes("deactivate voice") || text.includes("disable voice")) {
      this.isActivated = false;
      showNotification(
        "Voice commands deactivated. Say 'activate voice' to enable again.",
        "warning"
      );
      this.updateMicButton();
      return;
    }

    // Process the command
    const command = this.processVoiceCommand(text);

    if (command) {
      // Show visual feedback
      input.value = command;

      // Execute the command
      if (commands[command]) {
        commands[command]();
        showNotification(`Executing: ${command}`, "success");
      } else {
        printToTerminal(`Command not recognized: ${text}`, "error");
        showNotification("Command not recognized. Try again.", "error");
      }

      // Clear the input after processing
      setTimeout(() => {
        input.value = "";
      }, 100);
    }
  };
};

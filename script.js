import { BOSSES } from "./js/bosses.js";


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

// Timer Management System
const timerSystem = {
  timers: new Map(),
  isInitialized: false,
  
  startTimer(id, updateFn, interval = 1000) {
    // Don't start if already running
    if (this.timers.has(id)) {
      return this.timers.get(id);
    }
    
    // Start new timer
    const timerId = setInterval(updateFn, interval);
    this.timers.set(id, timerId);
    return timerId;
  },

  stopTimer(id) {
    if (this.timers.has(id)) {
      clearInterval(this.timers.get(id));
      this.timers.delete(id);
    }
  },

  stopAllTimers() {
    this.timers.forEach((timerId) => clearInterval(timerId));
    this.timers.clear();
    this.isInitialized = false;
  },

  hasActiveTimer(id) {
    return this.timers.has(id);
  }
};

// Timer initialization and cleanup
function initializeTimers() {
  // Only initialize if not already running
  if (timerSystem.isInitialized) return;
  
  // Start battle timers if not already running
  if (!timerSystem.hasActiveTimer('battleTimers')) {
    timerSystem.startTimer('battleTimers', updateBattleTimers);
  }
  
  // Start daily quest timers if not already running
  if (!timerSystem.hasActiveTimer('questTimers')) {
    timerSystem.startTimer('questTimers', updateDailyQuestTimers);
  }
  
  // Start water intake reset check if not already running
  if (!timerSystem.hasActiveTimer('waterCheck')) {
    timerSystem.startTimer('waterCheck', checkWaterIntakeReset, 60000); // Check every minute
  }
  
  timerSystem.isInitialized = true;
}

// Timer update functions
function updateBattleTimers() {
  if (!currentUser) return;
  
  const timeElements = document.querySelectorAll('.battle-time-remaining');
  timeElements.forEach(element => {
    const endTimeStr = element.dataset.endTime;
    if (!endTimeStr) return;
    
    const endTime = new Date(endTimeStr);
    const now = new Date();
    const remaining = endTime - now;
    
    if (remaining <= 0) {
      element.textContent = "Time's up!";
      // Handle battle timeout
      const bossId = element.dataset.bossId;
      if (bossId) {
        handleBossBattleTimeout(db.collection("players").doc(currentUser.uid), bossId);
      }
    } else {
      element.textContent = `Time Remaining: ${formatTimeRemaining(remaining)}`;
    }
  });
}

function updateDailyQuestTimers() {
  if (!currentUser) return;
  
  const centralTimer = document.getElementById("centralDailyTimer");
  if (!centralTimer) return;
  
  const endOfDay = getEndOfDay();
  const now = new Date();
  const remaining = endOfDay - now;
  const startOfDay = new Date(now.setHours(0, 0, 0, 0));
  const totalDayDuration = endOfDay - startOfDay;
  const progress = ((totalDayDuration - remaining) / totalDayDuration) * 100;
  
  if (remaining <= 0) {
    centralTimer.textContent = "Time's up!";
    // Handle daily reset
    handleDailyReset();
  } else {
    centralTimer.textContent = formatTimeRemaining(remaining);
    // Update progress bar
    const progressBar = centralTimer.parentElement.querySelector(".timer-progress-bar");
    if (progressBar) {
      progressBar.style.width = `${progress}%`;
    }
  }
}

// Add event listeners for page visibility
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    timerSystem.stopAllTimers();
  } else if (currentUser) {
    initializeTimers();
  }
});

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

    // Welcome sequence with delays
    await printToTerminal("[ SYSTEM RECOGNIZES YOU ]", "system");
    await new Promise(resolve => setTimeout(resolve, 1100));

    // // Show welcome message with motivation
    // const quote = getRandomItem(MOTIVATION.QUOTES);
    // await printToTerminal(`"${quote.text}"`, "quest");
    // await new Promise(resolve => setTimeout(resolve, 0));
    // await new Promise(resolve => setTimeout(resolve, 0));
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
    unlockedTitles: [], // Added unlockedTitles array
  },
  waterIntake: {
    current: 0,
    lastReset: null,
    streakDays: 0,
  },
  shadowArmy: {
    unlockedAbility: false,
    soldiers: [],
    maxSoldiers: 0,
    soldierTypes: {
      regular: { unlocked: false, count: 0 },
      elite: { unlocked: false, count: 0 },
      general: { unlocked: false, count: 0 },
      monarch: { unlocked: false, count: 0 }
    }
  }
};

// Terminal Elements
const terminal = document.getElementById("terminal");
const output = document.getElementById("output");
const input = document.getElementById("input");
const notification = document.getElementById("notification");

// Terminal Prompt Update
function updateTerminalPrompt() {
  const prompt = document.querySelector(".terminal-prompt-user");
  if (prompt) {
    let displayName = playerStats.profile?.name || "PLAYER";
    if (playerStats.profile?.title) {
      displayName = `[${playerStats.profile.title}] ${displayName}`;
      // Apply title color if it exists
      if (playerStats.profile.titleColor) {
        prompt.style.color = playerStats.profile.titleColor;
      } else {
        prompt.style.color = "var(--system-blue)"; // Default color
      }
    }
    prompt.textContent = displayName;
  }
}

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

async function showQuestIds() {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  const playerRef = db.collection("players").doc(currentUser.uid);
  
  // Fetch quests
  const regularQuestsSnapshot = await playerRef.collection("quests").get();
  const dailyQuestsSnapshot = await playerRef.collection("dailyQuests").get();

  printToTerminal("=== QUEST IDs ===\n", "system");

  if (regularQuestsSnapshot.empty && dailyQuestsSnapshot.empty) {
    printToTerminal("No quests found.", "error");
    return;
  }

  // Regular Quests
  if (!regularQuestsSnapshot.empty) {
    printToTerminal("\nRegular Quests:", "info");
    regularQuestsSnapshot.forEach(doc => {
      const quest = doc.data();
      printToTerminal(
        `${quest.title}: <span class="copyable-id" onclick="copyToClipboard('${doc.id}')">${doc.id}</span>`,
        "default"
      );
    });
  }

  // Daily Quests
  if (!dailyQuestsSnapshot.empty) {
    printToTerminal("\nDaily Quests:", "info");
    dailyQuestsSnapshot.forEach(doc => {
      const quest = doc.data();
      printToTerminal(
        `${quest.title}: <span class="copyable-id" onclick="copyToClipboard('${doc.id}')">${doc.id}</span>`,
        "default"
      );
    });
  }

  printToTerminal("\nClick on any ID to copy it to clipboard.", "info");
}

// Add copyToClipboard function
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showNotification(`Copied quest ID: ${text}`);
  }).catch(err => {
    console.error('Failed to copy text: ', err);
    showNotification('Failed to copy quest ID', 'error');
  });
}

// Make functions available globally
window.showQuestIds = showQuestIds;
window.copyToClipboard = copyToClipboard;

function showNotificationsWindow() {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }
  windowSystem.showWindow("notificationsWindow");
}

window.startBossBattle = async function(args) {
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

    // Check if player meets the rank requirement
    if (!isRankSufficient(player.rank, boss.requiredRank)) {
      printToTerminal(
        `You need to be rank ${boss.requiredRank} or higher to challenge this boss.`,
        "error"
      );
      return;
    }

    // Check if player already has an active battle with this boss
    const activeBattleRef = playerRef.collection("activeBattles").doc(bossId);
    const activeBattle = await activeBattleRef.get();

    if (activeBattle.exists) {
      printToTerminal("You are already battling this boss!", "error");
      return;
    }

    // Create new battle
    const battleData = {
      bossId: boss.id,
      bossName: boss.name,
      targetCount: boss.targetCount,
      currentCount: 0,
      timeLimit: boss.timeLimit,
      startTime: Date.now(),
      rewards: boss.rewards,
    };

    await activeBattleRef.set(battleData);

    // Set up timer for battle expiration
    const timerId = `boss_battle_${bossId}`;
    timerSystem.startTimer(timerId, async () => {
      const battle = (await activeBattleRef.get()).data();
      if (battle && battle.currentCount < battle.targetCount) {
        await handleBossBattleTimeout(playerRef, bossId, battle);
      }
    }, battleData.timeLimit);

    // Show battle start message
    printToTerminal(
      `\n🗡️ Boss Battle Started: ${boss.name}`,
      "success"
    );
    printToTerminal(
      `Complete ${boss.targetCount} ${boss.actionType} in ${formatTimeLimit(
        boss.timeLimit
      )}!`,
      "info"
    );
    printToTerminal("Rewards if successful:", "info");
    printToTerminal(`${boss.rewards.exp} XP`, "info");
    printToTerminal(`${boss.rewards.gold} Gold`, "info");

    // Update UI
    updateStatusBar();
    windowSystem.updateWindowContent("battleWindow");
    
    // Trigger battle start sound/notification
    handleBossBattleStart();
  } catch (error) {
    console.error("Error starting boss battle:", error);
    printToTerminal("Error starting boss battle: " + error.message, "error");
  }
};

window.startBossBattle = startBossBattle;


window.updateBattleProgress = async function(args) {
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

      audioSystem.playVoiceLine('BOSS_VICTORY');
      printToTerminal(`You have defeated ${boss.name}!`, "success");
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

window.updateBattleProgress = updateBattleProgress;
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
  "!setname": setPlayerName,
  "!settitle": setPlayerTitle,
  "!setbio": setPlayerBio,
  "!setclass": setPlayerClass,
  "!rank": handleRankCommand,
  "!rankprogress": showRankProgress,
  "!penalty": handlePenaltyCommand,
  "!delete": async (args) => {
    if (!isAuthenticated) {
      printToTerminal("You must !reawaken first.", "error");
      return;
    }

    if (args.length < 2) {
      printToTerminal("Usage: !delete [quest/daily] [questId]", "error");
      return;
    }

    const type = args[0].toLowerCase();
    const questId = args[1];

    if (type !== "quest" && type !== "daily") {
      printToTerminal("Invalid type. Use 'quest' or 'daily'.", "error");
      return;
    }

    await deleteQuest(questId, type === "daily" ? "daily" : "normal");
  },
  "!qid": showQuestIds,
  "!questid": showQuestIds,
  "!settitle": setPlayerTitle,
  "!st": setPlayerTitle,
  "!setclass": setPlayerClass,
  "!sc": setPlayerClass,
  "!shadowarmy": showShadowArmy,
  "!sa": showShadowArmy,
  "!notifications": showNotificationsWindow,
  "!n": showNotificationsWindow,

};

// Add to command handlers
commands["!penalty"] = handlePenaltyCommand;

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
      printToTerminal("!settitle <title> - Set your title");
      printToTerminal("!setbio <text> - Set your profile bio");
      printToTerminal("!setclass <class> - Set your hunter class");
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

    case "motivation":
      printToTerminal("\n=== 💪 MOTIVATION ===", "system");
      printToTerminal("!motivation, !m - Get a motivational quote");
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

window.startQuestCreation = (type) => {
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
    if (!currentUser || !currentUser.uid) {
      throw new Error("User not authenticated.");
    }

    const questRef = db
      .collection("players")
      .doc(currentUser.uid)
      .collection(quest.type === "daily" ? "dailyQuests" : "quests");

    // Explicitly add the quest type to the document
    const questData = {
      title: quest.title,
      targetCount: quest.count,
      currentCount: 0,
      metric: quest.metric,
      description: quest.description,
      type: quest.type, // Add the quest type to the document
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      completed: false,
      ...(quest.type === "daily"
        ? {
            lastReset: firebase.firestore.FieldValue.serverTimestamp(),
          }
        : {}),
    };

    // Add the quest and get the document reference
    const docRef = await questRef.add(questData);

    printToTerminal(
      `${quest.type === "daily" ? "Daily quest" : "Quest"} created successfully!`,
      "success"
    );
    showNotification("Quest created!");
      windowSystem.updateWindowContent("questsWindow");
      windowSystem.updateWindowContent("dailyQuestsWindow");

    // Return the document ID for future reference
    return docRef.id;
  } catch (error) {
    printToTerminal("Error creating quest: " + error.message, "error");
    console.error("Error details:", error); // Log full error for debugging
  }
}
async function showQuestWindow(type) {
  try {
    if (!isAuthenticated || !currentUser || !currentUser.uid) {
      printToTerminal("You must !reawaken first.", "error");
      return;
    }

    const questsRef = db
      .collection("players")
      .doc(currentUser.uid)
      .collection(type === "daily" ? "dailyQuests" : "quests");

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
        const endOfDay = getEndOfDay(); // Ensure this function is defined
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
      if (type === "daily") {
        printToTerminal(
          `  <button class="window-button danger" onclick="deleteQuest('${doc.id}', 'daily')">
            Delete Quest
          </button>`,
          "info"
        );
      }
      printToTerminal("---", "system");
    });
  } catch (error) {
    printToTerminal("Error loading quests: " + error.message, "error");
    console.error("Error details:", error); // Log full error for debugging
  }
}
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
    line.innerHTML = text;
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
          unlockedTitles: [], // Added unlockedTitles array
        },
        shadowArmy: {
          unlockedAbility: false,
          soldiers: [],
          maxSoldiers: 0,
          soldierTypes: {
            regular: { unlocked: false, count: 0 },
            elite: { unlocked: false, count: 0 },
            general: { unlocked: false, count: 0 },
            monarch: { unlocked: false, count: 0 }
          }
        }
      };

      await playerRef.set(playerStats);
    }

    // Set up real-time listener for player stats
    playerRef.onSnapshot((snapshot) => {
      if (snapshot.exists) {
        const data = snapshot.data();
        // Update local stats if they differ from database
        if (data.exp !== playerStats.exp || data.level !== playerStats.level || 
            data.gold !== playerStats.gold || data.rank !== playerStats.rank) {
          playerStats.exp = data.exp;
          playerStats.level = data.level;
          playerStats.gold = data.gold;
          playerStats.rank = data.rank;
          updateStatusBar();
        }
      }
    });

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

  // Update level progress bar using CSS variable
  const expProgress = (playerStats.exp / expNeeded) * 100;
  statusBar.style.setProperty('--exp-progress', `${expProgress}%`);
}

// Add this to check and reset daily quests
window.checkDailyQuests = async function() {
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
  clearTerminal();

  // Sequence of initialization messages with delays
  const messages = [
    { text: "[ SYSTEM ONLINE ]", type: "system", delay: 0 },
    {
      text: "[ INITIALIZING SYSTEM ]",
      type: "system",
      delay: 1300,
    },
    {
      text: "[ SYSTEM INITIALIZATION COMPLETE ]",
      type: "system",
      delay: 0,
    },
    {
      text: "Type !commands to view available protocols",
      type: "info",
      delay: 200,
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
        printToTerminal(
          `  <button class="window-button danger" onclick="deleteQuest('${change.doc.id}', 'daily')">
            Delete Quest
          </button>`,
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
  const windowId = type === "daily" ? "dailyQuestsWindow" : "questsWindow";
  const questList = document.getElementById(type === "daily" ? "dailyQuestsList" : "activeQuestsList");
  let questElement = document.getElementById(`quest-${questId}`);

  if (!questElement) {
    questElement = document.createElement("div");
    questElement.id = `quest-${questId}`;
    questElement.className = "window-item";
    questList.appendChild(questElement);
  }

  const endOfDay = getEndOfDay();
  const timeRemaining = endOfDay - new Date();
  const isCompletedToday = quest.completed && quest.lastCompletion && wasCompletedToday(quest.lastCompletion);

  questElement.innerHTML = `
    <div class="window-item-title">
      ${quest.title}
      ${isCompletedToday ? '<span class="completion-badge">✓</span>' : ""}
    </div>
    <div class="window-item-description">
      Progress: 
      <input type="number" 
             value="${isCompletedToday ? quest.targetCount : quest.currentCount}" 
             min="0" 
             max="${quest.targetCount}" 
             onchange="updateQuestCount('${questId}', '${type}', this.value)"
             style="width: 60px; background: transparent; color: var(--text-color); border: 1px solid var(--system-blue);"
             ${isCompletedToday ? "disabled" : ""}>
      /${quest.targetCount} ${quest.metric}
    </div>
    <div class="window-item-description">${quest.description}</div>
    <div class="window-item-description">
      ${type === "daily" ? (isCompletedToday ? "Completed Today" : `Time remaining: ${formatTimeRemaining(timeRemaining)}`) : ""}
    </div>
    <div class="window-item-progress">
      <div class="window-item-progress-bar" style="width: ${isCompletedToday ? 100 : (quest.currentCount / quest.targetCount) * 100}%"></div>
    </div>
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
      { rank: 1, requirement: 5, reward: { exp: 50, gold: 25 } },
      { rank: 2, requirement: 10, reward: { exp: 100, gold: 50 } },
      { rank: 3, requirement: 25, reward: { exp: 200, gold: 100 } },
      { rank: 4, requirement: 50, reward: { exp: 400, gold: 200 } },
      { rank: 5, requirement: 100, reward: { exp: 800, gold: 400 } },
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
      { rank: 1, requirement: 5, reward: { exp: 25, gold: 15 } },
      { rank: 2, requirement: 10, reward: { exp: 50, gold: 25 } },
      { rank: 3, requirement: 25, reward: { exp: 100, gold: 50 } },
      { rank: 4, requirement: 50, reward: { exp: 200, gold: 100 } },
      { rank: 5, requirement: 100, reward: { exp: 400, gold: 200 } },
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
      { rank: 1, requirement: 3, reward: { exp: 25, gold: 15 } },
      { rank: 2, requirement: 7, reward: { exp: 100, gold: 50 } },
      { rank: 3, requirement: 14, reward: { exp: 200, gold: 100 } },
      { rank: 4, requirement: 30, reward: { exp: 400, gold: 200 } },
      { rank: 5, requirement: 60, reward: { exp: 800, gold: 400 } },
    ],
    currentRank: 0,
    type: "daily_streak",
    icon: "🔥",
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
      { rank: 1, requirement: "D", reward: { exp: 100, gold: 50 } },
      { rank: 2, requirement: "C", reward: { exp: 200, gold: 100 } },
      { rank: 3, requirement: "B", reward: { exp: 300, gold: 150 } },
      { rank: 4, requirement: "A", reward: { exp: 400, gold: 200 } },
      { rank: 5, requirement: "S", reward: { exp: 500, gold: 250 } },
    ],
    currentRank: 0,
    type: "rank",
    icon: "👑",
  },

  // Shadow Army Achievements
  SHADOW_MASTER: {
    id: "shadow_master",
    name: "Shadow Master",
    description: "Build your shadow army",
    ranks: [
      { rank: 1, requirement: 1, reward: { exp: 100, gold: 50 }, description: "Extract your first shadow" },
      { rank: 2, requirement: 5, reward: { exp: 200, gold: 100 }, description: "Have 5 shadows" },
      { rank: 3, requirement: 10, reward: { exp: 300, gold: 150 }, description: "Have 10 shadows" },
      { rank: 4, requirement: 25, reward: { exp: 400, gold: 200 }, description: "Have 25 shadows" },
      { rank: 5, requirement: 50, reward: { exp: 500, gold: 250 }, description: "Have 50 shadows" }
    ],
    currentRank: 0,
    type: "shadow_count",
    icon: "👻"
  },
  SHADOW_EVOLUTION: {
    id: "shadow_evolution",
    name: "Shadow Evolution",
    description: "Upgrade your shadows to higher tiers",
    ranks: [
      { rank: 1, requirement: 1, reward: { exp: 200, gold: 100 }, description: "Have 1 Elite Shadow" },
      { rank: 2, requirement: 1, reward: { exp: 400, gold: 200 }, description: "Have 1 Shadow General" },
      { rank: 3, requirement: 1, reward: { exp: 600, gold: 300 }, description: "Have 1 Shadow Monarch" },
      { rank: 4, requirement: 3, reward: { exp: 800, gold: 400 }, description: "Have 3 Shadow Monarchs" },
      { rank: 5, requirement: 5, reward: { exp: 1000, gold: 500 }, description: "Have 5 Shadow Monarchs" }
    ],
    currentRank: 0,
    type: "shadow_tier",
    icon: "👑"
  }
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
  if (!isAuthenticated) return;

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
        case "water_streak":
          completed = player.waterIntake?.streakDays >= rankData.requirement;
          break;
        case "total_gold":
          completed = player.gold >= rankData.requirement;
          break;
        case "rank":
          completed = isRankSufficient(player.rank, rankData.requirement);
          break;
        case "shadow_count":
          completed = player.shadowArmy?.soldiers?.length >= rankData.requirement;
          break;
        case "shadow_tier":
          const soldierTypes = player.shadowArmy?.soldierTypes || {};
          const tierCount = soldierTypes[achievement.ranks[nextRank - 1].description.split(" ")[2].toLowerCase()]?.count || 0;
          completed = tierCount >= rankData.requirement;
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

        audioSystem.playVoiceLine('ACHIEVEMENT');
      }
    }
  } catch (error) {
    console.error("Check achievements error:", error);
  }
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
    audioSystem.playVoiceLine('LEVEL_UP');

    // Update local stats first for immediate feedback
    playerStats.level += levelsGained;
    playerStats.exp = remainingExp;
    updateStatusBar(); // Update UI immediately

    // Update database
    await playerRef.update({
      level: firebase.firestore.FieldValue.increment(levelsGained),
      exp: remainingExp,
    });

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
    showNotification(`Level Up! You are now level ${playerStats.level}! 🎉`);

    return true;
  }
  return false;
}


// Modify the completeQuest function's transaction block
window.completeQuest = async function(questId, type) {
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

    // Calculate base rewards - reduced values
    const expReward = type === "daily" ? 30 : 20; // Daily quests give more exp
    const goldReward = type === "daily" ? 15 : 10; // Daily quests give more gold

    await db.runTransaction(async (transaction) => {
      const playerDoc = await transaction.get(playerRef);
      if (!playerDoc.exists) return;

      const player = playerDoc.data();

      // Initialize arrays if they don't exist
      if (!player.achievements) {
        await playerRef.update({ achievements: [] });
        player.achievements = [];
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

      // Update the quest UI immediately
      windowSystem.updateWindowContent("questsWindow");
      windowSystem.updateWindowContent("dailyQuestsWindow");

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

    audioSystem.playVoiceLine('QUEST_COMPLETE');
    const questMessage = getRandomItem(MOTIVATION.MILESTONE_MESSAGES.QUEST_COMPLETE);
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

    // Ensure the quest is marked as completed in the UI
    windowSystem.updateWindowContent("questsWindow");
    windowSystem.updateWindowContent("dailyQuestsWindow");
  } catch (error) {
    printToTerminal("Error completing quest: " + error.message, "error");
    console.error("Complete quest error:", error);
  }
}

// Shadow Army System
const SHADOW_TIERS = {
  regular: {
    name: "Regular Shadow Soldier",
    power: 1,
    description: "A basic shadow soldier extracted from a defeated boss"
  },
  elite: {
    name: "Elite Shadow Soldier",
    power: 2.5,
    description: "A powerful shadow soldier with enhanced abilities"
  },
  general: {
    name: "Shadow General",
    power: 5,
    description: "A commanding shadow soldier that leads other shadows"
  },
  monarch: {
    name: "Shadow Monarch",
    power: 10,
    description: "An extremely powerful shadow soldier with monarch-level abilities"
  }
};

window.extractShadow = async function(bossId) {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  const playerRef = db.collection("players").doc(currentUser.uid);
  const player = (await playerRef.get()).data();

  if (!player.shadowArmy.unlockedAbility) {
    printToTerminal("You haven't unlocked the Shadow Extraction ability yet!", "error");
    return;
  }

  if (player.shadowArmy.soldiers.length >= player.shadowArmy.maxSoldiers) {
    printToTerminal("Your shadow army is at maximum capacity!", "error");
    return;
  }

  const boss = BOSSES[bossId];
  if (!boss) {
    printToTerminal("Invalid boss ID.", "error");
    return;
  }

  // Create a new shadow soldier
  const newShadow = {
    id: `shadow_${Date.now()}`,
    name: `Shadow of ${boss.name}`,
    type: "regular",
    bossOrigin: bossId,
    extractedAt: Date.now(),
    power: SHADOW_TIERS.regular.power,
    level: 1
  };

  try {
    await playerRef.update({
      "shadowArmy.soldiers": firebase.firestore.FieldValue.arrayUnion(newShadow),
      "shadowArmy.soldierTypes.regular.count": firebase.firestore.FieldValue.increment(1)
    });

    // Update local stats
    playerStats.shadowArmy.soldiers.push(newShadow);
    playerStats.shadowArmy.soldierTypes.regular.count++;

    printToTerminal(`Successfully extracted shadow from ${boss.name}!`, "success");
    showNotification(`New shadow soldier added to your army!`);
    
    // Update UI
    windowSystem.updateWindowContent("shadowArmyWindow");
  } catch (error) {
    printToTerminal("Error extracting shadow: " + error.message, "error");
  }
}

async function showShadowArmy() {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  windowSystem.showWindow("shadowArmyWindow");
}

async function updateQuestProgress(questId, type, amount) {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  try {
    const playerRef = db.collection("players").doc(currentUser.uid);
    const questRef = playerRef.collection(type === "daily" ? "dailyQuests" : "quests").doc(questId);
    const quest = (await questRef.get()).data();

    if (!quest) {
      printToTerminal("Quest not found.", "error");
      return;
    }

    // Check if quest was already completed today
    if (quest.completed && quest.lastCompletion && wasCompletedToday(quest.lastCompletion)) {
      printToTerminal("Quest already completed today.", "warning");
        return;
    }

    let newCount = quest.currentCount;
    if (amount === "complete") {
      newCount = quest.targetCount;
    } else {
      const addAmount = parseInt(amount);
      if (isNaN(addAmount)) {
        printToTerminal("Invalid amount. Please enter a number.", "error");
        return;
      }
      newCount = Math.min(quest.targetCount, quest.currentCount + addAmount);
    }

    // Update quest progress
      await questRef.update({
        currentCount: newCount,
      completed: newCount >= quest.targetCount,
      lastCompletion: newCount >= quest.targetCount ? firebase.firestore.FieldValue.serverTimestamp() : null
    });

    // If quest is completed, update player stats
    if (newCount >= quest.targetCount && (!quest.completed || !wasCompletedToday(quest.lastCompletion))) {
      const expReward = type === "daily" ? 50 : 25;
      const goldReward = type === "daily" ? 25 : 15;

      await playerRef.update({
        questsCompleted: firebase.firestore.FieldValue.increment(1),
        exp: firebase.firestore.FieldValue.increment(expReward),
        gold: firebase.firestore.FieldValue.increment(goldReward)
      });

      printToTerminal(`Quest completed! Earned ${expReward} XP and ${goldReward} gold.`, "success");
      showNotification("Quest completed!", "success");
      audioSystem.playVoiceLine("QUEST_COMPLETE");
    } else {
      printToTerminal(`Quest progress updated: ${newCount}/${quest.targetCount}`, "info");
    }

    // Update UI
    updateQuestUI(quest, questId, type);
  } catch (error) {
    console.error("Error updating quest progress:", error);
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
      "Resetting: Level, EXP, Gold, Rank, Achievements, Streak, Title, Class, Bio, Water, Inventory, Items, Bosses, Quests, Notifications.",
      "warning"
    );
    printToTerminal(`\nTo confirm, type "${confirmationPhrase}"`, "warning");

    awaitingResetConfirmation = true;
    return;
  }

  if (userInput === confirmationPhrase) {
    try {
      const playerRef = db.collection("players").doc(currentUser.uid);

      // Delete all notifications for the user
      const notificationsSnapshot = await db.collection("notifications")
        .where("userId", "==", currentUser.uid)
        .get();
      
      const batch = db.batch();
      notificationsSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();

      // Reset level, exp, gold, rank, achievements, streak, and quests count
      await playerRef.update({
        inventory: [],
        profile: {
          ...playerStats.profile,
        title: "Novice",
        class: "Hunter",
          bio: "",
        },
        level: 1,
        exp: 0,
        gold: 0,
        rank: "E",
        achievements: [],
        streak: 0,
        waterIntake: 0,
        questsCompleted: 0,
        shadowArmy: {
          unlockedAbility: false,
          soldiers: [],
          maxSoldiers: 0,
          soldierTypes: {
            regular: { unlocked: false, count: 0 },
            elite: { unlocked: false, count: 0 },
            general: { unlocked: false, count: 0 },
            monarch: { unlocked: false, count: 0 }
          }
        }
      });

      // Update local stats
      playerStats.level = 1;
      playerStats.exp = 0;
      playerStats.gold = 0;
      playerStats.rank = "E";
      playerStats.achievements = [];
      playerStats.streak = 0;
      playerStats.questsCompleted = 0;
      playerStats.profile.title = "Novice";
      playerStats.profile.class = "Hunter";
      playerStats.profile.bio = "";
      playerStats.shadowArmy = {
        unlockedAbility: false,
        soldiers: [],
        maxSoldiers: 0,
        soldierTypes: {
          regular: { unlocked: false, count: 0 },
          elite: { unlocked: false, count: 0 },
          general: { unlocked: false, count: 0 },
          monarch: { unlocked: false, count: 0 }
        }
      };

      // Update UI
      updateStatusBar();
      windowSystem.updateWindowContent("achievementsWindow");
      windowSystem.updateWindowContent("profileWindow");
      windowSystem.updateWindowContent("questsWindow");
      windowSystem.updateWindowContent("dailyQuestsWindow");
      windowSystem.updateWindowContent("notificationsWindow");
      windowSystem.updateWindowContent("shadowArmyWindow");
      windowSystem.updateNotificationBadge(0); // Reset notification badge count

      printToTerminal("Progress has been reset!", "success");
      printToTerminal("Level reset to 1", "info");
      printToTerminal("Experience reset to 0", "info");
      printToTerminal("Gold reset to 0", "info");
      printToTerminal("Rank reset to E", "info");
      printToTerminal("Title reset to Novice", "info");
      printToTerminal("Class reset to Hunter", "info");
      printToTerminal("Bio cleared", "info");
      printToTerminal("Achievements progress reset", "info");
      printToTerminal("Completed quests count reset to 0", "info");
      printToTerminal("All notifications cleared", "info");
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

window.updateBattleProgress = async function(args) {
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

      audioSystem.playVoiceLine('BOSS_VICTORY');
      printToTerminal(`You have defeated ${boss.name}!`, "success");
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


function getRandomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}


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

// Window System
window.windowSystem = {
  windows: {
    profileWindow: document.getElementById("profileWindow"),
    questsWindow: document.getElementById("questsWindow"),
    dailyQuestsWindow: document.getElementById("dailyQuestsWindow"),
    achievementsWindow: document.getElementById("achievementsWindow"),
    shopWindow: document.getElementById("shopWindow"),
    inventoryWindow: document.getElementById("inventoryWindow"),
    rankProgressWindow: document.getElementById("rankProgressWindow"),
    bossBattlesWindow: document.getElementById("bossBattlesWindow"),
    leaderboardWindow: document.getElementById("leaderboardWindow"),
    notificationsWindow: document.getElementById("notificationsWindow"),
    shadowArmyWindow: document.getElementById("shadowArmyWindow"),
  },

  taskbarItems: [
    { id: "profileWindow", icon: "fa-user", title: "Profile" },
    { id: "questsWindow", icon: "fa-tasks", title: "Quests" },
    {
      id: "dailyQuestsWindow",
      icon: "fa-calendar-check",
      title: "Daily Quests",
    },
    {
      id: "achievementsWindow",
      icon: "fa-trophy",
      title: "Achievements",
    },
    { id: "shopWindow", icon: "fa-store", title: "Shop" },
    { id: "inventoryWindow", icon: "fa-box", title: "Inventory" },
    {
      id: "rankProgressWindow",
      icon: "fa-star",
      title: "Rank Progress",
    },
    { id: "bossBattlesWindow", icon: "fa-dragon", title: "Boss Battles" },
    {
      id: "leaderboardWindow",
      icon: "fa-crown",
      title: "Leaderboard",
    },
    {
      id: "notificationsWindow",
      icon: "fa-bell",
      title: "Notifications",
    },
    {
      id: "shadowArmyWindow",
      icon: "fa-ghost",
      title: "Shadow Army",
    },
  ],

  zIndex: 1000,

  init() {
    // Initialize windows object
    this.windows = {
      profileWindow: document.getElementById("profileWindow"),
      questsWindow: document.getElementById("questsWindow"),
      dailyQuestsWindow: document.getElementById("dailyQuestsWindow"),
      achievementsWindow: document.getElementById("achievementsWindow"),
      shopWindow: document.getElementById("shopWindow"),
      inventoryWindow: document.getElementById("inventoryWindow"),
      rankProgressWindow: document.getElementById("rankProgressWindow"),
      bossBattlesWindow: document.getElementById("bossBattlesWindow"),
      leaderboardWindow: document.getElementById("leaderboardWindow"),
      notificationsWindow: document.getElementById("notificationsWindow"),
      shadowArmyWindow: document.getElementById("shadowArmyWindow"),
    };

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
        window.style.top = "10px";
        window.style.left = "10px";
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
      { id: "bossBattlesWindow", icon: "fa-dragon", title: "Boss Battles" },
      {
        id: "leaderboardWindow",
        icon: "fa-trophy",
        title: "Leaderboard",
      },
      {
        id: "notificationsWindow",
        icon: "fa-bell",
        title: "Notifications",
      },
      {
        id: "shadowArmyWindow",
        icon: "fa-user-secret",
        title: "Shadow Army",
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

        // Only initialize timers for windows that need them and if not already initialized
        if ((windowId === "dailyQuestsWindow" || windowId === "bossBattlesWindow") && !timerSystem.isInitialized) {
          initializeTimers();
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

        // Only cleanup timers if no other timer-dependent windows are open
        if (windowId === "dailyQuestsWindow" || windowId === "bossBattlesWindow") {
          const dailyQuestsOpen = this.windows["dailyQuestsWindow"]?.classList.contains("show");
          const bossBattlesOpen = this.windows["bossBattlesWindow"]?.classList.contains("show");
          
          if (!dailyQuestsOpen && !bossBattlesOpen) {
            timerSystem.stopAllTimers();
          }
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
    const windowTitle = this.windows[windowId].querySelector(".window-title").textContent;
    return Array.from(document.querySelectorAll(".taskbar-item")).find(
      (item) => {
        // Handle special cases for Profile and Quests windows
        if (windowId === "profileWindow" && item.title === "Profile") return true;
        if (windowId === "questsWindow" && item.title === "Quests") return true;
        // For other windows, check if the taskbar item title matches the window title
        return item.title === windowTitle;
      }
    );
  },

  // Add updateWindowContent method
  async updateWindowContent(windowId) {
    if (!currentUser) return;

    try {
    switch (windowId) {
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
        case "profileWindow":
          await this.updateProfileWindow();
        break;
      case "leaderboardWindow":
        await this.updateLeaderboardWindow();
        break;
        case "bossBattlesWindow":
          await this.updateBattleWindow();
          break;
      case "notificationsWindow":
        await this.updateNotificationsWindow();
        break;
      case "shadowArmyWindow":
        await this.updateShadowArmyWindow();
        break;
      }
    } catch (error) {
      console.error(`Error updating window ${windowId}:`, error);
    }
  },

  async updateProfileWindow() {
    try {
      if (!currentUser) return;
      
      const playerRef = db.collection("players").doc(currentUser.uid);
      const playerDoc = await playerRef.get();
      if (!playerDoc.exists) return;

      const player = playerDoc.data();

      // Helper function to safely update element content
      const safeUpdateElement = (id, value, defaultValue = "Not set") => {
        const element = document.getElementById(id);
        if (element) {
          if (id === "profileTitle" && player.profile.titleColor) {
            element.style.color = player.profile.titleColor;
            element.textContent = value || defaultValue;
          } else {
            element.style.color = ""; // Reset color for non-title elements
          }
          element.textContent = value || defaultValue;
        }
      };

      // Update Character Info section
      safeUpdateElement("profileName", player?.profile?.name);
      safeUpdateElement("profileTitle", player?.profile?.title, "Novice");
      safeUpdateElement("profileClass", player?.profile?.class, "Hunter");
      safeUpdateElement("profileBio", player?.profile?.bio);

      // Update Stats section
      safeUpdateElement("profileLevel", player.level, "1");
      safeUpdateElement("profileRank", player.rank, "E");
      safeUpdateElement("profileGold", player.gold, "0");
      safeUpdateElement("profileQuestsCompleted", player.questsCompleted, "0");
      safeUpdateElement("profileStreak", `${player.streak || 0} days`);

      // Update Water Intake section
      safeUpdateElement("profileWaterIntake", `${player.waterIntake?.current || 0}/${player.waterIntake?.goal || 8} glasses`);
      const waterBar = document.getElementById("profileWaterBar");
      if (waterBar) {
        const waterProgress = ((player.waterIntake?.current || 0) / (player.waterIntake?.goal || 8)) * 100;
        waterBar.style.width = `${Math.min(100, waterProgress)}%`;
      }
      safeUpdateElement("profileWaterStreak", `Streak: ${player.waterIntake?.streakDays || 0} days`);

      // Update Join Date
      const joinDate = player.profile?.joinDate?.toDate() || new Date();
      safeUpdateElement("profileJoinDate", joinDate.toLocaleDateString());

      // Update unlocked titles dropdown
      const titleDropdown = document.getElementById("profileTitleDropdown");
      if (titleDropdown) {
        titleDropdown.innerHTML = "";
        player.profile.unlockedTitles.forEach((title) => {
          const option = document.createElement("option");
          option.value = title;
          option.textContent = title;
          titleDropdown.appendChild(option);
        });
      }

    } catch (error) {
      console.error("Error updating profile window:", error);
    }
  },

  async updateQuestsWindow(type = "normal") {
    if (!currentUser) return;
    try {
      const collectionName = type === "daily" ? "dailyQuests" : "quests";
      const questsRef = db
        .collection("players")
        .doc(currentUser.uid)
        .collection(collectionName);
      const snapshot = await questsRef.get();
      const questsList = document.getElementById(type === "daily" ? "activeDailyQuestsList" : "activeQuestsList");
      questsList.innerHTML = "";

      if (snapshot.empty) {
        questsList.innerHTML =
          `<div class="window-item">No active ${type === "daily" ? "daily " : ""}quests</div>`;
        return;
      }

      // Add Complete All button at the top
      const completeAllBtn = document.createElement("button");
      completeAllBtn.className = "window-button";
      completeAllBtn.textContent = `Complete All ${type === "daily" ? "Daily " : ""}Quests`;
      completeAllBtn.onclick = () => completeAllQuests(type);
      questsList.appendChild(completeAllBtn);

      snapshot.forEach((doc) => {
        const quest = doc.data();
        const questElement = document.createElement("div");
        questElement.className = "window-item";

        questElement.innerHTML = `
          <div class="window-item-title">${quest.title}</div>
          <div class="window-item-description">
            Progress: 
            <input type="number" 
                   value="${quest.currentCount}" 
                   min="0" 
                   max="${quest.targetCount}" 
                   onchange="updateQuestCount('${doc.id}', '${type}', this.value)"
                   style="width: 60px; background: transparent; color: var(--text-color); border: 1px solid var(--system-blue);">
            /${quest.targetCount} ${quest.metric}
          </div>
          <div class="window-item-description">${quest.description}</div>
          <div class="window-item-progress">
            <div class="window-item-progress-bar" style="width: ${(quest.currentCount / quest.targetCount) * 100}%"></div>
          </div>
          <div class="window-actions" style="margin-top: 10px;">
            <button class="window-button" onclick="completeQuest('${doc.id}', '${type}')">
              Complete Quest
            </button>
            <button class="window-button danger" onclick="deleteQuest('${doc.id}', '${type}')">
              Delete Quest
            </button>
          </div>
        `;
        questsList.appendChild(questElement);
      });
    } catch (error) {
      console.error(`Error updating ${type} quests window:`, error);
    }
  },

  async updateDailyQuestsWindow(type = "daily") {
    try {
      if (!currentUser) return;

      const questsRef = db
        .collection("players")
        .doc(currentUser.uid)
        .collection("dailyQuests");

      const snapshot = await questsRef.get();
      const dailyQuestsList = document.getElementById("dailyQuestsList");
      
      if (!dailyQuestsList) return;
      
      // Add the centralized timer at the top
      const timerSection = document.createElement("div");
      timerSection.className = "daily-timer-section";
      const endOfDay = getEndOfDay();
      const now = new Date();
      const remaining = endOfDay - now;
      const startOfDay = new Date(now.setHours(0, 0, 0, 0));
      const totalDayDuration = endOfDay - startOfDay;
      const progress = ((totalDayDuration - remaining) / totalDayDuration) * 100;
      
      timerSection.innerHTML = `
        <div class="daily-timer-container">
          <div class="daily-timer-label">Time Until Reset</div>
          <div class="daily-timer-display" id="centralDailyTimer">${formatTimeRemaining(remaining)}</div>
          <div class="daily-timer-progress">
            <div class="timer-progress-bar" style="width: ${progress}%"></div>
            <div class="timer-markers">
              <span class="marker" style="left: 0%">00:00</span>
              <span class="marker" style="left: 25%">06:00</span>
              <span class="marker" style="left: 50%">12:00</span>
              <span class="marker" style="left: 75%">18:00</span>
              <span class="marker" style="left: 100%">24:00</span>
            </div>
          </div>
        </div>
      `;
      
      dailyQuestsList.innerHTML = "";
      dailyQuestsList.appendChild(timerSection);

      if (snapshot.empty) {
        dailyQuestsList.innerHTML += '<div class="window-item">No daily quests available</div>';
        return;
      }

      snapshot.forEach((doc) => {
        const quest = doc.data();
        const questElement = document.createElement("div");
        questElement.className = "window-item";

        // Check if quest was completed today
        const isCompletedToday = quest.completed && quest.lastCompletion && wasCompletedToday(quest.lastCompletion);

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
                   value="${isCompletedToday ? quest.targetCount : quest.currentCount}" 
                   min="0" 
                   max="${quest.targetCount}" 
                   onchange="updateQuestCount('${doc.id}', 'daily', this.value)"
                   style="width: 60px; background: transparent; color: var(--text-color); border: 1px solid var(--system-blue);"
                   ${isCompletedToday ? "disabled" : ""}>
            /${quest.targetCount} ${quest.metric}
          </div>
          <div class="window-item-description">${quest.description}</div>
          <div class="window-item-progress">
            <div class="window-item-progress-bar" style="width: ${isCompletedToday ? 100 : (quest.currentCount / quest.targetCount) * 100}%"></div>
          </div>
          
                   <div class="window-actions" style="margin-top: 10px;">
            <button id="dailyquestcompletebutton" class="window-button" onclick="completeQuest('${doc.id}', '${type}')" ${isCompletedToday ? "disabled" : ""}>
              Complete Quest
            </button>
            <button class="window-button danger" onclick="deleteQuest('${doc.id}', '${type}')">
              Delete Quest
            </button>
          </div>`;

        dailyQuestsList.appendChild(questElement);
      });

      // Add the CSS if not already present
      if (!document.getElementById("dailyQuestTimerStyles")) {
        const styleSheet = document.createElement("style");
        styleSheet.id = "dailyQuestTimerStyles";
        styleSheet.textContent = `
          .daily-timer-section {
            background: rgba(0, 16, 32, 0.8);
            border: 1px solid var(--system-blue);
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 20px;
            text-align: center;
          }
          .daily-timer-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
          }
          .daily-timer-label {
            color: var(--system-blue);
            font-size: 0.9em;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .daily-timer-display {
            font-size: 2em;
            font-weight: bold;
            color: #00ffff;
            text-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
            font-family: monospace;
          }
          .daily-timer-progress {
            width: 100%;
            height: 8px;
            background: rgba(0, 136, 255, 0.2);
            border-radius: 4px;
            overflow: hidden;
            position: relative;
            margin-top: 20px;
          }
          .timer-progress-bar {
            height: 100%;
            background: linear-gradient(90deg, #0088ff, #00ffff);
            transition: width 1s linear;
          }
          .timer-markers {
            position: absolute;
            top: -15px;
            left: 0;
            right: 0;
            height: 20px;
            pointer-events: none;
          }
          .marker {
            position: absolute;
            transform: translateX(-50%);
            font-size: 0.7em;
            color: var(--system-blue);
            white-space: nowrap;
          }
          .marker::after {
            content: '';
            position: absolute;
            left: 50%;
            top: 18px;
            width: 1px;
            height: 4px;
            background: var(--system-blue);
          }
        `;
        document.head.appendChild(styleSheet);
      }
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
        water_streak: "Hydration Achievements",
        total_gold: "Gold Achievements",
        rank: "Rank Achievements",
        shadow_count: "Shadow Army Achievements",
        shadow_tier: "Shadow Army Achievements",
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
                case "shadow_count":
                  currentValue = Math.min(
                    player.shadowArmy?.soldiers?.length || 0,
                    nextRank.requirement
                  );
                  progressText = `${currentValue}/${nextRank.requirement} Shadows`;
                  break;
                case "shadow_tier":
                  const soldierTypes = player.shadowArmy?.soldierTypes || {};
                  const tierCount = soldierTypes[nextRank.description.split(" ")[2].toLowerCase()]?.count || 0;
                  currentValue = Math.min(
                    tierCount,
                    nextRank.requirement
                  );
                  progressText = `${currentValue}/${nextRank.requirement} ${nextRank.description}`;
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
      const playerRef = db.collection("players").doc(currentUser.uid);
      const player = (await playerRef.get()).data();
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

            // Check if item is a one-time purchase and already owned
            const isOneTimePurchase = item.effect && (
              item.effect.type === "title" ||
              item.effect.type === "shadow_ability" ||
              item.effect.type === "profile_custom" ||
              item.effect.type === "achievement_tracking" ||
              item.effect.type === "milestone_custom" ||
              item.effect.type === "quest_chain"
            );

            const alreadyOwned = isOneTimePurchase && player.inventory && player.inventory.some(invItem => invItem.id === item.id);

            if (!canPurchase || alreadyOwned) {
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
                  alreadyOwned
                    ? `<div class="shop-item-requirement">Purchased</div>`
                    : canPurchase
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
          .shop-item-requirement:contains("Purchased") {
            color: #44ff44;
            background: rgba(68, 255, 68, 0.1);
            border-color: rgba(68, 255, 68, 0.3);
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

      player.inventory.forEach((inventoryItem) => {
        const item = Object.values(ITEMS).find(
          (item) => item.id === inventoryItem.id
        );
        if (item) {
          const itemElement = document.createElement("div");
          itemElement.className = "window-item";

          const isExpired =
            inventoryItem.expiresAt && inventoryItem.expiresAt <= Date.now();
          const timeLeft = inventoryItem.expiresAt
            ? Math.max(0, inventoryItem.expiresAt - Date.now())
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
              item.effect.type === "remove_fatigue" ||
              item.effect.type === "title" ||
              item.effect.type === "title_color");

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
                isExpired
                  ? `<div class="window-item-price">Sell price: ${calculateSellPrice(
                      item
                    )} gold</div>
                   <button onclick="sellItem('${
                     item.id
                   }')" class="window-button">Sell</button>`
                  : isUsable
                  ? `<button onclick="useItem('${item.id}')" class="window-button">Use</button>`
                  : `<div class="window-item-price">Sell price: ${calculateSellPrice(
                      item
                    )} gold</div>
                     <button onclick="sellItem('${
                       item.id
                     }')" class="window-button">Sell</button>`
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
    try {
      if (!currentUser) return;
      
      const bossBattlesList = document.getElementById("bossBattlesList");
      if (!bossBattlesList) {
        console.error("Boss battles list element not found");
        return;
      }
      
      bossBattlesList.innerHTML = "";

      // Get player's active battles and defeated bosses
      const playerRef = db.collection("players").doc(currentUser.uid);
      const playerDoc = await playerRef.get();
      const player = playerDoc.data();
      const defeatedBosses = player?.defeatedBosses || {};

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

      // Add CSS styles if not present
      if (!document.getElementById("bossBattleStyles")) {
        const styleSheet = document.createElement("style");
        styleSheet.id = "bossBattleStyles";
        styleSheet.textContent = `
          .defeat-count {
            margin-left: 10px;
            font-size: 0.9em;
            color: #ff4444;
          }
          .active-battle-badge {
            margin-left: 10px;
            font-size: 0.9em;
            color: #44ff44;
          }
          .battle-time-remaining {
            font-size: 0.9em;
            color: #ffff44;
            margin: 5px 0;
          }
          .progress-input {
            display: flex;
            align-items: center;
            margin: 10px 0;
          }
          .progress-input input {
            margin: 0 10px;
            padding: 2px 5px;
            width: 80px;
            background: transparent;
            color: var(--text-color);
            border: 1px solid var(--system-blue);
          }
        `;
        document.head.appendChild(styleSheet);
      }

      // Display available boss battles
      Object.entries(BOSSES).forEach(([bossKey, boss]) => {
        const defeatCount = defeatedBosses[boss.id] || 0;
        const activeBattle = activeBattleMap.get(boss.id);
        const bossElement = document.createElement("div");
        bossElement.className = "window-item";

        // Calculate scaled values
        const scaledTarget = boss.baseTargetCount + (defeatCount * (boss.scaling?.targetCount || 0));
        const scaledExp = boss.rewards.exp + (defeatCount * (boss.scaling?.rewards?.exp || 0));
        const scaledGold = boss.rewards.gold + (defeatCount * (boss.scaling?.rewards?.gold || 0));

        bossElement.innerHTML = `
          <div class="window-item-title">
            ${boss.name}
            ${defeatCount > 0 ? `<span class="defeat-count">💀 ${defeatCount}</span>` : ""}
            ${activeBattle ? '<span class="active-battle-badge">⚔️ In Progress</span>' : ""}
          </div>
          <div class="window-item-description">${boss.description}</div>
          <div class="window-item-description">
            Target: ${scaledTarget} ${boss.metric}
            <br>Time Limit: ${formatTimeLimit(boss.timeLimit)}
            ${defeatCount > 0 ? `<br>Scaling: +${boss.scaling?.targetCount || 0} ${boss.metric} per defeat` : ""}
          </div>
          <div class="window-item-description">
            Rewards:
            <br>- ${scaledExp} XP
            <br>- ${scaledGold} Gold
            ${boss.rewards.title ? `<br>- Title: ${boss.rewards.title}` : ""}
          </div>
          ${activeBattle ? `
            <div class="window-item-progress">
              <div class="progress-input">
                <label>Current Progress:</label>
                <input type="number" 
                       value="${activeBattle.currentCount}"
                       min="0"
                       max="${activeBattle.targetCount}"
                       onchange="updateBattleProgress(['${boss.id}', this.value])"
                       style="width: 80px; margin: 0 10px; background: transparent; color: var(--text-color); border: 1px solid var(--system-blue);">
                  /${activeBattle.targetCount} ${boss.metric}
              </div>
              <div class="battle-time-remaining" data-end-time="${activeBattle.endTime.toDate().toISOString()}" data-boss-id="${boss.id}">
                Time Remaining: ${formatTimeRemaining(activeBattle.endTime.toDate() - new Date())}
              </div>
              <div class="window-item-progress-bar" style="width: ${(activeBattle.currentCount / activeBattle.targetCount) * 100}%"></div>
            </div>
          ` : ""}
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

      // Start the battle timers
      initializeTimers();
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

      const playersRef = db.collection("players");
      const snapshot = await playersRef.orderBy("level", "desc").limit(10).get();

      snapshot.forEach((doc) => {
        const player = doc.data();
        const playerElement = document.createElement("div");
        playerElement.className = "window-item";
        
        const titleSpan = document.createElement("span");
        titleSpan.textContent = player.profile.title || "Novice";
        if (player.profile.titleColor) {
          titleSpan.style.color = player.profile.titleColor;
        }

        playerElement.innerHTML = `
          <div class="window-item-title">
            ${player.profile.name || "Anonymous"} 
            [${titleSpan.outerHTML}]
          </div>
          <div class="window-item-description">
            Level ${player.level} • Rank ${player.rank}
            <br>
            ${player.exp} XP • ${player.gold} Gold
          </div>
        `;
        leaderboardList.appendChild(playerElement);
      });
    } catch (error) {
      console.error("Error updating leaderboard window:", error);
    }
  },

  
  async updateNotificationsWindow() {
    if (!currentUser) return;
    try {
      const notificationsRef = db.collection("notifications")
        .where("userId", "==", currentUser.uid)
        .orderBy("timestamp", "desc");
      
      const snapshot = await notificationsRef.get();
      const notificationsList = document.getElementById("notificationsList");
      notificationsList.innerHTML = "";

      // Add notification management buttons
      const headerDiv = document.createElement("div");
      headerDiv.className = "notifications-header";
      headerDiv.innerHTML = `
        <div class="notifications-actions">
          <button class="notification-action-button" onclick="windowSystem.markAllNotificationsAsRead()">
            <i class="fas fa-check-double"></i> Read All
          </button>
          <button class="notification-action-button delete" onclick="windowSystem.deleteAllNotifications()">
            <i class="fas fa-trash"></i> Delete All
          </button>
        </div>
      `;
      notificationsList.appendChild(headerDiv);

      if (snapshot.empty) {
        notificationsList.innerHTML += '<div class="window-item">No notifications</div>';
        return;
      }

      snapshot.forEach((doc) => {
        const notification = doc.data();
        const notificationElement = document.createElement("div");
        notificationElement.className = `notification-item ${notification.type} ${notification.read ? 'read' : 'unread'}`;
        notificationElement.dataset.notificationId = doc.id;

        const timestamp = notification.timestamp.toDate();
        const timeString = timestamp.toLocaleString();

        let notificationContent = notification.message;
        if (notification.type === "penalty") {
          const details = notification.details;
          notificationContent = `
            <div class="notification-content">
              <strong>${notification.message}</strong>
              <div class="notification-details">
                Failed Quests: ${details.incompleteQuests}/${details.totalQuests}<br>
                ${details.levelsLost > 0 ? `Levels Lost: ${details.levelsLost}<br>` : ''}
                Previous Level: ${details.previousLevel}<br>
                New Level: ${details.newLevel}
              </div>
            </div>
          `;
        }

        notificationElement.innerHTML = `
          <div class="notification-time">
            ${timeString}
            <span class="notification-status">${notification.read ? 'Read' : 'Unread'}</span>
          </div>
          ${notificationContent}
        `;

        // Add click handler to mark as read
        if (!notification.read) {
          notificationElement.addEventListener('click', () => {
            this.markNotificationAsRead(doc.id);
          });
        }

        notificationsList.appendChild(notificationElement);
      });

      // Update notification badge
      const unreadCount = await this.getUnreadNotificationsCount();
      this.updateNotificationBadge(unreadCount);
    } catch (error) {
      console.error("Error updating notifications window:", error);
    }
  },

  async markNotificationAsRead(notificationId) {
    try {
      await db.collection("notifications").doc(notificationId).update({
        read: true
      });
      await this.updateNotificationsWindow();
      notificationSystem.show("Notification marked as read", "success");
    } catch (error) {
      console.error("Error marking notification as read:", error);
      notificationSystem.show("Error marking notification as read", "error");
    }
  },

  async markAllNotificationsAsRead() {
    try {
      const batch = db.batch();
      const notificationsRef = db.collection("notifications")
        .where("userId", "==", currentUser.uid)
        .where("read", "==", false);
      
      const snapshot = await notificationsRef.get();
      
      snapshot.forEach((doc) => {
        batch.update(doc.ref, { read: true });
      });
      
      await batch.commit();
      await this.updateNotificationsWindow();
      notificationSystem.show("All notifications marked as read", "success");
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      notificationSystem.show("Error marking notifications as read", "error");
    }
  },

  async deleteAllNotifications() {
    try {
      const batch = db.batch();
      const notificationsRef = db.collection("notifications")
        .where("userId", "==", currentUser.uid);
      
      const snapshot = await notificationsRef.get();
      
      snapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      this.updateNotificationBadge(0); // Immediately reset the badge
      await this.updateNotificationsWindow();
      notificationSystem.show("All notifications deleted", "success");
    } catch (error) {
      console.error("Error deleting all notifications:", error);
      notificationSystem.show("Error deleting notifications", "error");
    }
  },

  async getUnreadNotificationsCount() {
    if (!currentUser) return 0;
    try {
      const unreadSnapshot = await db.collection("notifications")
        .where("userId", "==", currentUser.uid)
        .where("read", "==", false)
        .get();
      return unreadSnapshot.size;
    } catch (error) {
      console.error("Error getting unread notifications count:", error);
      return 0;
    }
  },

  updateNotificationBadge(count) {
    const taskbarItem = this.getTaskbarItem("notificationsWindow");
    if (taskbarItem) {
      const existingBadge = taskbarItem.querySelector(".notification-badge");
      if (count > 0) {
        if (existingBadge) {
          existingBadge.textContent = count;
        } else {
          const badge = document.createElement("div");
          badge.className = "notification-badge";
          badge.textContent = count;
          taskbarItem.appendChild(badge);
        }
        taskbarItem.classList.add("has-notifications");
      } else {
        if (existingBadge) {
          existingBadge.remove();
        }
        taskbarItem.classList.remove("has-notifications");
      }
    }
  },

  async updateShadowArmyWindow() {
    try {
      if (!currentUser) return;
      
      const playerRef = db.collection("players").doc(currentUser.uid);
      const player = (await playerRef.get()).data();
      const shadowArmyList = document.getElementById("shadowArmyList");
      
      if (!shadowArmyList) return;
      shadowArmyList.innerHTML = '';

      // Check if shadow army exists
      if (!player.shadowArmy) {
        shadowArmyList.innerHTML = `
          <div class="window-item">
            <div class="window-item-title">Shadow Army Locked</div>
            <div class="window-item-description">Purchase the Shadow Extraction ability from the shop to start building your shadow army!</div>
          </div>
        `;
        return;
      }

      // Check if ability is unlocked
      if (!player.shadowArmy.unlockedAbility) {
        shadowArmyList.innerHTML = `
          <div class="window-item">
            <div class="window-item-title">Shadow Army Locked</div>
            <div class="window-item-description">Purchase the Shadow Extraction ability from the shop to start building your shadow army!</div>
          </div>
        `;
        return;
      }

      // Add army stats
      const statsElement = document.createElement("div");
      statsElement.className = "shadow-army-stats";
      statsElement.innerHTML = `
        <div class="window-item">
          <div class="window-item-title">Shadow Army Stats</div>
          <div class="window-item-description">
            Total Capacity: ${player.shadowArmy.soldiers?.length || 0}/${player.shadowArmy.maxSoldiers || 10}
            <br>
            Regular Shadows: ${player.shadowArmy.soldierTypes?.regular?.count || 0}
            <br>
            Elite Shadows: ${player.shadowArmy.soldierTypes?.elite?.count || 0}
            <br>
            Shadow Generals: ${player.shadowArmy.soldierTypes?.general?.count || 0}
            <br>
            Shadow Monarchs: ${player.shadowArmy.soldierTypes?.monarch?.count || 0}
          </div>
        </div>
      `;
      shadowArmyList.appendChild(statsElement);

      // Add each shadow soldier
      if (player.shadowArmy.soldiers && player.shadowArmy.soldiers.length > 0) {
        player.shadowArmy.soldiers.forEach(shadow => {
          const shadowElement = document.createElement("div");
          shadowElement.className = "window-item shadow-soldier";
          shadowElement.innerHTML = `
            <div class="window-item-title">${shadow.name}</div>
            <div class="window-item-description">
              Type: ${shadow.tier}
              <br>
              Power: ${shadow.power}
              <br>
              Extracted: ${new Date(shadow.extractedAt).toLocaleDateString()}
            </div>
            ${Object.entries(SHADOW_TIERS)
              .filter(([tier]) => tier !== shadow.tier.toUpperCase())
              .map(([tier, data]) => `
                <button onclick="upgradeShadow('${shadow.id}', '${tier.toLowerCase()}')" class="window-button">
                  Upgrade to ${data.name}
                </button>
              `).join("")}
          `;
          shadowArmyList.appendChild(shadowElement);
        });
      } else {
        const emptyMessage = document.createElement("div");
        emptyMessage.className = "window-item";
        emptyMessage.innerHTML = `
          <div class="window-item-description">
            Your shadow army is empty. Defeat bosses to extract shadow soldiers!
          </div>
        `;
        shadowArmyList.appendChild(emptyMessage);
      }

      // Add CSS if not already present
      if (!document.getElementById("shadowArmyStyles")) {
        const styleSheet = document.createElement("style");
        styleSheet.id = "shadowArmyStyles";
        styleSheet.textContent = `
          .shadow-army-stats {
            margin-bottom: 20px;
            padding: 10px;
            background: rgba(0, 0, 0, 0.3);
            border-radius: 5px;
          }
          .shadow-soldier {
            margin: 10px 0;
            padding: 15px;
            background: rgba(0, 0, 0, 0.2);
            border: 1px solid #333;
            border-radius: 5px;
          }
          .shadow-soldier:hover {
            border-color: #666;
            background: rgba(0, 0, 0, 0.3);
          }
        `;
        document.head.appendChild(styleSheet);
      }
    } catch (error) {
      console.error("Error updating shadow army window:", error);
    }
  },
};

// Initialize window system
document.addEventListener("DOMContentLoaded", () => {
  windowSystem.init();
});


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
  printToTerminal("!settitle <title> - Set your title", "info");
  printToTerminal("!setbio <text> - Set your profile bio", "info");
  printToTerminal("!setclass <class> - Set your hunter class", "info");
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

window.showSetClassPrompt = function() {
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
window.purchaseItem = async function(itemId) {
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

  // Disable the buy button to prevent multiple clicks
  const buyButton = document.querySelector(`#buy-button-${itemId}`);
  if (buyButton) {
    buyButton.disabled = true;
    buyButton.innerText = "Purchasing..."; // Optional: Change button text
  }

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
  } finally {
    // Re-enable the buy button after processing
    if (buyButton) {
      buyButton.disabled = false;
      buyButton.innerText = "Buy"; // Reset button text
    }
  }
};


window.addEventListener("load", function () {
  setTimeout(function () {
    const prompt = document.querySelector(".input-container");
    if (prompt) {
      prompt.style.display = "flex";
      setTimeout(() => (prompt.style.opacity = "1"), 100); // Smooth fade-in
    }
  }, 5500);
});

// Add bio prompt function
window.showSetBioPrompt = function() {
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

    // Update local stats first for immediate feedback
    playerStats.exp += boostedXP;
    updateStatusBar(); // Update UI immediately

    // Update the player's XP in database
    await playerRef.update({
      exp: firebase.firestore.FieldValue.increment(boostedXP),
    });

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
  const player = (await playerRef.get()).data();

  // Find the item in the player's inventory
  const inventoryItem = player.inventory.find((item) => item.id === itemId);
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
    switch (item.effect.type) {
      case "shadow_ability":
        await playerRef.update({
          "shadowArmy.unlockedAbility": true,
          "shadowArmy.soldierTypes.regular.unlocked": true
        });
        playerStats.shadowArmy.unlockedAbility = true;
        playerStats.shadowArmy.soldierTypes.regular.unlocked = true;
        printToTerminal("You have unlocked the Shadow Extraction ability!", "success");
        break;

      case "max_shadows":
        await playerRef.update({
          "shadowArmy.maxSoldiers": firebase.firestore.FieldValue.increment(item.effect.value)
        });
        playerStats.shadowArmy.maxSoldiers += item.effect.value;
        printToTerminal(`Increased shadow army capacity by ${item.effect.value}!`, "success");
        break;

      case "shadow_tier":
        await playerRef.update({
          [`shadowArmy.soldierTypes.${item.effect.value}.unlocked`]: true
        });
        playerStats.shadowArmy.soldierTypes[item.effect.value].unlocked = true;
        printToTerminal(`Unlocked ${SHADOW_TIERS[item.effect.value].name} tier!`, "success");
        break;

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

      case "title":
        await playerRef.update({
          "profile.title": item.effect.value,
          "profile.titleColor": item.effect.color || null,
          inventory: firebase.firestore.FieldValue.arrayRemove(inventoryItem),
        });
        if (!playerStats.profile) playerStats.profile = {};
        playerStats.profile.title = item.effect.value;
        playerStats.profile.titleColor = item.effect.color || null;
        printToTerminal(`Your title has been set to: ${item.effect.value}!`, "success");
        showNotification(`Title changed to: ${item.effect.value}`);
        
        // Update all windows that might display the title
        windowSystem.updateWindowContent("profileWindow");
        windowSystem.updateWindowContent("leaderboardWindow");
        windowSystem.updateWindowContent("shopWindow");
        windowSystem.updateWindowContent("inventoryWindow");
        windowSystem.updateWindowContent("questsWindow");
        windowSystem.updateWindowContent("dailyQuestsWindow");
        windowSystem.updateWindowContent("achievementsWindow");
        windowSystem.updateWindowContent("shadowArmyWindow");
        windowSystem.updateWindowContent("rankProgressWindow");
        
        // Update terminal prompt if it shows the title
        updateTerminalPrompt();
        break;

      case "title_color":
        await playerRef.update({
          "profile.titleColor": item.effect.value,
          inventory: firebase.firestore.FieldValue.arrayRemove(inventoryItem),
        });
        if (!playerStats.profile) playerStats.profile = {};
        playerStats.profile.titleColor = item.effect.value;
        printToTerminal(`Your title color has been set to: ${item.effect.value}!`, "success");
        showNotification(`Title color changed to: ${item.effect.value}`);
        
        // Update all windows that might display the title
        windowSystem.updateWindowContent("profileWindow");
        windowSystem.updateWindowContent("leaderboardWindow");
        windowSystem.updateWindowContent("shopWindow");
        windowSystem.updateWindowContent("inventoryWindow");
        windowSystem.updateWindowContent("questsWindow");
        windowSystem.updateWindowContent("dailyQuestsWindow");
        windowSystem.updateWindowContent("achievementsWindow");
        windowSystem.updateWindowContent("shadowArmyWindow");
        windowSystem.updateWindowContent("rankProgressWindow");
        rank
        // Update terminal prompt if it shows the title
        updateTerminalPrompt();
        break;

      default:
        // For items with duration-based effects, they're automatically applied
        // through the getActiveItemEffects function
        printToTerminal(`${item.name} is already active!`, "info");
        return;
    }

    // Remove item from inventory
    await playerRef.update({
      inventory: firebase.firestore.FieldValue.arrayRemove(inventoryItem),
    });

    // Update local stats
    playerStats.inventory = playerStats.inventory.filter(
      (item) => item.id !== itemId
    );

    showNotification("Item used successfully!");
    windowSystem.updateWindowContent("inventoryWindow");
    windowSystem.updateWindowContent("shadowArmyWindow");
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

        const isExpired =
          inventoryItem.expiresAt && inventoryItem.expiresAt <= Date.now();
        const timeLeft = inventoryItem.expiresAt
          ? Math.max(0, inventoryItem.expiresAt - Date.now())
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
            item.effect.type === "remove_fatigue" ||
            item.effect.type === "title" ||
            item.effect.type === "title_color");

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
                isExpired
                  ? `<div class="window-item-price">Sell price: ${calculateSellPrice(
                      item
                    )} gold</div>
                   <button onclick="sellItem('${
                     item.id
                   }')" class="window-button">Sell</button>`
                  : isUsable
                  ? `<button onclick="useItem('${item.id}')" class="window-button">Use</button>`
                  : `<div class="window-item-price">Sell price: ${calculateSellPrice(
                      item
                    )} gold</div>
                     <button onclick="sellItem('${
                       item.id
                     }')" class="window-button">Sell</button>`
              }
            </div>
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
// Make sellItem globally accessible
window.sellItem = async function(itemId) {
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
};
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


// Add speech recognition system
const speechRecognitionSystem = {
  recognition: null,
  isActivated: false,
  micButton: null,
  isListening: false,

  commandVariations: {
    // Help commands
    help: ["help", "commands", "options", "what can i do", "what to do", "show commands", "show help", "command list"],
    
    // Core commands
    reawaken: ["reawaken", "wake up", "start", "begin", "initialize", "login"],
    quests: ["quest", "quests", "tasks", "missions", "objectives", "show quests", "view quests", "normal quests"],
    dailyquests: ["daily", "daily quest", "daily quests", "daily tasks", "daily missions", "dailies", "show daily quests"],
    clear: ["clear", "clean", "reset", "wipe", "clear terminal", "clear screen"],
    sleep: ["sleep", "logout", "log out", "exit", "quit"],
    
    // Status and Progress
    leaderboard: ["leaderboard", "rankings", "leaders", "top players", "show leaderboard", "rankings"],
    achievements: ["achievements", "achieve", "badges", "trophies", "show achievements"],
    profile: ["profile", "stats", "status", "character", "show profile", "my profile"],
    inventory: ["inventory", "items", "backpack", "stuff", "gear", "show inventory", "my items"],
    shop: ["shop", "store", "market", "buy", "show shop", "marketplace"],
    notifications: ["notifications", "notification", "alerts", "show notifications", "view notifications", "my notifications", "check notifications", "show alerts", "check alerts"],
    
    // Experience and Progress
    addxp: ["add xp", "add experience", "gain xp", "experience points", "add points"],
    reset: ["reset progress", "reset game", "reset all", "start over"],
    
    // Battle System
    battle: ["battle", "battles", "boss battle", "boss battles", "show battles", "view battles", "show boss battles"],
    challenge: ["challenge", "start battle", "fight boss", "begin battle", "start boss battle", "challenge boss"],
    progress: ["battle progress", "fight progress", "update battle", "battle status", "boss progress"],
    
    // Water Tracking
    waterDrank: ["water drank", "drink water", "water intake", "hydrate", "log water", "add water", "drank water"],
    waterStatus: ["water status", "hydration status", "water progress", "check water", "show water", "view water"],
    
    // Motivation
    motivation: ["motivation", "motivate", "inspire", "encourage", "show motivation", "need motivation"],
    
    // Player Customization
    setname: ["set name", "change name", "update name", "my name", "new name"],
    settitle: ["set title", "change title", "update title", "my title", "new title"],
    setbio: ["set bio", "change bio", "update bio", "my bio", "biography", "new bio"],
    setclass: ["set class", "change class", "update class", "my class", "new class"],
    
    // Quest Management
    simulate: ["simulate", "simulate quest", "test quest", "quest timeout", "test timeout"],
    rank: ["rank", "my rank", "show rank", "rank status", "current rank"],
    rankprogress: ["rank progress", "show rank progress", "rank status", "rank advancement", "check rank"],
    penalty: ["penalty", "show penalty", "view penalty", "check penalty"],
    delete: ["delete quest", "remove quest", "delete task", "remove task"],
    questid: ["quest id", "quest ids", "show quest ids", "view quest ids", "show ids"],
    shadowarmy: ["shadow army", "show shadows", "my shadows", "view shadow army", "shadows", "show shadow army"],
    
    // Quest Completion Commands
    completedaily: ["complete all daily", "finish all daily", "complete daily quests", "finish daily quests", "complete all daily quests", "finish all dailies"],
    completenormal: ["complete all normal", "finish all normal", "complete normal quests", "finish normal quests", "complete all normal quests", "finish all normal quests"],
    update: ["update quest", "update progress", "quest progress", "task progress", "update task"],
    
    // Window Commands
    close: ["close", "hide", "minimize", "collapse", "close window"],
    open: ["open", "show", "display", "view", "go to", "check", "see", "open window"],
    toggle: ["toggle", "switch", "enable", "disable", "activate", "deactivate"]
  },

  init() {
    try {
      this.recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
      this.recognition.continuous = true;
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-US';

    this.recognition.onresult = (event) => {
        const text = event.results[event.results.length - 1][0].transcript.toLowerCase().trim();
      console.log('Raw voice input:', text);
        
        // Always check for activation phrase
        if (!this.isActivated && text.includes('activate voice')) {
          this.isActivated = true;
          showNotification("Voice commands activated! You can now speak commands.", "success");
          notificationSystem.playSound("activated");
          this.updateMicButton();
          return;
        }

        // Only process other commands if activated
        if (this.isActivated) {
          // Check for deactivation
          if (text.includes('deactivate voice') || text.includes('disable voice')) {
            this.isActivated = false;
            showNotification("Voice commands deactivated. Say 'activate voice' to enable again.", "warning");
            this.updateMicButton();
            return;
          }

      const command = this.processVoiceCommand(text);
      if (command) {
        console.log('Processed command:', command);
            // Show visual feedback in input
            const input = document.querySelector('#terminal-input');
            if (input) {
              input.value = command;
            }
            
            // Execute the command if it exists
            if (commands[command]) {
              commands[command]();
              showNotification(`Executing: ${command}`, "success");
            } else {
              printToTerminal(`Command not recognized: ${text}`, "error");
              showNotification("Command not recognized. Try again.", "error");
            }

            // Clear the input after processing
            setTimeout(() => {
              if (input) {
                input.value = "";
              }
            }, 100);
          }
        }
    };

    this.recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          showNotification('Microphone access denied. Please enable microphone permissions.', 'error');
          this.isListening = false;
          this.isActivated = false;
          this.updateMicButton();
        } else {
      this.restartListening();
        }
    };

    this.recognition.onend = () => {
        console.log('Speech recognition ended');
        this.isListening = false;
        // Always restart listening, regardless of activation state
        this.restartListening();
    };

    this.addMicrophoneButton();
      // Start listening immediately
      this.startListening();
      console.log('Speech recognition initialized successfully');
    } catch (error) {
      console.error('Error initializing speech recognition:', error);
      showNotification('Failed to initialize speech recognition', 'error');
    }
  },

  startListening() {
    if (!this.recognition || this.isListening) return;

    try {
      console.log("Starting speech recognition...");
      this.recognition.start();
      this.isListening = true;
      this.updateMicButton();
      console.log("Speech recognition started successfully");
    } catch (error) {
      console.error("Error starting speech recognition:", error);
      if (error.name === 'NotAllowedError') {
        showNotification('Microphone access denied. Please enable microphone permissions.', 'error');
        this.isListening = false;
        this.isActivated = false;
        this.updateMicButton();
      } else {
        setTimeout(() => this.restartListening(), 1000);
      }
    }
  },

  restartListening() {
    if (!this.recognition || this.isListening) return;

    try {
      this.recognition.stop();
      setTimeout(() => {
        // Always restart listening, regardless of activation state
        this.startListening();
      }, 250);
    } catch (error) {
      console.error("Error restarting speech recognition:", error);
      setTimeout(() => this.startListening(), 1000);
    }
  },

  updateMicButton() {
    if (this.micButton) {
      if (!this.isListening) {
        this.micButton.classList.remove("activated");
        this.micButton.classList.remove("listening");
        this.micButton.title = "Microphone not active";
        this.micButton.innerHTML = '<i class="fas fa-microphone-slash"></i>';
      } else if (this.isActivated) {
        this.micButton.classList.add("activated");
        this.micButton.classList.add("listening");
        this.micButton.title = "Voice commands active. Say 'deactivate voice' to disable";
        this.micButton.innerHTML = '<i class="fas fa-microphone"></i>';
      } else {
        this.micButton.classList.remove("activated");
        this.micButton.classList.add("listening");
        this.micButton.title = "Listening for 'activate voice'";
        this.micButton.innerHTML = '<i class="fas fa-microphone"></i>';
      }
    }
  },

  processVoiceCommand(text) {
    console.log("Processing voice command:", text);
    let processedText = text.toLowerCase().trim();

    // Clean up common phrases first
    processedText = processedText
      .replace(/^(what are|what is|what's)\s+/i, "show ")
      .replace(/^(i want to|let me|can i|please)\s+/i, "")
      .replace(/^(start|begin|initiate)\s+/i, "")
      .replace(/\b(my|the)\s+/i, "")
      .replace(/\s+(window|screen|page)$/i, "")
      .replace(/\b(um|uh|like|so|yeah|well)\b/g, "");

    // Handle complete all quests commands first
    if (processedText.match(/^(complete|finish)\s+all\s+(daily|normal)/i)) {
      const type = processedText.match(/daily|normal/i)[0].toLowerCase();
      return `!${type}quests`;
    }

    // Handle window closing commands
    const closeMatch = processedText.match(/^(close|hide)\s+([\w\s]+)\s+window$/i);
    if (closeMatch) {
      const windowName = closeMatch[2].trim();
      const windowId = this.findWindowId(windowName);
      if (windowId) {
          windowSystem.closeWindow(windowId);
        return null;
      }
    }

    // Handle window opening commands
    const openMatch = processedText.match(/^(open|show|display|view|go to)\s+([\w\s]+)(?:\s+window)?$/i);
    if (openMatch) {
      const windowName = openMatch[2].trim();
      const windowId = this.findWindowId(windowName);
      if (windowId) {
        windowSystem.showWindow(windowId);
        return null;
      }
    }

    // Handle complete specific quest commands
    const completeSpecificMatch = processedText.match(/^(complete|finish|do)\s+(daily|normal)\s+(.+?)(?:\s+quest)?$/i);
    if (completeSpecificMatch) {
      const questType = completeSpecificMatch[2];
      const questName = completeSpecificMatch[3];
      return `!update ${questName} ${questType.toLowerCase()} complete`;
    }

    // Check for direct command variations
    for (const [baseCommand, variations] of Object.entries(this.commandVariations)) {
      if (variations.some(v => processedText.includes(v.toLowerCase()))) {
        return `!${baseCommand}`;
      }
    }

    // If no direct match found, try fuzzy matching
    const availableCommands = Object.keys(this.commandVariations);
    const cleanText = processedText.replace(/[^a-z0-9]/g, "");
    const { command: bestMatch, similarity } = this.findBestMatch(cleanText, availableCommands);

    if (bestMatch) {
      console.log(`Fuzzy matched "${processedText}" to "!${bestMatch}" with similarity ${similarity}`);
      return `!${bestMatch}`;
    }

    return null;
  },

  findWindowId(windowName) {
    const normalizedName = windowName.toLowerCase();
    const windowMap = {
      'daily quest': 'dailyQuestsWindow',
      'daily quests': 'dailyQuestsWindow',
      'quest': 'questsWindow',
      'quests': 'questsWindow',
      'achievement': 'achievementsWindow',
      'achievements': 'achievementsWindow',
      'inventory': 'inventoryWindow',
      'profile': 'profileWindow',
      'shop': 'shopWindow',
      'leaderboard': 'leaderboardWindow',
      'boss': 'bossBattlesWindow',
      'boss battle': 'bossBattlesWindow',
      'boss battles': 'bossBattlesWindow',
      'notifications': 'notificationsWindow',
      'notification': 'notificationsWindow',
      'alerts': 'notificationsWindow',
      'rank': 'rankProgressWindow',
      'rank progress': 'rankProgressWindow',
      'shadow': 'shadowArmyWindow',
      'shadow army': 'shadowArmyWindow',
      'shadows': 'shadowArmyWindow'
    };
    return windowMap[normalizedName];
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
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-5px); }
          100% { transform: translateY(0px); }
        }
      `;
      document.head.appendChild(styleSheet);
    }

    document.body.appendChild(micButton);
    this.micButton = micButton;
  },

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
};

// Initialize speech recognition system when the page loads
document.addEventListener("DOMContentLoaded", () => {
  console.log("Document loaded, initializing speech recognition...");
  speechRecognitionSystem.init();
});

// Add touch event handling for windows
function initializeTouchEvents() {
  const windows = document.querySelectorAll(".window");
  windows.forEach((window) => {
    let touchStartX = 0;
    let touchStartY = 0;
    let initialX = 0;
    let initialY = 0;

    window.addEventListener("touchstart", (e) => {
      if (
        e.target.closest(".window-header") &&
        !e.target.closest(".window-close")
      ) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        initialX = window.offsetLeft;
        initialY = window.offsetTop;
      }
    });

    window.addEventListener("touchmove", (e) => {
      if (touchStartX && touchStartY) {
        e.preventDefault();
        const touchX = e.touches[0].clientX;
        const touchY = e.touches[0].clientY;
        const deltaX = touchX - touchStartX;
        const deltaY = touchY - touchStartY;

        window.style.left = `${initialX + deltaX}px`;
        window.style.top = `${initialY + deltaY}px`;
      }
    });

    window.addEventListener("touchend", () => {
      touchStartX = 0;
      touchStartY = 0;
    });
  });
}

// Add double-tap prevention
function preventDoubleTapZoom() {
  let lastTouchEnd = 0;
  document.addEventListener(
    "touchend",
    (e) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    },
    false
  );
}

// Optimize scrolling performance
function optimizeScrolling() {
  const scrollableElements = document.querySelectorAll(
    ".terminal-container, .window-content"
  );
  scrollableElements.forEach((element) => {
    element.style.webkitOverflowScrolling = "touch";
  });
}

// Update window initialization
const originalWindowInit = windowSystem.init;
windowSystem.init = function () {
  originalWindowInit.call(this);
  initializeTouchEvents();
  preventDoubleTapZoom();
  optimizeScrolling();

  // Add orientation change handling
  window.addEventListener("orientationchange", () => {
    setTimeout(() => {
      const windows = document.querySelectorAll(".window");
      windows.forEach((window) => {
        if (window.classList.contains("show")) {
          const viewportHeight = window.innerHeight;
          const windowHeight = window.offsetHeight;
          if (windowHeight > viewportHeight * 0.9) {
            window.style.height = "90vh";
            window.style.top = "5vh";
          }
        }
      });
    }, 100);
  });
};

async function handlePenaltyCommand() {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  try {
    printToTerminal("\nChecking daily quests for penalties...", "system");
    const now = firebase.firestore.Timestamp.now();
    const yesterday = new Date(now.toMillis() - 24 * 60 * 60 * 1000);

    const playerRef = db.collection("players").doc(currentUser.uid);
    const dailyQuestsSnapshot = await playerRef.collection("dailyQuests").get();

    let incompleteQuests = 0;
    const totalQuests = dailyQuestsSnapshot.size;
    printToTerminal(`Found ${totalQuests} total daily quests`, "info");

    dailyQuestsSnapshot.forEach((questDoc) => {
      const quest = questDoc.data();
      const lastCompletion = quest.lastCompletion ? quest.lastCompletion.toDate() : null;
      
      if (!quest.lastCompletion || quest.lastCompletion.toDate() < yesterday) {
        incompleteQuests++;
      }
    });

    printToTerminal(`Incomplete quests: ${incompleteQuests}/${totalQuests}`, "info");

    if (totalQuests > 0 && incompleteQuests > 0) {
      // Calculate penalty
      const basePenalty = 50;
      const incompletionRate = incompleteQuests / totalQuests;
      let multiplier = 1;

      if (incompletionRate > 0.5) multiplier = 1.5;
      if (incompletionRate > 0.75) multiplier = 2;
      if (incompletionRate === 1) multiplier = 2.5;

      const penaltyAmount = Math.round(basePenalty * incompleteQuests * multiplier);

      // Get current player stats
      const playerDoc = await playerRef.get();
      const player = playerDoc.data();
      const currentExp = player.exp || 0;
      const currentLevel = player.level || 1;

      // Calculate new exp and level
      let newExp = currentExp - penaltyAmount;
      let newLevel = currentLevel;

      // Ensure exp doesn't go below 100
      if (newExp < 100) {
        newExp = 100;
      }

      // If exp goes negative, reduce levels and add the correct exp for each level
      while (newExp < 0 && newLevel > 1) {
        newLevel--;
        newExp += getExpNeededForLevel(newLevel);
      }

      // Ensure exp doesn't go below 0 at level 1
      if (newLevel === 1 && newExp < 0) {
        newExp = 0;
      }

      const levelsLost = currentLevel - newLevel;

      // Update player stats
      await playerRef.update({
        exp: newExp,
        level: newLevel,
        lastPenalty: now,
        lastPenaltyAmount: penaltyAmount,
      });

      // Create penalty log
      await db.collection("penaltyLogs").add({
        userId: currentUser.uid,
        timestamp: now,
        incompleteQuests,
        totalQuests,
        penaltyAmount,
        previousExp: currentExp,
        previousLevel: currentLevel,
        newExp,
        newLevel,
        expLost: currentExp - newExp,
        levelsLost,
      });

      // Create notification
      await db.collection("notifications").add({
        userId: currentUser.uid,
        type: "penalty",
        timestamp: now,
        read: false,
        message: `Daily Quest Penalty: Failed to complete ${incompleteQuests} out of ${totalQuests} quests. Lost ${penaltyAmount} XP${levelsLost > 0 ? ` and ${levelsLost} level${levelsLost > 1 ? 's' : ''}` : ''}.`,
        details: {
          incompleteQuests,
          totalQuests,
          penaltyAmount,
          expLost: currentExp - newExp,
          levelsLost,
          previousLevel: currentLevel,
          newLevel
        }
      });

      printToTerminal("\n=== PENALTY APPLIED ===", "error");
      printToTerminal(`Failed Quests: ${incompleteQuests}/${totalQuests}`, "error");
      printToTerminal(`XP Lost: ${penaltyAmount}`, "error");
      if (levelsLost > 0) {
        printToTerminal(`Levels Lost: ${levelsLost}`, "error");
      }
      printToTerminal(`Previous Level: ${currentLevel}`, "info");
      printToTerminal(`New Level: ${newLevel}`, "info");
      printToTerminal(`Previous EXP: ${currentExp}`, "info");
      printToTerminal(`New EXP: ${newExp}`, "info");

      // Update UI
      updateStatusBar();
      windowSystem.updateWindowContent("profileWindow");
      windowSystem.updateWindowContent("notificationsWindow");

      audioSystem.playVoiceLine('PENALTY');
      printToTerminal("\n=== PENALTY APPLIED ===", "error");
    } else {
      printToTerminal("No penalties needed - all quests are complete!", "success");
    }
  } catch (error) {
    console.error("Error in penalty command:", error);
    printToTerminal("Error checking penalties: " + error.message, "error");
  }
}

// Add delete quest function
async function deleteQuest(questId, type) {
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
    await questRef.delete();
    
    printToTerminal(`Quest "${quest.title}" deleted successfully!`, "success");
    windowSystem.updateWindowContent(type === "daily" ? "dailyQuestsWindow" : "questsWindow");
  } catch (error) {
    printToTerminal("Error deleting quest: " + error.message, "error");
  }
}

// Add delete command handler
commands["!delete"] = async (args) => {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  if (args.length < 2) {
    printToTerminal("Usage: !delete [quest/daily] [questId]", "error");
    return;
  }

  const type = args[0].toLowerCase();
  const questId = args[1];

  if (type !== "quest" && type !== "daily") {
    printToTerminal("Invalid type. Use 'quest' or 'daily'.", "error");
    return;
  }

  await deleteQuest(questId, type === "daily" ? "daily" : "normal");
};

// Make delete function available globally
window.deleteQuest = deleteQuest;

// Voice Lines System
const VOICE_LINES = {
  LEVEL_UP: [
    'I am getting stronger.',
    'My power... it\'s growing.',
    'This is just the beginning.',
    'I can feel it... I\'m becoming more powerful.',
    'Each level makes me stronger.'
  ],
  QUEST_COMPLETE: [
    'Another quest completed.',
    'Mission accomplished.',
    'All according to plan.',
    'One step closer to becoming the strongest hunter.',
    'That was merely a warm-up.'
  ],
  BOSS_START: [
    'Arise.',
    'Let\'s test your strength.',
    'Show me what you\'ve got.',
    'This might be interesting.',
    'Time to hunt.'
  ],
  BOSS_VICTORY: [
    'Know your place.',
    'Is that all you\'ve got?',
    'You were not strong enough.',
    'Another one falls.',
    'Victory was inevitable.'
  ],
  DEMON_BATTLE: [
    'Face your demons.',
    'Conquer your weaknesses.',
    'Your fears make you weak.',
    'Overcome your limits.',
    'Break through your barriers.'
  ],
  ACHIEVEMENT: [
    'Progress... I can feel it.',
    'Another milestone reached.',
    'Getting closer to my goal.',
    'This is just a stepping stone.',
    'Becoming stronger every day.'
  ],
  DAILY_RESET: [
    'A new day begins.',
    'Time to get stronger.',
    'Another day of hunting.',
    'Let\'s see what today brings.',
    'Ready for today\'s challenges.'
  ],
  PENALTY: [
    'Unacceptable.',
    'I must do better.',
    'This weakness... I\'ll overcome it.',
    'A setback... but temporary.',
    'Learn from failure.'
  ],
  RANK_UP: [
    'My rank increases.',
    'Moving up in the world.',
    'One step closer to the top.',
    'The shadow monarch rises.',
    'Power befitting my status.'
  ],
  STREAK: [
    'Consistency is key.',
    'Day after day, growing stronger.',
    'My dedication shows results.',
    'The path to power is endless.',
    'No days wasted.'
  ]
};

// Audio System
const audioSystem = {
  playVoiceLine(category) {
    if (!VOICE_LINES[category]) return;
    
    const lines = VOICE_LINES[category];
    const randomLine = lines[Math.floor(Math.random() * lines.length)];
    
    // Convert the line to a filename format (lowercase, spaces to underscores)
    const filename = randomLine.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const audioPath = `sounds/voice/${filename}.mp3`;
    
    const audio = new Audio(audioPath);
    audio.volume = 0.7; // Adjust volume as needed
    
    try {
      audio.play().catch((error) => {
        console.log('Voice line not available:', error);
      });
    } catch (error) {
      console.log('Error playing voice line:', error);
    }
  }
};

// Modify the levelUp notification to include voice line
function handleLevelUp(levelsGained) {
  // ... existing level up code ...
  audioSystem.playVoiceLine('LEVEL_UP');
}

function handleQuestComplete() {
  audioSystem.playVoiceLine('QUEST_COMPLETE');
}

function handleBossBattleStart() {
  audioSystem.playVoiceLine('BOSS_START');
}

function handleAchievementUnlock() {
  audioSystem.playVoiceLine('ACHIEVEMENT');
}

function handleDailyReset() {  audioSystem.playVoiceLine('DAILY_RESET');
}

function handlePenalty() {
  audioSystem.playVoiceLine('PENALTY');
}

function handleRankUp() {
  audioSystem.playVoiceLine('RANK_UP');
}

function handleStreakMilestone() {
  audioSystem.playVoiceLine('STREAK');
}






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
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
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

    audioSystem.playVoiceLine('RANK_UP');
    printToTerminal(`\n🎉 RANK UP! You are now rank ${newRank}!`, "success");

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
    windowSystem.updateWindowContent("battleWindow");
    
    // Play penalty sound
    handlePenalty();
  } catch (error) {
    console.error("Error handling boss battle timeout:", error);
  }
}



function calculateSellPrice(item) {
  return Math.floor(item.price * 0.5);
}

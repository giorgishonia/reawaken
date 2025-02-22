/**
 * Firebase Cloud Functions for Solo Leveling Game
 * @module functions
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

admin.initializeApp();

/**
 * Resets all daily quests for a player
 * @param {FirebaseFirestore.DocumentReference} playerRef - Reference to the player's document
 * @return {Promise<void>}
 */
async function resetDailyQuests(playerRef) {
  const dailyQuestsSnapshot = await playerRef.collection("dailyQuests").get();
  
  const batch = admin.firestore().batch();
  
  dailyQuestsSnapshot.forEach((questDoc) => {
    batch.update(questDoc.ref, {
      completed: false,
      currentCount: 0,
      lastCompletion: null
    });
  });
  
  await batch.commit();
}

/**
 * Cloud function that resets daily quests and applies penalties
 * Runs every day at midnight Tbilisi time
 * @return {Promise<null>} Returns null on completion
 */
exports.checkDailyQuestsPenalties = onSchedule(
  {
    schedule: "0 0 * * *",
    timeZone: "Asia/Tbilisi",
    retryCount: 3,
    maxInstances: 1,
  },
  async () => {
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();
    const yesterday = new Date(now.toMillis() - 24 * 60 * 60 * 1000);

    try {
      console.log("Starting daily quest reset and penalties check at:", now.toDate());
      const usersSnapshot = await db.collection("players").get();
      console.log("Found", usersSnapshot.size, "players to process");

      for (const userDoc of usersSnapshot.docs) {
        console.log("Processing player:", userDoc.id);
        const playerRef = db.collection("players").doc(userDoc.id);
        
        // First, reset all daily quests
        console.log("Resetting daily quests for player:", userDoc.id);
        await resetDailyQuests(playerRef);
        
        // Then check for penalties
        const dailyQuestsSnapshot = await playerRef
          .collection("dailyQuests")
          .get();

        let incompleteQuests = 0;
        const totalQuests = dailyQuestsSnapshot.size;
        console.log("Player has", totalQuests, "total daily quests");

        dailyQuestsSnapshot.forEach((questDoc) => {
          const quest = questDoc.data();
          const lastCompletion = quest.lastCompletion
            ? quest.lastCompletion.toDate()
            : null;
          console.log(
            "Quest:",
            questDoc.id,
            "Last completion:",
            lastCompletion
          );

          if (
            !quest.lastCompletion ||
            quest.lastCompletion.toDate() < yesterday
          ) {
            incompleteQuests++;
            console.log("Quest", questDoc.id, "is incomplete");
          }
        });

        console.log(
          "Player has",
          incompleteQuests,
          "incomplete quests out of",
          totalQuests
        );

        if (totalQuests > 0 && incompleteQuests > 0) {
          console.log("Applying penalty to player:", userDoc.id);
          await applyPenalty(
            db,
            playerRef,
            userDoc.id,
            incompleteQuests,
            totalQuests,
            now
          );
        } else {
          console.log("No penalty needed for player:", userDoc.id);
        }
      }

      console.log("Daily quest reset and penalties check completed successfully");
      return null;
    } catch (error) {
      console.error("Error in daily quest processing:", error);
      return null;
    }
  }
);

// First add the getExpNeededForLevel function
function getExpNeededForLevel(level) {
  if (level <= 10) {
    return 100; // Base exp for levels 1-10
  } else if (level <= 20) {
    return 150; // Increased exp for levels 11-20
  } else if (level <= 30) {
    return 200; // Further increased for levels 21-30
  } else {
    // For levels 31+, use a formula that scales with level
    return Math.floor(100 * Math.pow(1.1, level - 1));
  }
}

/**
 * Applies penalty to a player and logs the action
 * @param {FirebaseFirestore.Firestore} db - Firestore instance
 * @param {FirebaseFirestore.DocumentReference} playerRef - Reference to the player's document
 * @param {string} userId - The ID of the user
 * @param {number} incompleteQuests - Number of incomplete quests
 * @param {number} totalQuests - Total number of quests
 * @param {FirebaseFirestore.Timestamp} now - Current timestamp
 * @return {Promise<void>}
 */
async function applyPenalty(
  db,
  playerRef,
  userId,
  incompleteQuests,
  totalQuests,
  now
) {
  const playerDoc = await playerRef.get();
  const player = playerDoc.data();
  const currentExp = player.exp || 0;
  const currentLevel = player.level || 1;
  const penaltyAmount = calculatePenalty(incompleteQuests, totalQuests);

  console.log("Current player stats:", {
    userId,
    currentExp,
    currentLevel,
    penaltyAmount,
  });

  // Calculate new exp and level after penalty
  let newExp = currentExp - penaltyAmount;
  let newLevel = currentLevel;

  // If exp goes below minimum (100), reduce levels if possible
  while (newExp < 100 && newLevel > 1) {
    newLevel--;
    // Add exp for the lost level
    newExp += getExpNeededForLevel(newLevel);
  }

  // Final check to ensure exp never goes below 100
  if (newExp < 100) {
    newExp = 100;
  }

  console.log("New player stats after calculation:", {
    newExp,
    newLevel,
    levelLost: currentLevel - newLevel,
  });

  // Update player's experience and level
  await playerRef.update({
    exp: newExp,
    level: newLevel,
    lastPenalty: now,
    lastPenaltyAmount: penaltyAmount,
  });

  const levelsLost = currentLevel - newLevel;

  console.log("Player stats updated:", {
    userId,
    oldExp: currentExp,
    newExp: newExp,
    oldLevel: currentLevel,
    newLevel: newLevel,
    expLost: currentExp - newExp,
    levelsLost: levelsLost,
  });

  // Create penalty log
  await db.collection("penaltyLogs").add({
    userId,
    timestamp: now,
    incompleteQuests,
    totalQuests,
    penaltyAmount,
    previousExp: currentExp,
    previousLevel: currentLevel,
    newExp,
    newLevel,
    expLost: currentExp - newExp,
    levelsLost: levelsLost,
  });

  await db.collection("notifications").add({
    userId,
    type: "penalty",
    timestamp: now,
    read: false,
    message: `Daily Quest Penalty: Failed to complete ${incompleteQuests} out of ${totalQuests} quests. Lost ${penaltyAmount} XP${levelsLost > 0 ? ` and ${levelsLost} level${levelsLost > 1 ? 's' : ''}` : ''}.`,
    details: {
      incompleteQuests,
      totalQuests,
      penaltyAmount,
      expLost: currentExp - newExp,
      levelsLost: levelsLost,
      previousLevel: currentLevel,
      newLevel
    }
  });
}

/**
 * Calculates the penalty amount based on incomplete quests
 * @param {number} incompleteQuests - Number of incomplete quests
 * @param {number} totalQuests - Total number of quests
 * @return {number} The calculated penalty amount
 */
function calculatePenalty(incompleteQuests, totalQuests) {
  const basePenalty = 50;
  const incompletionRate = incompleteQuests / totalQuests;
  let multiplier = 1;

  if (incompletionRate > 0.5) multiplier = 1.5;
  if (incompletionRate > 0.75) multiplier = 2;
  if (incompletionRate === 1) multiplier = 2.5;

  const penalty = Math.round(basePenalty * incompleteQuests * multiplier);
  console.log("Calculated penalty:", {
    incompleteQuests,
    totalQuests,
    incompletionRate,
    multiplier,
    basePenalty,
    finalPenalty: penalty,
  });
  return penalty;
}

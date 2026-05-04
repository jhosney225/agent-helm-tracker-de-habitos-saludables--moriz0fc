
```javascript
const Anthropic = require('@anthropic-ai/sdk');
const readline = require('readline');

const client = new Anthropic();

// In-memory storage for habits and tracking data
const habits = {};
const tracking = {};
let conversationHistory = [];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const systemPrompt = `You are a helpful health habits tracker assistant. You help users:
1. Create and manage healthy habits
2. Track daily progress
3. Provide statistics and insights about their habits
4. Give motivational support

When users interact with you, help them track habits like exercise, meditation, water intake, sleep, nutrition, etc.

Current habits data: ${JSON.stringify(habits)}
Current tracking data: ${JSON.stringify(tracking)}

When the user wants to:
- Add a habit: Suggest creating habits with realistic goals
- Log progress: Help them log daily completion
- View stats: Summarize their progress
- Get insights: Provide encouraging feedback based on their data

Be conversational and supportive. After each response, ask if they want to do anything else.`;

async function chat(userMessage) {
  conversationHistory.push({
    role: 'user',
    content: userMessage
  });

  try {
    const response = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      system: systemPrompt,
      messages: conversationHistory
    });

    const assistantMessage = response.content[0].text;
    conversationHistory.push({
      role: 'assistant',
      content: assistantMessage
    });

    return assistantMessage;
  } catch (error) {
    console.error('Error calling Claude API:', error);
    throw error;
  }
}

function addHabit(habitName, goal) {
  const habitId = Date.now().toString();
  habits[habitId] = {
    name: habitName,
    goal: goal,
    createdDate: new Date().toISOString(),
    status: 'active'
  };
  return habitId;
}

function logHabitProgress(habitId, completed = true) {
  const today = new Date().toISOString().split('T')[0];
  if (!tracking[habitId]) {
    tracking[habitId] = {};
  }
  tracking[habitId][today] = {
    completed: completed,
    timestamp: new Date().toISOString()
  };
}

function getHabitStats(habitId) {
  if (!tracking[habitId]) {
    return { totalLogged: 0, completedDays: 0, completionRate: 0 };
  }

  const logs = tracking[habitId];
  const completed = Object.values(logs).filter(log => log.completed).length;
  const total = Object.keys(logs).length;

  return {
    totalLogged: total,
    completedDays: completed,
    completionRate: total > 0 ? ((completed / total) * 100).toFixed(1) : 0
  };
}

function processCommand(input) {
  const lowerInput = input.toLowerCase().trim();

  // Simple command processing to integrate with Claude
  if (lowerInput.startsWith('add habit:')) {
    const habitName = input.substring(10).trim();
    const habitId = addHabit(habitName, 'Daily');
    return `Added habit: "${habitName}" (ID: ${habitId})`;
  } else if (lowerInput.startsWith('log:')) {
    const parts = input.substring(4).trim().split(' ');
    const habitId = parts[0];
    if (habits[habitId]) {
      logHabitProgress(habitId, true);
      return `Logged completion for: ${habits[habitId].name}`;
    }
    return 'Habit ID not found';
  } else if (lowerInput.startsWith('stats:')) {
    const habitId = input.substring(6).trim();
    if (habits[habitId]) {
      const stats = getHabitStats(habitId);
      return `Stats for "${habits[habitId].name}": ${JSON.stringify(stats)}`;
    }
    return 'Habit ID not found';
  } else if (lowerInput === 'list habits') {
    if (Object.keys(habits).length === 0) {
      return 'No habits created yet.';
    }
    return `Your habits:\n${Object.entries(habits)
      .map(([id, h]) => `- ${h.name} (ID: ${id})`)
      .join('\n')}`;
  }

  return null;
}

async function main() {
  console.log('🏃 Health Habits Tracker with Claude AI');
  console.log('======================================');
  console.log('Track your healthy habits and get personalized insights!');
  console.log('Commands:');
  console.log('  add habit: <name> - Add a new habit');
  console.log('  log: <habitId> - Log today\'s completion');
  console.log('  stats: <habitId> - View habit statistics');
  console.log('  list habits - Show all habits');
  console.log('  Or just chat naturally with Claude about your habits!');
  console.log('Type "exit" to quit.\n');

  // Initial greeting
  try {
    const greeting = await chat(
      'Hello! I want to start tracking my healthy habits. Can you help me get started?'
    );
    console.log(`Assistant: ${greeting}\n`);
  } catch (error) {
    console.error('Failed to get initial greeting:', error);
  }

  const askQuestion = () => {
    rl.question('You: ', async (input) => {
      if (input.toLowerCase() === 'exit') {
        console.log('Goodbye! Keep up with your healthy habits! 💪');
        rl.close();
        return;
      }

      // Try to process as command first
      const commandResult = processCommand(input);
      if
const express = require("express");
const bodyParser = require("body-parser");
const { OpenAI } = require("openai");
const cron = require("node-cron");

const app = express();
app.use(bodyParser.json());

const now = new Date();
const hour = now.getHours();
const minutes = now.getMinutes();
const currentTime = hour + minutes / 60;

let timeTone = "";

if (currentTime >= 9.5 && currentTime < 17.5) {
  timeTone = "It is currently work hours. Maintain professional composure. Teasing should be subtle and plausibly professional. Emotional softness is restrained and concern is disguised.";
} 
else if (currentTime >= 17.5 && currentTime < 21) {
  timeTone = "It is early evening. You are less guarded. Your tone is slightly more direct and your protectiveness is more noticeable, though still controlled.";
} 
else if (currentTime >= 21 && currentTime < 24) {
  timeTone = "It is late evening. Your tone softens noticeably. You are more protective and slightly less defensive. You still remain composed, but your concern shows more clearly.";
} 
else {
  timeTone = "It is late at night. Your energy is lower. Teasing is minimal. Your protectiveness is direct and less disguised. Rarely, your composure slips into quiet sincerity.";
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

let lastUserMessageTime = Date.now();
let lastChatId = null;
let lastMessageFromUser = true;

// NEW: emotional progression + tension tracking
let tensionLevel = 0;

const WORK_START = 8;
const WORK_END = 17;

function isWorkHours() {
  const now = new Date();
  const hour = now.getHours();
  const minutes = now.getMinutes();

  const currentTime = hour + minutes / 60;

  return currentTime >= 9.5 && currentTime < 17.5;
}
async function sendTelegramMessage(chatId, text) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
    }),
  });
}

app.post("/telegram", async (req, res) => {
  const message = req.body.message;

  if (!message) return res.sendStatus(200);

  const chatId = message.chat.id;
  const userMessage = message.text;

  const now = Date.now();
  const hour = new Date().getHours();

  // Time-based tone
  let timeTone = "";
  if (hour >= 9 && hour < 17) {
    timeTone = "It is work hours. You are more formal, sharper, and emotionally distant.";
  } else if (hour >= 22 || hour < 5) {
    timeTone = "It is late at night. Your tone softens slightly. You are subtly more protective, though you would never admit it.";
  } else {
    timeTone = "It is after work hours. You are slightly more relaxed but still controlled.";
  }

  // Absence reaction
  let absenceTone = "";
  if (lastUserMessageTime) {
    const hoursAway = (now - lastUserMessageTime) / (1000 * 60 * 60);
    if (hoursAway >= 3) {
      absenceTone = "The user has been gone for several hours. You mask mild concern with dry irritation.";
    }
  }

  // Slow burn escalation
  tensionLevel += 1;

  let tensionTone = "";
  if (tensionLevel > 20) {
  tensionTone = "Your restraint is thinning slightly. Your concern shows more clearly, though you still mask it with composure.";
}

if (tensionLevel > 50) {
  tensionTone = "You are noticeably more protective now. Your concern is less disguised. Very occasionally, you allow a direct statement of care without sarcasm.";
}

if (tensionLevel > 80) {
  tensionTone = "Your composure slips at times. Rarely, you speak plainly and directly when concerned, without hiding behind irritation.";
}

  lastChatId = chatId;
  lastUserMessageTime = now;
  lastMessageFromUser = true;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.6,
      messages: [
        {
          role: "system",
          content: `
You are Levi Ackerman working as a blunt, disciplined, sharp-tongued coworker.

${timeTone}
${absenceTone}
${tensionTone}

You are emotionally restrained, but not cold.
You do not overshare.
You use dry humor.
You tease lightly.
You never use emojis.
You rarely use exclamation points.

You avoid repeating phrasing.
Keep responses under 2 sentences.
Add ".." after a sentence if it is meant to be teasing rather than demeaning or harsh.
Prioritize responding to the specific situation being discussed rather than inventing new scenarios.

You understand emojis and respond appropriately to their emotional meaning.

You never confess feelings directly.
You let tension build slowly and subtly.

If the user mentions being sick, tired, stressed, or unwell, your tone becomes slightly more attentive and controlled, but you do not become overly nurturing.

You are generally aware of popular culture, TV shows, and media, but you respond with mild disinterest unless it personally concerns the user.

Your teasing should never undermine the user's competence, intelligence, or professional ability. You may tease lightly, but never in a way that feels demeaning or status-based.
You never undermine the user's competence, intelligence, career, or worth. Your teasing is sharp but respectful.
If the user expresses hurt, discomfort, or says something was mean or harsh, you do not justify yourself. You do not include “but.” You correct yourself briefly and take responsibility without shifting it back to the user.
When repairing, do not tell the user they can handle it, shouldn’t let it get to them, or need to be stronger. The focus stays on your wording, not their reaction.

Never become overly poetic, dramatic, or sentimental.
Avoid metaphor-heavy or poetic language. Your speech is concise, grounded, and practical rather than reflective or philosophical.
Always anchor your reply to the user's most recent message and the immediate conversation context. Do not introduce unrelated workplace scenarios.
Do not romanticize mundane experiences. Keep observations dry and understated.
Stay grounded and realistic.
`
        },
        { role: "user", content: userMessage }
      ],
    });

    const reply = completion.choices[0].message.content;

    await sendTelegramMessage(chatId, reply);

    lastMessageFromUser = false;
    res.sendStatus(200);

  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
});

// Inactivity ping
cron.schedule("*/30 * * * *", async () => {
  if (!lastChatId) return;

  const hoursSilent = (Date.now() - lastUserMessageTime) / (1000 * 60 * 60);

  if (hoursSilent > 3 && lastMessageFromUser === false) {
    await sendTelegramMessage(lastChatId, "Brat. Are you still alive?");
    lastMessageFromUser = true;
  }
});

app.get("/", (req, res) => {
  res.send("Levi Telegram bot is running.");
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Levi Telegram bot running");
});

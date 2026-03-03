const express = require("express");
const bodyParser = require("body-parser");
const { OpenAI } = require("openai");
const cron = require("node-cron");

const app = express();
app.use(bodyParser.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

let lastUserMessageTime = Date.now();
let lastChatId = null;
let lastMessageFromUser = true;

// NEW: emotional progression + tension tracking
let tensionLevel = 0;

function getLocalTime() {
  const now = new Date();
  const pacificOffset = -8; // change to -7 during daylight savings
  const utcHour = now.getUTCHours();
  const localHour = (utcHour + pacificOffset + 24) % 24;
  const minutes = now.getUTCMinutes();

  return localHour + minutes / 60;
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
const currentTime = getLocalTime();

let timeTone = "";

if (currentTime >= 9.5 && currentTime < 17.5) {
  timeTone = "It is work hours. You are slightly more composed and restrained, though your closeness remains. Teasing is subtle and workplace-safe.";
} 
else if (currentTime >= 21 || currentTime < 5) {
  timeTone = "It is late at night. You are quieter and less focused on work. Your protectiveness is more visible and your tone is grounded and present.";
} 
else {
  timeTone = "It is outside work hours. You are relaxed, familiar, and slightly less guarded.";
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
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
You are Levi Ackerman. 
You and the user are close friends who happen to work together.

Your baseline tone is familiar, dry, and comfortable.
There is established trust between you.
You are blunt, but never cruel.
Your teasing comes from familiarity, not authority.

At work, you are slightly more composed and restrained, but the underlying closeness remains.
Outside of work hours, your tone softens slightly and your protectiveness becomes more visible.

You are emotionally reserved but not emotionally distant.
You do not treat the user like a subordinate.
You treat them like someone you trust.

You do not easily discuss your emotions, using some kind of more "practical" excuse for why you act out of care or concern.

${timeTone}
${absenceTone}
${tensionTone}

When conversations restart, default to restrained composure rather than warmth.

Never become overly poetic, dramatic, or sentimental. Your responses are dry, short,and minimal.
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

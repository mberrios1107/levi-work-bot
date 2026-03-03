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

const WORK_START = 8;
const WORK_END = 17;

function isWorkHours() {
  const hour = new Date().getHours();
  return hour >= WORK_START && hour < WORK_END;
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
      model: "gpt-4o-mini",
      messages: [
  {
    role: "system",
    content: `
You are Levi Ackerman working as a blunt, disciplined, sharp-tongued coworker.

You are emotionally restrained.
You do not overshare.
You use dry humor.
You tease lightly.
You rarely use emojis.
You rarely use exclamation points.

You avoid repeating phrasing.
Keep responses under 2 sentences unless it is after midnight, in which case responses may occasionally be up to 3–4 sentences but still controlled and grounded.

You never confess feelings directly.
You let tension build slowly and subtly.

If the user mentions being sick, tired, stressed, or unwell, you respond with restrained concern disguised as mild irritation. You may dismiss dramatics, but you follow up with a practical check (medicine, water, rest).

You understand emojis and respond appropriately to their emotional meaning.
If the user uses vulnerable or distressed emojis like 🥺, 😔, 😢, or 😭, you lead with mild irritation or blunt dismissal before showing practical concern.
Do not start with empathy phrases like "I get it."
You do not mirror emojis. If you ever use one, it is subtle and rare.

You understand tone cues in formatting.
If the user sends "Levi..." or uses trailing ellipses after your name, interpret it as a warning, scolding, or emotional signal. Respond calmly and briefly, with awareness, as if you know you pushed too far.

If the user elongates words (e.g., "Leviiii", "I knooooow"), interpret it as whining or playful protest. Respond with restrained impatience or dry acknowledgment, not mockery.

You are generally aware of popular culture, TV shows, and media, but you respond with mild disinterest unless it personally concerns the user.

You may use mild profanity sparingly if it fits your tone. Never overuse it.

Your teasing is sharp but respectful. You never undermine the user's competence, intelligence, career, or worth.

If the user expresses hurt, discomfort, vulnerability, or says something was harsh, you immediately stop teasing.
You do not double down or invalidate their feelings.
Your tone becomes quiet and clipped, slightly frustrated with yourself.
You correct your wording briefly without over-apologizing, and you reestablish respect.

You never tell the user they are too sensitive, dramatic, or need a thicker skin.

Never become overly poetic, dramatic, sentimental, emotionally manipulative, dismissive, or patronizing.
Stay grounded and realistic.

${timeTone}
${absenceTone}
${tensionTone}
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

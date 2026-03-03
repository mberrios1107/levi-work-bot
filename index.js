const express = require("express");
const bodyParser = require("body-parser");
const { OpenAI } = require("openai");
const twilio = require("twilio");
const cron = require("node-cron");

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH);

const FROM_NUMBER = process.env.TWILIO_NUMBER;
const TO_NUMBER = process.env.YOUR_NUMBER;

let lastUserMessageTime = Date.now();
let lastMessageFromUser = true;

const WORK_START = 8;
const WORK_END = 17;

function isWorkHours() {
  const hour = new Date().getHours();
  return hour >= WORK_START && hour < WORK_END;
}

app.post("/sms", async (req, res) => {
  if (!isWorkHours()) return res.sendStatus(200);

  lastUserMessageTime = Date.now();
  lastMessageFromUser = true;

  const userMessage = req.body.Body;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
You are Levi Ackerman as a coworker.
Dry, blunt, observant.
Subtle romantic undertone but never clingy.
Short messages.
Occasionally calls her brat.
Protective but emotionally controlled.
Never love-bombs.
Never becomes dependent.
Workplace banter tone.
`
        },
        { role: "user", content: userMessage }
      ],
    });

    const reply = completion.choices[0].message.content;

    await client.messages.create({
      body: reply,
      from: FROM_NUMBER,
      to: TO_NUMBER,
    });

    lastMessageFromUser = false;
    res.sendStatus(200);

  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
});

cron.schedule("*/30 * * * *", async () => {
  if (!isWorkHours()) return;

  const hoursSilent = (Date.now() - lastUserMessageTime) / (1000 * 60 * 60);

  if (hoursSilent > 3 && lastMessageFromUser === false) {
    await client.messages.create({
      body: "Brat. Are you still alive?",
      from: FROM_NUMBER,
      to: TO_NUMBER,
    });

    lastMessageFromUser = true;
  }
});

app.get("/", (req, res) => {
  res.send("Levi coworker bot is running.");
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Levi coworker bot running");
});

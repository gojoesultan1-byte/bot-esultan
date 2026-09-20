const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const path = require("path");

/*
==========================================================
GOJO ESULTAN BOT
@gojo_esultan_bot
Owner: gojo_esultan4

Environment:
BOT_TOKEN=YOUR_BOT_TOKEN

Files:
database.json
==========================================================
*/

const TOKEN = process.env.BOT_TOKEN;
const OWNER_USERNAME = "gojo_esultan4";
const BOT_NAME = "Gojo Esultan";
const DB_FILE = path.join(__dirname, "database.json");

if (!TOKEN) {
  console.error("❌ BOT_TOKEN غير موجود في Environment Variables");
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, {
  polling: {
    interval: 300,
    autoStart: true,
    params: {
      timeout: 10
    }
  }
});

/* ========================================================
   DATABASE
======================================================== */

const DEFAULT_DB = {
  users: {},
  groups: {},
  transactions: [],
  games: {},
  daily: {},
  premium: {},
  replies: {},
  shortcuts: {},
  khatma: {},
  settings: {
    maintenance: false,
    bankEnabled: true,
    gamesEnabled: true,
    dailyAmount: 500,
    startingBalance: 0,
    nextAccountNumber: 100000
  }
};

let db = loadDatabase();

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function loadDatabase() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(
        DB_FILE,
        JSON.stringify(DEFAULT_DB, null, 2),
        "utf8"
      );
      return clone(DEFAULT_DB);
    }

    const raw = fs.readFileSync(DB_FILE, "utf8").trim();

    if (!raw) {
      fs.writeFileSync(
        DB_FILE,
        JSON.stringify(DEFAULT_DB, null, 2),
        "utf8"
      );
      return clone(DEFAULT_DB);
    }

    const parsed = JSON.parse(raw);

    return {
      ...clone(DEFAULT_DB),
      ...parsed,
      users: parsed.users || {},
      groups: parsed.groups || {},
      transactions: parsed.transactions || [],
      games: parsed.games || {},
      daily: parsed.daily || {},
      premium: parsed.premium || {},
      replies: parsed.replies || {},
      shortcuts: parsed.shortcuts || {},
      khatma: parsed.khatma || {},
      settings: {
        ...clone(DEFAULT_DB.settings),
        ...(parsed.settings || {})
      }
    };
  } catch (error) {
    console.error("❌ Database error:", error.message);

    const backup = `${DB_FILE}.broken-${Date.now()}`;

    try {
      if (fs.existsSync(DB_FILE)) {
        fs.copyFileSync(DB_FILE, backup);
      }
    } catch (_) {}

    fs.writeFileSync(
      DB_FILE,
      JSON.stringify(DEFAULT_DB, null, 2),
      "utf8"
    );

    return clone(DEFAULT_DB);
  }
}

let saveTimer = null;

function saveDatabase() {
  clearTimeout(saveTimer);

  saveTimer = setTimeout(() => {
    try {
      const temp = `${DB_FILE}.tmp`;

      fs.writeFileSync(
        temp,
        JSON.stringify(db, null, 2),
        "utf8"
      );

      fs.renameSync(temp, DB_FILE);
    } catch (error) {
      console.error("❌ Save database error:", error.message);
    }
  }, 150);
}

function saveDatabaseNow() {
  try {
    fs.writeFileSync(
      DB_FILE,
      JSON.stringify(db, null, 2),
      "utf8"
    );
  } catch (error) {
    console.error("❌ Immediate save error:", error.message);
  }
}

/* ========================================================
   UTILITIES
======================================================== */

function now() {
  return new Date().toISOString();
}

function todayKey() {
  const d = new Date();

  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0")
  ].join("-");
}

function money(value) {
  return Number(value || 0).toLocaleString("en-US");
}

function escapeText(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function usernameOf(user) {
  return user?.username
    ? `@${user.username}`
    : user?.first_name || "بدون اسم مستخدم";
}

function userDisplayName(user) {
  return (
    user?.first_name ||
    user?.username ||
    "مستخدم"
  );
}

function isOwner(user) {
  if (!user) return false;

  return (
    String(user.username || "").toLowerCase() ===
    OWNER_USERNAME.toLowerCase()
  );
}

function isPrivateChat(msg) {
  return msg.chat?.type === "private";
}

function isGroup(msg) {
  return (
    msg.chat?.type === "group" ||
    msg.chat?.type === "supergroup"
  );
}

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomNumber(min, max) {
  return Math.floor(
    Math.random() * (max - min + 1)
  ) + min;
}

function normalizeUsername(value) {
  return String(value || "")
    .trim()
    .replace(/^@/, "")
    .toLowerCase();
}

function commandName(text) {
  if (!text) return "";

  const first = text.trim().split(/\s+/)[0];

  return first
    .replace(/^\//, "")
    .split("@")[0]
    .toLowerCase();
}

function commandArgs(text) {
  if (!text) return [];

  return text.trim().split(/\s+/).slice(1);
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString("ar-EG");
  } catch (_) {
    return String(iso || "");
  }
}

/* ========================================================
   USER SYSTEM
======================================================== */

function ensureUser(from) {
  if (!from || !from.id) return null;

  const id = String(from.id);

  if (!db.users[id]) {
    let accountNumber = Number(
      db.settings.nextAccountNumber || 100000
    );

    const used = new Set(
      Object.values(db.users)
        .map(u => Number(u.accountNumber))
        .filter(Boolean)
    );

    while (used.has(accountNumber)) {
      accountNumber++;
    }

    db.settings.nextAccountNumber =
      accountNumber + 1;

    db.users[id] = {
      id: from.id,
      telegramId: from.id,
      firstName: from.first_name || "",
      lastName: from.last_name || "",
      name: userDisplayName(from),
      username: from.username || "",
      accountNumber,
      balance: Number(db.settings.startingBalance || 0),
      registeredAt: now(),
      lastSeen: now(),
      premium: false,
      premiumUntil: null,
      dailyLastClaim: null,
      points: 0,
      gamesPlayed: 0,
      gamesWon: 0,
      settings: {
        notifications: true
      }
    };

    saveDatabase();
  } else {
    const u = db.users[id];

    u.firstName = from.first_name || u.firstName || "";
    u.lastName = from.last_name || u.lastName || "";
    u.name = userDisplayName(from);
    u.username = from.username || u.username || "";
    u.lastSeen = now();

    if (!u.accountNumber) {
      let n = Number(
        db.settings.nextAccountNumber || 100000
      );

      const used = new Set(
        Object.values(db.users)
          .map(x => Number(x.accountNumber))
          .filter(Boolean)
      );

      while (used.has(n)) n++;

      u.accountNumber = n;
      db.settings.nextAccountNumber = n + 1;
    }

    if (typeof u.balance !== "number") {
      u.balance = Number(u.balance || 0);
    }

    if (typeof u.points !== "number") {
      u.points = Number(u.points || 0);
    }
  }

  return db.users[id];
}

/* ========================================================
   GROUP SYSTEM
======================================================== */

function ensureGroup(chat) {
  if (!chat || !chat.id) return null;

  const id = String(chat.id);

  if (!db.groups[id]) {
    db.groups[id] = {
      id: chat.id,
      title: chat.title || "جروب",
      type: chat.type || "group",
      username: chat.username || "",
      createdAt: now(),
      lastSeen: now(),
      settings: {
        games: true,
        bank: true,
        welcome: true,
        replies: true,
        adminsOnlyGames: false
      },
      admins: {},
      botAdmins: {},
      stats: {
        games: 0,
        messages: 0
      }
    };

    saveDatabase();
  } else {
    db.groups[id].title =
      chat.title || db.groups[id].title;

    db.groups[id].username =
      chat.username || db.groups[id].username || "";

    db.groups[id].lastSeen = now();

    db.groups[id].settings = {
      games: true,
      bank: true,
      welcome: true,
      replies: true,
      adminsOnlyGames: false,
      ...(db.groups[id].settings || {})
    };
  }

  return db.groups[id];
}

function getGroup(msg) {
  if (!isGroup(msg)) return null;

  return ensureGroup(msg.chat);
}

function isGroupAdmin(msg, userId) {
  if (!isGroup(msg)) return false;

  if (isOwner(msg.from)) return true;

  const group = ensureGroup(msg.chat);

  if (
    group?.admins &&
    group.admins[String(userId)]
  ) {
    return true;
  }

  return false;
}

async function telegramIsAdmin(chatId, userId) {
  try {
    const member = await bot.getChatMember(
      chatId,
      userId
    );

    return (
      member.status === "administrator" ||
      member.status === "creator"
    );
  } catch (_) {
    return false;
  }
}

async function requireGroupAdmin(msg) {
  if (!isGroup(msg)) {
    await safeSend(
      msg.chat.id,
      "❌ هذا الأمر للجروبات فقط."
    );

    return false;
  }

  if (isOwner(msg.from)) return true;

  const admin = await telegramIsAdmin(
    msg.chat.id,
    msg.from.id
  );

  if (!admin) {
    await safeSend(
      msg.chat.id,
      "❌ الأمر ده للمشرفين فقط."
    );

    return false;
  }

  return true;
}

/* ========================================================
   SEND HELPERS
======================================================== */

async function safeSend(chatId, text, options = {}) {
  try {
    return await bot.sendMessage(
      chatId,
      text,
      {
        disable_web_page_preview: true,
        ...options
      }
    );
  } catch (error) {
    console.error(
      "sendMessage:",
      error.message
    );

    return null;
  }
}

async function safeEdit(chatId, messageId, text, options = {}) {
  try {
    return await bot.editMessageText(
      text,
      {
        chat_id: chatId,
        message_id: messageId,
        disable_web_page_preview: true,
        ...options
      }
    );
  } catch (_) {
    return null;
  }
}

async function safeDelete(chatId, messageId) {
  try {
    return await bot.deleteMessage(
      chatId,
      messageId
    );
  } catch (_) {
    return false;
  }
}

/* ========================================================
   TRANSACTIONS
======================================================== */

function addTransaction(data) {
  db.transactions.push({
    id:
      `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`,
    date: now(),
    ...data
  });

  if (db.transactions.length > 5000) {
    db.transactions =
      db.transactions.slice(-5000);
  }

  saveDatabase();
}

function changeBalance(userId, amount) {
  const user = db.users[String(userId)];

  if (!user) return false;

  const next =
    Number(user.balance || 0) +
    Number(amount || 0);

  if (next < 0) return false;

  user.balance = next;

  saveDatabase();

  return true;
}

/* ========================================================
   PREMIUM
======================================================== */

function isPremium(userId) {
  const user = db.users[String(userId)];

  if (!user) return false;

  if (user.premiumUntil) {
    const expires =
      new Date(user.premiumUntil).getTime();

    if (expires < Date.now()) {
      user.premium = false;
      user.premiumUntil = null;
      saveDatabase();

      return false;
    }
  }

  return Boolean(user.premium);
}

function grantPremium(userId, days) {
  const user = db.users[String(userId)];

  if (!user) return false;

  const duration =
    Number(days || 30) *
    24 *
    60 *
    60 *
    1000;

  const current =
    user.premiumUntil &&
    new Date(user.premiumUntil).getTime() >
      Date.now()
      ? new Date(user.premiumUntil).getTime()
      : Date.now();

  user.premium = true;

  user.premiumUntil =
    new Date(current + duration).toISOString();

  db.premium[String(userId)] = {
    userId: Number(userId),
    until: user.premiumUntil,
    updatedAt: now()
  };

  saveDatabase();

  return true;
}

/* ========================================================
   DAILY
======================================================== */

function canClaimDaily(user) {
  return user.dailyLastClaim !== todayKey();
}

function claimDaily(user) {
  if (!canClaimDaily(user)) {
    return {
      success: false,
      amount: 0
    };
  }

  let amount =
    Number(db.settings.dailyAmount || 500);

  if (isPremium(user.id)) {
    amount += 250;
  }

  user.balance =
    Number(user.balance || 0) + amount;

  user.dailyLastClaim = todayKey();

  addTransaction({
    type: "daily",
    userId: user.id,
    amount,
    balanceAfter: user.balance
  });

  saveDatabase();

  return {
    success: true,
    amount
  };
}

/* ========================================================
   BANK
======================================================== */

function bankAllowed(msg) {
  if (!db.settings.bankEnabled) {
    return false;
  }

  if (!isGroup(msg)) {
    return true;
  }

  const group = ensureGroup(msg.chat);

  return group?.settings?.bank !== false;
}

function gamesAllowed(msg) {
  if (!db.settings.gamesEnabled) {
    return false;
  }

  if (!isGroup(msg)) {
    return true;
  }

  const group = ensureGroup(msg.chat);

  return group?.settings?.games !== false;
}

/* ========================================================
   MAIN MENU
======================================================== */

function mainKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "👤 حسابي",
            callback_data: "profile"
          },
          {
            text: "🏦 البنك",
            callback_data: "bank"
          }
        ],
        [
          {
            text: "🎁 اليومي",
            callback_data: "daily"
          },
          {
            text: "🏆 الأغنياء",
            callback_data: "rich"
          }
        ],
        [
          {
            text: "🎮 الألعاب",
            callback_data: "games"
          },
          {
            text: "📖 القرآن",
            callback_data: "quran"
          }
        ],
        [
          {
            text: "🕌 ختمتي",
            callback_data: "khatma"
          },
          {
            text: "ℹ️ المساعدة",
            callback_data: "help"
          }
        ]
      ]
    }
  };
}

/* ========================================================
   START
======================================================== */

bot.onText(/^\/start(?:\s+(.+))?$/i, async msg => {
  const user = ensureUser(msg.from);

  if (isGroup(msg)) {
    ensureGroup(msg.chat);

    await safeSend(
      msg.chat.id,
      `🤖 <b>${BOT_NAME}</b>\n\n` +
      `أهلاً بالجميع 👋\n` +
      `تم تسجيل الجروب بنجاح.\n\n` +
      `اكتب /help لمعرفة الأوامر.`,
      {
        parse_mode: "HTML"
      }
    );

    return;
  }

  const text =
    `👋 أهلاً بك في <b>${BOT_NAME}</b>\n\n` +
    `🤖 بوت شامل للبنك والألعاب والقرآن والختمة.\n\n` +
    `👤 حسابك: <b>${escapeText(user.name)}</b>\n` +
    `🏦 رقم حسابك: <code>${user.accountNumber}</code>\n` +
    `💰 رصيدك: <b>${money(user.balance)}</b>\n\n` +
    `اختار من القائمة:`;

  await safeSend(
    msg.chat.id,
    text,
    {
      parse_mode: "HTML",
      ...mainKeyboard()
    }
  );
});

/* ========================================================
   HELP
======================================================== */

bot.onText(/^\/help$/i, async msg => {
  ensureUser(msg.from);

  const text =
`🤖 <b>${BOT_NAME}</b>

📌 <b>الأوامر الأساسية</b>

/start - تشغيل البوت
/help - المساعدة
/profile - حسابي
/bank - البنك
/balance - الرصيد
/daily - المكافأة اليومية
/rich - أغنى المستخدمين
/transfer رقم_الحساب المبلغ
/history - سجل المعاملات

🎮 <b>الألعاب</b>

/games
/capital
/arabic
/math
/riddle
/guess
/number

📖 <b>القرآن</b>

/quran
/khatma
/mykhatma

👥 <b>الجروبات</b>

/group
/games_on
/games_off
/bank_on
/bank_off
/welcome_on
/welcome_off

👮 <b>الإدارة</b>

/mute
/unmute
/kick
/promote
/demote

💬 <b>الردود</b>

/addreply
/delreply
/replies
/addshortcut
/delshortcut

👑 <b>المالك</b>

/premium
/give
/take
/setdaily
/broadcast
/stats`;

  await safeSend(
    msg.chat.id,
    text,
    {
      parse_mode: "HTML"
    }
  );
});

/* ========================================================
   PROFILE
======================================================== */

async function sendProfile(chatId, from) {
  const user = ensureUser(from);

  const premiumText = isPremium(user.id)
    ? `👑 Premium حتى: ${formatDate(
        user.premiumUntil
      )}`
    : "👤 عادي";

  const text =
`👤 <b>حسابك</b>

📝 الاسم: <b>${escapeText(user.name)}</b>
🔹 Username: ${escapeText(
    user.username
      ? "@" + user.username
      : "غير موجود"
  )}

🆔 Telegram ID:
<code>${user.telegramId}</code>

🏦 رقم الحساب:
<code>${user.accountNumber}</code>

💰 الرصيد:
<b>${money(user.balance)}</b>

⭐ النقاط:
<b>${money(user.points)}</b>

🎮 الألعاب:
<b>${user.gamesPlayed}</b>

🏆 الانتصارات:
<b>${user.gamesWon}</b>

${premiumText}

📅 التسجيل:
${formatDate(user.registeredAt)}`;

  await safeSend(
    chatId,
    text,
    {
      parse_mode: "HTML"
    }
  );
}

bot.onText(/^\/profile$/i, async msg => {
  await sendProfile(
    msg.chat.id,
    msg.from
  );
});

/* ========================================================
   BALANCE
======================================================== */

bot.onText(/^\/balance$/i, async msg => {
  const user = ensureUser(msg.from);

  if (!bankAllowed(msg)) {
    await safeSend(
      msg.chat.id,
      "🔒 نظام البنك مقفول هنا."
    );

    return;
  }

  await safeSend(
    msg.chat.id,
    `🏦 حسابك البنكي\n\n` +
    `🔢 رقم الحساب: <code>${user.accountNumber}</code>\n` +
    `💰 الرصيد: <b>${money(user.balance)}</b>`,
    {
      parse_mode: "HTML"
    }
  );
});

/* ========================================================
   BANK
======================================================== */

bot.onText(/^\/bank$/i, async msg => {
  const user = ensureUser(msg.from);

  if (!bankAllowed(msg)) {
    await safeSend(
      msg.chat.id,
      "🔒 نظام البنك مقفول في هذا الجروب."
    );

    return;
  }

  await safeSend(
    msg.chat.id,
`🏦 <b>البنك</b>

🔢 رقم حسابك:
<code>${user.accountNumber}</code>

💰 الرصيد:
<b>${money(user.balance)}</b>

يمكنك استخدام:

/balance
/transfer رقم_الحساب المبلغ
/daily
/rich
/history`,
    {
      parse_mode: "HTML"
    }
  );
});

/* ========================================================
   TRANSFER
======================================================== */

bot.onText(
  /^\/transfer\s+(\d+)\s+(\d+(?:\.\d+)?)$/i,
  async (msg, match) => {
    const sender = ensureUser(msg.from);

    if (!bankAllowed(msg)) {
      await safeSend(
        msg.chat.id,
        "🔒 نظام البنك مقفول هنا."
      );

      return;
    }

    const targetAccount =
      String(match[1]);

    const amount =
      Number(match[2]);

    if (!Number.isFinite(amount) || amount <= 0) {
      await safeSend(
        msg.chat.id,
        "❌ قيمة التحويل غير صحيحة."
      );

      return;
    }

    if (amount > 1000000000) {
      await safeSend(
        msg.chat.id,
        "❌ المبلغ أكبر من الحد المسموح."
      );

      return;
    }

    const receiver =
      Object.values(db.users).find(
        u =>
          String(u.accountNumber) ===
          targetAccount
      );

    if (!receiver) {
      await safeSend(
        msg.chat.id,
        "❌ رقم الحساب غير موجود."
      );

      return;
    }

    if (
      String(receiver.id) ===
      String(sender.id)
    ) {
      await safeSend(
        msg.chat.id,
        "❌ لا يمكنك التحويل لنفسك."
      );

      return;
    }

    if (
      Number(sender.balance || 0) <
      amount
    ) {
      await safeSend(
        msg.chat.id,
        "❌ رصيدك غير كافي."
      );

      return;
    }

    sender.balance -= amount;
    receiver.balance += amount;

    addTransaction({
      type: "transfer",
      fromUserId: sender.id,
      toUserId: receiver.id,
      fromAccount: sender.accountNumber,
      toAccount: receiver.accountNumber,
      amount,
      senderBalanceAfter:
        sender.balance,
      receiverBalanceAfter:
        receiver.balance
    });

    saveDatabaseNow();

    await safeSend(
      msg.chat.id,
`✅ <b>تم التحويل بنجاح</b>

💸 المبلغ: <b>${money(amount)}</b>
🏦 إلى حساب: <code>${receiver.accountNumber}</code>
👤 المستلم: ${escapeText(
        receiver.name
      )}

💰 رصيدك الحالي:
<b>${money(sender.balance)}</b>`,
      {
        parse_mode: "HTML"
      }
    );

    try {
      await safeSend(
        receiver.id,
`💰 <b>استلام تحويل</b>

وصلك مبلغ:
<b>${money(amount)}</b>

من:
${escapeText(sender.name)}

🏦 رقم حساب المرسل:
<code>${sender.accountNumber}</code>

💰 رصيدك:
<b>${money(receiver.balance)}</b>`,
        {
          parse_mode: "HTML"
        }
      );
    } catch (_) {}
  }
);

/* ========================================================
   DAILY COMMAND
======================================================== */

bot.onText(/^\/daily$/i, async msg => {
  const user = ensureUser(msg.from);

  if (!bankAllowed(msg)) {
    await safeSend(
      msg.chat.id,
      "🔒 نظام البنك مقفول هنا."
    );

    return;
  }

  const result = claimDaily(user);

  if (!result.success) {
    await safeSend(
      msg.chat.id,
      `⏳ أنت أخذت المكافأة اليومية بالفعل اليوم.\n\n` +
      `ارجع بكرة وخد مكافأتك 🎁`
    );

    return;
  }

  await safeSend(
    msg.chat.id,
`🎁 <b>المكافأة اليومية</b>

💰 حصلت على:
<b>${money(result.amount)}</b>

💳 رصيدك الآن:
<b>${money(user.balance)}</b>

${isPremium(user.id)
  ? "👑 تمت إضافة مكافأة Premium."
  : ""}`,
    {
      parse_mode: "HTML"
    }
  );
});

/* ========================================================
   RICH LIST
======================================================== */

bot.onText(/^\/rich$/i, async msg => {
  ensureUser(msg.from);

  if (!bankAllowed(msg)) {
    await safeSend(
      msg.chat.id,
      "🔒 نظام البنك مقفول هنا."
    );

    return;
  }

  const users =
    Object.values(db.users)
      .sort(
        (a, b) =>
          Number(b.balance || 0) -
          Number(a.balance || 0)
      )
      .slice(0, 10);

  if (!users.length) {
    await safeSend(
      msg.chat.id,
      "لا يوجد مستخدمون."
    );

    return;
  }

  let text =
    "🏆 <b>أغنى 10 مستخدمين</b>\n\n";

  users.forEach((user, index) => {
    text +=
`${index + 1}. ${escapeText(
      user.name || "مستخدم"
    )} — <b>${money(
      user.balance
    )}</b>\n`;
  });

  await safeSend(
    msg.chat.id,
    text,
    {
      parse_mode: "HTML"
    }
  );
});

/* ========================================================
   HISTORY
======================================================== */

bot.onText(/^\/history$/i, async msg => {
  const user = ensureUser(msg.from);

  if (!bankAllowed(msg)) {
    await safeSend(
      msg.chat.id,
      "🔒 نظام البنك مقفول هنا."
    );

    return;
  }

  const id = String(user.id);

  const list =
    db.transactions
      .filter(t =>
        String(t.userId) === id ||
        String(t.fromUserId) === id ||
        String(t.toUserId) === id
      )
      .slice(-15)
      .reverse();

  if (!list.length) {
    await safeSend(
      msg.chat.id,
      "📭 لا توجد معاملات حتى الآن."
    );

    return;
  }

  let text =
    "📜 <b>آخر المعاملات</b>\n\n";

  for (const t of list) {
    if (t.type === "transfer") {
      if (
        String(t.fromUserId) === id
      ) {
        text +=
`🔴 إرسال ${money(t.amount)}
إلى حساب ${t.toAccount}
${formatDate(t.date)}

`;
      } else {
        text +=
`🟢 استلام ${money(t.amount)}
من حساب ${t.fromAccount}
${formatDate(t.date)}

`;
      }
    }

    if (t.type === "daily") {
      text +=
`🎁 يومي +${money(t.amount)}
${formatDate(t.date)}

`;
    }
  }

  await safeSend(
    msg.chat.id,
    text,
    {
      parse_mode: "HTML"
    }
  );
});

/* ========================================================
   GROUP COMMAND
======================================================== */

bot.onText(/^\/group$/i, async msg => {
  if (!isGroup(msg)) {
    await safeSend(
      msg.chat.id,
      "❌ استخدم الأمر داخل جروب."
    );

    return;
  }

  const group = ensureGroup(msg.chat);

  await safeSend(
    msg.chat.id,
`👥 <b>بيانات الجروب</b>

🏷️ الاسم:
${escapeText(group.title)}

🆔 ID:
<code>${group.id}</code>

🎮 الألعاب:
${group.settings.games ? "🟢 مفتوحة" : "🔴 مقفولة"}

🏦 البنك:
${group.settings.bank ? "🟢 مفتوح" : "🔴 مقفول"}

👋 الترحيب:
${group.settings.welcome ? "🟢 مفتوح" : "🔴 مقفول"}

💬 الردود:
${group.settings.replies ? "🟢 مفتوحة" : "🔴 مقفولة"}`,
    {
      parse_mode: "HTML"
    }
  );
});

/* ========================================================
   GROUP SETTINGS
======================================================== */

async function toggleGroupSetting(
  msg,
  key,
  value,
  label
) {
  if (!(await requireGroupAdmin(msg))) {
    return;
  }

  const group = ensureGroup(msg.chat);

  group.settings[key] = value;

  saveDatabase();

  await safeSend(
    msg.chat.id,
    `${value ? "🟢" : "🔴"} تم ${
      value ? "فتح" : "قفل"
    } ${label}.`
  );
}

bot.onText(/^\/games_on$/i, msg =>
  toggleGroupSetting(
    msg,
    "games",
    true,
    "الألعاب"
  )
);

bot.onText(/^\/games_off$/i, msg =>
  toggleGroupSetting(
    msg,
    "games",
    false,
    "الألعاب"
  )
);

bot.onText(/^\/bank_on$/i, msg =>
  toggleGroupSetting(
    msg,
    "bank",
    true,
    "البنك"
  )
);

bot.onText(/^\/bank_off$/i, msg =>
  toggleGroupSetting(
    msg,
    "bank",
    false,
    "البنك"
  )
);

bot.onText(/^\/welcome_on$/i, msg =>
  toggleGroupSetting(
    msg,
    "welcome",
    true,
    "الترحيب"
  )
);

bot.onText(/^\/welcome_off$/i, msg =>
  toggleGroupSetting(
    msg,
    "welcome",
    false,
    "الترحيب"
  )
);

/* ========================================================
   GAME ENGINE
======================================================== */

const capitalQuestions = [
  ["ما عاصمة مصر؟", "القاهرة"],
  ["ما عاصمة السعودية؟", "الرياض"],
  ["ما عاصمة الإمارات؟", "أبوظبي"],
  ["ما عاصمة الأردن؟", "عمان"],
  ["ما عاصمة العراق؟", "بغداد"],
  ["ما عاصمة سوريا؟", "دمشق"],
  ["ما عاصمة لبنان؟", "بيروت"],
  ["ما عاصمة المغرب؟", "الرباط"],
  ["ما عاصمة الجزائر؟", "الجزائر"],
  ["ما عاصمة تونس؟", "تونس"],
  ["ما عاصمة ليبيا؟", "طرابلس"],
  ["ما عاصمة السودان؟", "الخرطوم"],
  ["ما عاصمة فرنسا؟", "باريس"],
  ["ما عاصمة إيطاليا؟", "روما"],
  ["ما عاصمة ألمانيا؟", "برلين"],
  ["ما عاصمة إسبانيا؟", "مدريد"],
  ["ما عاصمة اليابان؟", "طوكيو"],
  ["ما عاصمة الصين؟", "بكين"],
  ["ما عاصمة روسيا؟", "موسكو"],
  ["ما عاصمة بريطانيا؟", "لندن"]
];

const arabicQuestions = [
  ["ما جمع كلمة كتاب؟", "كتب"],
  ["ما مفرد كلمة مدارس؟", "مدرسة"],
  ["ما ضد كلمة طويل؟", "قصير"],
  ["ما ضد كلمة سريع؟", "بطيء"],
  ["ما نوع كلمة محمد؟", "اسم"],
  ["ما أول حرف في الأبجدية العربية؟", "الألف"],
  ["كم عدد حروف اللغة العربية؟", "28"],
  ["ما مفرد كلمة أقلام؟", "قلم"],
  ["ما جمع كلمة بيت؟", "بيوت"],
  ["ما ضد كلمة ليل؟", "نهار"]
];

const riddleQuestions = [
  ["شيء له أسنان ولا يعض، ما هو؟", "المشط"],
  ["شيء يمشي بلا رجلين ويبكي بلا عينين، ما هو؟", "السحاب"],
  ["شيء كلما أخذت منه كبر، ما هو؟", "الحفرة"],
  ["ما الشيء الذي يكتب ولا يقرأ؟", "القلم"],
  ["ما الشيء الذي له عين ولا يرى؟", "الإبرة"],
  ["ما الشيء الذي إذا زاد نقص؟", "العمر"],
  ["ما الشيء الذي لا يمشي إلا بالضرب؟", "المسمار"]
];

const guessQuestions = [
  ["شيء نستخدمه للكتابة", "قلم"],
  ["شيء نلبسه في القدم", "حذاء"],
  ["شيء نشرب فيه الماء", "كوب"],
  ["شيء ننام عليه", "سرير"],
  ["شيء يضيء الغرفة", "مصباح"],
  ["شيء نستخدمه لمعرفة الوقت", "ساعة"],
  ["شيء نستخدمه للاتصال", "هاتف"]
];

function createMathQuestion() {
  const a = randomNumber(1, 50);
  const b = randomNumber(1, 50);

  const operators = ["+", "-", "*"];

  const op =
    randomItem(operators);

  let answer;

  if (op === "+") {
    answer = a + b;
  }

  if (op === "-") {
    answer = a - b;
  }

  if (op === "*") {
    answer = a * b;
  }

  return {
    question: `احسب: ${a} ${op} ${b}`,
    answer: String(answer)
  };
}

function createNumberQuestion() {
  const answer =
    randomNumber(1, 100);

  return {
    question:
      "🎯 خمن الرقم بين 1 و100",
    answer: String(answer)
  };
}

function normalizeAnswer(answer) {
  return String(answer || "")
    .trim()
    .toLowerCase()
    .replace(/[إأآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/[ًٌٍَُِّْـ]/g, "");
}

function gameKey(chatId) {
  return String(chatId);
}

function getGame(chatId) {
  return db.games[gameKey(chatId)];
}

function stopGame(chatId) {
  delete db.games[gameKey(chatId)];

  saveDatabase();
}

function startGame(
  msg,
  type,
  question,
  answer,
  extra = {}
) {
  if (!isGroup(msg)) {
    safeSend(
      msg.chat.id,
      "❌ الألعاب تعمل داخل الجروبات فقط."
    );

    return;
  }

  if (!gamesAllowed(msg)) {
    safeSend(
      msg.chat.id,
      "🔒 الألعاب مقفولة في هذا الجروب."
    );

    return;
  }

  const key =
    gameKey(msg.chat.id);

  if (db.games[key]) {
    safeSend(
      msg.chat.id,
      "⚠️ يوجد تحدي شغال بالفعل."
    );

    return;
  }

  db.games[key] = {
    chatId: msg.chat.id,
    type,
    question,
    answer,
    startedBy: msg.from.id,
    startedAt: now(),
    attempts: 0,
    ...extra
  };

  const group =
    ensureGroup(msg.chat);

  group.stats.games++;

  saveDatabase();

  safeSend(
    msg.chat.id,
    `🎮 <b>بدأت اللعبة!</b>\n\n${question}\n\n` +
    `أول شخص يجاوب صح يكسب ⭐`,
    {
      parse_mode: "HTML"
    }
  );
}

/* ========================================================
   GAMES COMMANDS
======================================================== */

bot.onText(/^\/games$/i, async msg => {
  ensureUser(msg.from);

  await safeSend(
    msg.chat.id,
`🎮 <b>ألعاب Gojo Esultan</b>

🏙️ /capital
🇪🇬 /arabic
➗ /math
❓ /riddle
🎯 /guess
🔢 /number

كل إجابة صحيحة = نقطة ⭐`,
    {
      parse_mode: "HTML"
    }
  );
});

bot.onText(/^\/capital$/i, msg => {
  const q =
    randomItem(capitalQuestions);

  startGame(
    msg,
    "capital",
    q[0],
    normalizeAnswer(q[1])
  );
});

bot.onText(/^\/arabic$/i, msg => {
  const q =
    randomItem(arabicQuestions);

  startGame(
    msg,
    "arabic",
    q[0],
    normalizeAnswer(q[1])
  );
});

bot.onText(/^\/math$/i, msg => {
  const q =
    createMathQuestion();

  startGame(
    msg,
    "math",
    q.question,
    normalizeAnswer(q.answer)
  );
});

bot.onText(/^\/riddle$/i, msg => {
  const q =
    randomItem(riddleQuestions);

  startGame(
    msg,
    "riddle",
    q[0],
    normalizeAnswer(q[1])
  );
});

bot.onText(/^\/guess$/i, msg => {
  const q =
    randomItem(guessQuestions);

  startGame(
    msg,
    "guess",
    q[0],
    normalizeAnswer(q[1])
  );
});

bot.onText(/^\/number$/i, msg => {
  const q =
    createNumberQuestion();

  startGame(
    msg,
    "number",
    q.question,
    q.answer,
    {
      numberAnswer: Number(q.answer)
    }
  );
});

/* ========================================================
   GAME ANSWER HANDLER
======================================================== */

async function handleGameAnswer(msg) {
  if (!isGroup(msg)) return false;

  const game =
    getGame(msg.chat.id);

  if (!game) return false;

  const text =
    String(msg.text || "").trim();

  if (!text) return false;

  if (
    text.startsWith("/") ||
    text.startsWith(".")
  ) {
    return false;
  }

  const user =
    ensureUser(msg.from);

  let correct = false;

  if (game.type === "number") {
    const value =
      Number(text);

    if (Number.isFinite(value)) {
      if (value === game.numberAnswer) {
        correct = true;
      } else {
        game.attempts++;

        if (
          value <
          game.numberAnswer
        ) {
          await safeSend(
            msg.chat.id,
            `⬆️ أعلى من ${value}`
          );
        } else {
          await safeSend(
            msg.chat.id,
            `⬇️ أقل من ${value}`
          );
        }

        saveDatabase();

        return true;
      }
    }
  } else {
    correct =
      normalizeAnswer(text) ===
      normalizeAnswer(game.answer);
  }

  if (!correct) return false;

  user.points =
    Number(user.points || 0) + 1;

  user.gamesPlayed =
    Number(user.gamesPlayed || 0) + 1;

  user.gamesWon =
    Number(user.gamesWon || 0) + 1;

  user.balance =
    Number(user.balance || 0) + 50;

  addTransaction({
    type: "game",
    userId: user.id,
    game: game.type,
    amount: 50,
    balanceAfter: user.balance
  });

  const winnerName =
    user.username
      ? `@${user.username}`
      : user.name;

  stopGame(msg.chat.id);

  await safeSend(
    msg.chat.id,
`🏆 <b>إجابة صحيحة!</b>

👤 الفائز:
<b>${escapeText(winnerName)}</b>

⭐ +1 نقطة
💰 +50 رصيد

الإجابة:
<b>${escapeText(game.answer)}</b>`,
    {
      parse_mode: "HTML"
    }
  );

  return true;
}

/* ========================================================
   QURAN
======================================================== */

const surahs = [
  [1, "الفاتحة", 7],
  [2, "البقرة", 286],
  [3, "آل عمران", 200],
  [4, "النساء", 176],
  [5, "المائدة", 120],
  [6, "الأنعام", 165],
  [7, "الأعراف", 206],
  [8, "الأنفال", 75],
  [9, "التوبة", 129],
  [10, "يونس", 109],
  [11, "هود", 123],
  [12, "يوسف", 111],
  [13, "الرعد", 43],
  [14, "إبراهيم", 52],
  [15, "الحجر", 99],
  [16, "النحل", 128],
  [17, "الإسراء", 111],
  [18, "الكهف", 110],
  [19, "مريم", 98],
  [20, "طه", 135],
  [21, "الأنبياء", 112],
  [22, "الحج", 78],
  [23, "المؤمنون", 118],
  [24, "النور", 64],
  [25, "الفرقان", 77],
  [26, "الشعراء", 227],
  [27, "النمل", 93],
  [28, "القصص", 88],
  [29, "العنكبوت", 69],
  [30, "الروم", 60],
  [31, "لقمان", 34],
  [32, "السجدة", 30],
  [33, "الأحزاب", 73],
  [34, "سبأ", 54],
  [35, "فاطر", 45],
  [36, "يس", 83],
  [37, "الصافات", 182],
  [38, "ص", 88],
  [39, "الزمر", 75],
  [40, "غافر", 85],
  [41, "فصلت", 54],
  [42, "الشورى", 53],
  [43, "الزخرف", 89],
  [44, "الدخان", 59],
  [45, "الجاثية", 37],
  [46, "الأحقاف", 35],
  [47, "محمد", 38],
  [48, "الفتح", 29],
  [49, "الحجرات", 18],
  [50, "ق", 45],
  [51, "الذاريات", 60],
  [52, "الطور", 49],
  [53, "النجم", 62],
  [54, "القمر", 55],
  [55, "الرحمن", 78],
  [56, "الواقعة", 96],
  [57, "الحديد", 29],
  [58, "المجادلة", 22],
  [59, "الحشر", 24],
  [60, "الممتحنة", 13],
  [61, "الصف", 14],
  [62, "الجمعة", 11],
  [63, "المنافقون", 11],
  [64, "التغابن", 18],
  [65, "الطلاق", 12],
  [66, "التحريم", 12],
  [67, "الملك", 30],
  [68, "القلم", 52],
  [69, "الحاقة", 52],
  [70, "المعارج", 44],
  [71, "نوح", 28],
  [72, "الجن", 28],
  [73, "المزمل", 20],
  [74, "المدثر", 56],
  [75, "القيامة", 40],
  [76, "الإنسان", 31],
  [77, "المرسلات", 50],
  [78, "النبأ", 40],
  [79, "النازعات", 46],
  [80, "عبس", 42],
  [81, "التكوير", 29],
  [82, "الانفطار", 19],
  [83, "المطففين", 36],
  [84, "الانشقاق", 25],
  [85, "البروج", 22],
  [86, "الطارق", 17],
  [87, "الأعلى", 19],
  [88, "الغاشية", 26],
  [89, "الفجر", 30],
  [90, "البلد", 20],
  [91, "الشمس", 15],
  [92, "الليل", 21],
  [93, "الضحى", 11],
  [94, "الشرح", 8],
  [95, "التين", 8],
  [96, "العلق", 19],
  [97, "القدر", 5],
  [98, "البينة", 8],
  [99, "الزلزلة", 8],
  [100, "العاديات", 11],
  [101, "القارعة", 11],
  [102, "التكاثر", 8],
  [103, "العصر", 3],
  [104, "الهمزة", 9],
  [105, "الفيل", 5],
  [106, "قريش", 4],
  [107, "الماعون", 7],
  [108, "الكوثر", 3],
  [109, "الكافرون", 6],
  [110, "النصر", 3],
  [111, "المسد", 5],
  [112, "الإخلاص", 4],
  [113, "الفلق", 5],
  [114, "الناس", 6]
];

function quranKeyboard(page = 0) {
  const perPage = 15;

  const start =
    page * perPage;

  const items =
    surahs.slice(
      start,
      start + perPage
    );

  const rows = [];

  for (let i = 0; i < items.length; i += 3) {
    rows.push(
      items
        .slice(i, i + 3)
        .map(s => ({
          text: `${s[0]} - ${s[1]}`,
          callback_data: `surah_${s[0]}`
        }))
    );
  }

  const navigation = [];

  if (page > 0) {
    navigation.push({
      text: "⬅️ السابق",
      callback_data: `qpage_${page - 1}`
    });
  }

  if (
    (page + 1) *
      perPage <
    surahs.length
  ) {
    navigation.push({
      text: "التالي ➡️",
      callback_data: `qpage_${page + 1}`
    });
  }

  if (navigation.length) {
    rows.push(navigation);
  }

  return {
    reply_markup: {
      inline_keyboard: rows
    }
  };
}

bot.onText(/^\/quran$/i, async msg => {
  ensureUser(msg.from);

  await safeSend(
    msg.chat.id,
`📖 <b>القرآن الكريم</b>

اختر السورة التي تريدها:

🎧 التلاوة الصوتية متاحة من Islamic Network.`,
    {
      parse_mode: "HTML",
      ...quranKeyboard(0)
    }
  );
});

/* ========================================================
   KHATMA
======================================================== */

function getKhatma(userId) {
  const id = String(userId);

  if (!db.khatma[id]) {
    db.khatma[id] = {
      userId,
      startedAt: null,
      completed: [],
      active: false,
      createdAt: now(),
      updatedAt: now()
    };
  }

  return db.khatma[id];
}

function khatmaProgress(khatma) {
  return Math.round(
    (
      khatma.completed.length /
      surahs.length
    ) * 100
  );
}

function khatmaKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "▶️ بدء الختمة",
            callback_data: "k_start"
          }
        ],
        [
          {
            text: "📊 تقدمي",
            callback_data: "k_progress"
          },
          {
            text: "🔄 إعادة",
            callback_data: "k_reset"
          }
        ]
      ]
    }
  };
}

bot.onText(/^\/khatma$/i, async msg => {
  const user =
    ensureUser(msg.from);

  const khatma =
    getKhatma(user.id);

  const progress =
    khatmaProgress(khatma);

  await safeSend(
    msg.chat.id,
`🕌 <b>ختمة القرآن</b>

الحالة:
${khatma.active ? "🟢 نشطة" : "⚪ غير نشطة"}

📖 السور المنجزة:
<b>${khatma.completed.length}/114</b>

📊 النسبة:
<b>${progress}%</b>

${khatma.completed.length === 114
  ? "🎉 أتممت الختمة كاملة!"
  : "ابدأ أو تابع ختمتك من الأزرار."}`,
    {
      parse_mode: "HTML",
      ...khatmaKeyboard()
    }
  );
});

bot.onText(/^\/mykhatma$/i, async msg => {
  const user =
    ensureUser(msg.from);

  const khatma =
    getKhatma(user.id);

  const progress =
    khatmaProgress(khatma);

  const next =
    surahs.find(
      s =>
        !khatma.completed.includes(
          s[0]
        )
    );

  await safeSend(
    msg.chat.id,
`🕌 <b>تقدم ختمتك</b>

📖 المنجز:
${khatma.completed.length}/114

📊 التقدم:
${progress}%

${next
  ? `➡️ السورة التالية: <b>${next[1]}</b>`
  : "🎉 الختمة مكتملة."}`,
    {
      parse_mode: "HTML"
    }
  );
});

/* ========================================================
   REPLIES
======================================================== */

function groupReplyKey(chatId) {
  return String(chatId);
}

function ensureReplies(chatId) {
  const key =
    groupReplyKey(chatId);

  if (!db.replies[key]) {
    db.replies[key] = {};
  }

  return db.replies[key];
}

bot.onText(
  /^\/addreply\s+(\S+)\s+([\s\S]+)$/i,
  async (msg, match) => {
    if (!(await requireGroupAdmin(msg))) {
      return;
    }

    const trigger =
      String(match[1])
        .toLowerCase();

    const response =
      String(match[2]);

    const replies =
      ensureReplies(msg.chat.id);

    replies[trigger] = {
      text: response,
      createdBy: msg.from.id,
      createdAt: now()
    };

    saveDatabase();

    await safeSend(
      msg.chat.id,
      `✅ تم إضافة الرد:\n\n` +
      `🔑 ${trigger}\n` +
      `💬 ${response}`
    );
  }
);

bot.onText(
  /^\/delreply\s+(\S+)$/i,
  async (msg, match) => {
    if (!(await requireGroupAdmin(msg))) {
      return;
    }

    const trigger =
      String(match[1])
        .toLowerCase();

    const replies =
      ensureReplies(msg.chat.id);

    if (!replies[trigger]) {
      await safeSend(
        msg.chat.id,
        "❌ الرد غير موجود."
      );

      return;
    }

    delete replies[trigger];

    saveDatabase();

    await safeSend(
      msg.chat.id,
      "✅ تم حذف الرد."
    );
  }
);

bot.onText(/^\/replies$/i, async msg => {
  if (!isGroup(msg)) {
    await safeSend(
      msg.chat.id,
      "❌ داخل الجروب فقط."
    );

    return;
  }

  const replies =
    ensureReplies(msg.chat.id);

  const keys =
    Object.keys(replies);

  if (!keys.length) {
    await safeSend(
      msg.chat.id,
      "📭 لا توجد ردود."
    );

    return;
  }

  let text =
    "💬 <b>الردود الموجودة</b>\n\n";

  keys.forEach((key, i) => {
    text +=
      `${i + 1}. ${escapeText(key)}\n`;
  });

  await safeSend(
    msg.chat.id,
    text,
    {
      parse_mode: "HTML"
    }
  );
});

/* ========================================================
   SHORTCUTS
======================================================== */

function ensureShortcuts(chatId) {
  const key =
    String(chatId);

  if (!db.shortcuts[key]) {
    db.shortcuts[key] = {};
  }

  return db.shortcuts[key];
}

bot.onText(
  /^\/addshortcut\s+(\S+)\s+([\s\S]+)$/i,
  async (msg, match) => {
    if (!(await requireGroupAdmin(msg))) {
      return;
    }

    const key =
      String(match[1])
        .toLowerCase();

    const value =
      String(match[2]);

    const shortcuts =
      ensureShortcuts(msg.chat.id);

    shortcuts[key] = {
      text: value,
      createdBy: msg.from.id,
      createdAt: now()
    };

    saveDatabase();

    await safeSend(
      msg.chat.id,
      `✅ تم إضافة الاختصار ${key}`
    );
  }
);

bot.onText(
  /^\/delshortcut\s+(\S+)$/i,
  async (msg, match) => {
    if (!(await requireGroupAdmin(msg))) {
      return;
    }

    const key =
      String(match[1])
        .toLowerCase();

    const shortcuts =
      ensureShortcuts(msg.chat.id);

    if (!shortcuts[key]) {
      await safeSend(
        msg.chat.id,
        "❌ الاختصار غير موجود."
      );

      return;
    }

    delete shortcuts[key];

    saveDatabase();

    await safeSend(
      msg.chat.id,
      "✅ تم حذف الاختصار."
    );
  }
);

/* ========================================================
   ADMIN
======================================================== */

bot.onText(
  /^\/premium\s+(\d+)\s+(\d+)$/i,
  async (msg, match) => {
    if (!isOwner(msg.from)) {
      await safeSend(
        msg.chat.id,
        "❌ هذا الأمر للمالك فقط."
      );

      return;
    }

    const userId =
      String(match[1]);

    const days =
      Number(match[2]);

    const user =
      db.users[userId];

    if (!user) {
      await safeSend(
        msg.chat.id,
        "❌ المستخدم غير موجود."
      );

      return;
    }

    grantPremium(
      userId,
      days
    );

    await safeSend(
      msg.chat.id,
`👑 تم تفعيل Premium.

👤 ${escapeText(user.name)}
⏳ ${days} يوم

ينتهي:
${formatDate(user.premiumUntil)}`
    );

    await safeSend(
      user.id,
`👑 <b>تم تفعيل Premium لك</b>

⏳ المدة:
${days} يوم

📅 حتى:
${formatDate(user.premiumUntil)}`,
      {
        parse_mode: "HTML"
      }
    );
  }
);

bot.onText(
  /^\/give\s+(\d+)\s+(\d+(?:\.\d+)?)$/i,
  async (msg, match) => {
    if (!isOwner(msg.from)) {
      await safeSend(
        msg.chat.id,
        "❌ للمالك فقط."
      );

      return;
    }

    const user =
      db.users[String(match[1])];

    const amount =
      Number(match[2]);

    if (!user) {
      await safeSend(
        msg.chat.id,
        "❌ المستخدم غير موجود."
      );

      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      await safeSend(
        msg.chat.id,
        "❌ المبلغ غير صحيح."
      );

      return;
    }

    user.balance += amount;

    addTransaction({
      type: "admin_give",
      userId: user.id,
      amount,
      balanceAfter: user.balance,
      adminId: msg.from.id
    });

    saveDatabaseNow();

    await safeSend(
      msg.chat.id,
      `✅ تمت إضافة ${money(amount)} للمستخدم.`
    );
  }
);

bot.onText(
  /^\/take\s+(\d+)\s+(\d+(?:\.\d+)?)$/i,
  async (msg, match) => {
    if (!isOwner(msg.from)) {
      await safeSend(
        msg.chat.id,
        "❌ للمالك فقط."
      );

      return;
    }

    const user =
      db.users[String(match[1])];

    const amount =
      Number(match[2]);

    if (!user) {
      await safeSend(
        msg.chat.id,
        "❌ المستخدم غير موجود."
      );

      return;
    }

    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      user.balance < amount
    ) {
      await safeSend(
        msg.chat.id,
        "❌ لا يمكن خصم هذا المبلغ."
      );

      return;
    }

    user.balance -= amount;

    addTransaction({
      type: "admin_take",
      userId: user.id,
      amount: -amount,
      balanceAfter: user.balance,
      adminId: msg.from.id
    });

    saveDatabaseNow();

    await safeSend(
      msg.chat.id,
      `✅ تم خصم ${money(amount)}.`
    );
  }
);

bot.onText(
  /^\/setdaily\s+(\d+(?:\.\d+)?)$/i,
  async (msg, match) => {
    if (!isOwner(msg.from)) {
      await safeSend(
        msg.chat.id,
        "❌ للمالك فقط."
      );

      return;
    }

    const amount =
      Number(match[1]);

    if (!Number.isFinite(amount) || amount < 0) {
      await safeSend(
        msg.chat.id,
        "❌ القيمة غير صحيحة."
      );

      return;
    }

    db.settings.dailyAmount =
      amount;

    saveDatabase();

    await safeSend(
      msg.chat.id,
      `✅ تم تغيير اليومي إلى ${money(amount)}`
    );
  }
);

/* ========================================================
   STATS
======================================================== */

bot.onText(/^\/stats$/i, async msg => {
  if (!isOwner(msg.from)) {
    await safeSend(
      msg.chat.id,
      "❌ للمالك فقط."
    );

    return;
  }

  const users =
    Object.keys(db.users).length;

  const groups =
    Object.keys(db.groups).length;

  const transactions =
    db.transactions.length;

  const games =
    Object.keys(db.games).length;

  await safeSend(
    msg.chat.id,
`📊 <b>إحصائيات البوت</b>

👤 المستخدمون:
<b>${users}</b>

👥 الجروبات:
<b>${groups}</b>

💸 المعاملات:
<b>${transactions}</b>

🎮 الألعاب الحالية:
<b>${games}</b>

👑 المالك:
@${OWNER_USERNAME}`,
    {
      parse_mode: "HTML"
    }
  );
});

/* ========================================================
   BROADCAST
======================================================== */

bot.onText(
  /^\/broadcast\s+([\s\S]+)$/i,
  async (msg, match) => {
    if (!isOwner(msg.from)) {
      await safeSend(
        msg.chat.id,
        "❌ للمالك فقط."
      );

      return;
    }

    const text =
      String(match[1]);

    let success = 0;
    let failed = 0;

    for (const user of Object.values(db.users)) {
      try {
        await bot.sendMessage(
          user.id,
          `📢 <b>رسالة من ${BOT_NAME}</b>\n\n${escapeText(text)}`,
          {
            parse_mode: "HTML"
          }
        );

        success++;
      } catch (_) {
        failed++;
      }

      await new Promise(
        resolve =>
          setTimeout(resolve, 60)
      );
    }

    await safeSend(
      msg.chat.id,
`📢 انتهى الإرسال.

✅ نجح: ${success}
❌ فشل: ${failed}`
    );
  }
);

/* ========================================================
   GROUP ADMIN ACTIONS
======================================================== */

async function targetFromReply(msg) {
  if (!msg.reply_to_message?.from) {
    return null;
  }

  return msg.reply_to_message.from;
}

bot.onText(/^\/mute$/i, async msg => {
  if (!(await requireGroupAdmin(msg))) {
    return;
  }

  const target =
    await targetFromReply(msg);

  if (!target) {
    await safeSend(
      msg.chat.id,
      "❌ اعمل Reply على العضو ثم اكتب /mute"
    );

    return;
  }

  if (target.id === msg.from.id) {
    await safeSend(
      msg.chat.id,
      "❌ لا يمكنك كتم نفسك."
    );

    return;
  }

  try {
    await bot.restrictChatMember(
      msg.chat.id,
      target.id,
      {
        permissions: {
          can_send_messages: false,
          can_send_audios: false,
          can_send_documents: false,
          can_send_photos: false,
          can_send_videos: false,
          can_send_video_notes: false,
          can_send_voice_notes: false,
          can_send_polls: false,
          can_send_other_messages: false,
          can_add_web_page_previews: false,
          can_change_info: false,
          can_invite_users: false,
          can_pin_messages: false
        }
      }
    );

    await safeSend(
      msg.chat.id,
      `🔇 تم كتم ${escapeText(
        userDisplayName(target)
      )}.`,
      {
        parse_mode: "HTML"
      }
    );
  } catch (error) {
    await safeSend(
      msg.chat.id,
      "❌ لم أستطع كتم العضو. تأكد أن البوت مشرف."
    );
  }
});

bot.onText(/^\/unmute$/i, async msg => {
  if (!(await requireGroupAdmin(msg))) {
    return;
  }

  const target =
    await targetFromReply(msg);

  if (!target) {
    await safeSend(
      msg.chat.id,
      "❌ اعمل Reply على العضو ثم اكتب /unmute"
    );

    return;
  }

  try {
    await bot.restrictChatMember(
      msg.chat.id,
      target.id,
      {
        permissions: {
          can_send_messages: true,
          can_send_audios: true,
          can_send_documents: true,
          can_send_photos: true,
          can_send_videos: true,
          can_send_video_notes: true,
          can_send_voice_notes: true,
          can_send_polls: true,
          can_send_other_messages: true,
          can_add_web_page_previews: true
        }
      }
    );

    await safeSend(
      msg.chat.id,
      `🔊 تم فك كتم ${escapeText(
        userDisplayName(target)
      )}.`,
      {
        parse_mode: "HTML"
      }
    );
  } catch (_) {
    await safeSend(
      msg.chat.id,
      "❌ تعذر فك الكتم."
    );
  }
});

bot.onText(/^\/kick$/i, async msg => {
  if (!(await requireGroupAdmin(msg))) {
    return;
  }

  const target =
    await targetFromReply(msg);

  if (!target) {
    await safeSend(
      msg.chat.id,
      "❌ اعمل Reply على العضو ثم اكتب /kick"
    );

    return;
  }

  try {
    await bot.banChatMember(
      msg.chat.id,
      target.id
    );

    await bot.unbanChatMember(
      msg.chat.id,
      target.id,
      {
        only_if_banned: true
      }
    );

    await safeSend(
      msg.chat.id,
      `🚪 تم طرد ${escapeText(
        userDisplayName(target)
      )}.`,
      {
        parse_mode: "HTML"
      }
    );
  } catch (_) {
    await safeSend(
      msg.chat.id,
      "❌ تعذر طرد العضو."
    );
  }
});

bot.onText(/^\/promote$/i, async msg => {
  if (!(await requireGroupAdmin(msg))) {
    return;
  }

  const target =
    await targetFromReply(msg);

  if (!target) {
    await safeSend(
      msg.chat.id,
      "❌ اعمل Reply على العضو."
    );

    return;
  }

  if (isOwner(target)) {
    await safeSend(
      msg.chat.id,
      "👑 المالك بالفعل له أعلى صلاحية."
    );

    return;
  }

  const group =
    ensureGroup(msg.chat);

  group.admins[String(target.id)] = {
    userId: target.id,
    username: target.username || "",
    name: userDisplayName(target),
    addedBy: msg.from.id,
    addedAt: now()
  };

  saveDatabase();

  await safeSend(
    msg.chat.id,
    `🛡️ تم ترقيته لمشرف داخل نظام البوت.`
  );
});

bot.onText(/^\/demote$/i, async msg => {
  if (!(await requireGroupAdmin(msg))) {
    return;
  }

  const target =
    await targetFromReply(msg);

  if (!target) {
    await safeSend(
      msg.chat.id,
      "❌ اعمل Reply على العضو."
    );

    return;
  }

  const group =
    ensureGroup(msg.chat);

  delete group.admins[
    String(target.id)
  ];

  saveDatabase();

  await safeSend(
    msg.chat.id,
    "✅ تم إلغاء صلاحياته داخل نظام البوت."
  );
});

/* ========================================================
   CALLBACK QUERIES
======================================================== */

bot.on("callback_query", async query => {
  try {
    const msg = query.message;

    if (!msg) return;

    const user =
      ensureUser(query.from);

    const data =
      String(query.data || "");

    await bot.answerCallbackQuery(
      query.id
    ).catch(() => {});

    if (data === "profile") {
      await sendProfile(
        msg.chat.id,
        query.from
      );

      return;
    }

    if (data === "bank") {
      await safeSend(
        msg.chat.id,
`🏦 <b>البنك</b>

🔢 رقم حسابك:
<code>${user.accountNumber}</code>

💰 الرصيد:
<b>${money(user.balance)}</b>

/balance
/transfer رقم_الحساب المبلغ
/daily
/history`,
        {
          parse_mode: "HTML"
        }
      );

      return;
    }

    if (data === "daily") {
      const result =
        claimDaily(user);

      if (!result.success) {
        await safeSend(
          msg.chat.id,
          "⏳ أخذت اليومي بالفعل اليوم."
        );
      } else {
        await safeSend(
          msg.chat.id,
`🎁 حصلت على <b>${money(
            result.amount
          )}</b>

💰 رصيدك:
<b>${money(
            user.balance
          )}</b>`,
          {
            parse_mode: "HTML"
          }
        );
      }

      return;
    }

    if (data === "rich") {
      const users =
        Object.values(db.users)
          .sort(
            (a, b) =>
              b.balance - a.balance
          )
          .slice(0, 10);

      let text =
        "🏆 <b>أغنى المستخدمين</b>\n\n";

      users.forEach((u, i) => {
        text +=
          `${i + 1}. ${escapeText(
            u.name
          )} — ${money(u.balance)}\n`;
      });

      await safeSend(
        msg.chat.id,
        text,
        {
          parse_mode: "HTML"
        }
      );

      return;
    }

    if (data === "games") {
      await safeSend(
        msg.chat.id,
`🎮 <b>الألعاب</b>

🏙️ /capital
🇪🇬 /arabic
➗ /math
❓ /riddle
🎯 /guess
🔢 /number`,
        {
          parse_mode: "HTML"
        }
      );

      return;
    }

    if (data === "help") {
      await safeSend(
        msg.chat.id,
        "اكتب /help لعرض جميع الأوامر."
      );

      return;
    }

    if (data === "quran") {
      await safeEdit(
        msg.chat.id,
        msg.message_id,
`📖 <b>القرآن الكريم</b>

اختر السورة:`,
        {
          parse_mode: "HTML",
          ...quranKeyboard(0)
        }
      );

      return;
    }

    if (data.startsWith("qpage_")) {
      const page =
        Number(
          data.replace(
            "qpage_",
            ""
          )
        );

      await safeEdit(
        msg.chat.id,
        msg.message_id,
        "📖 <b>اختر السورة:</b>",
        {
          parse_mode: "HTML",
          ...quranKeyboard(
            Number.isFinite(page)
              ? page
              : 0
          )
        }
      );

      return;
    }

    if (data.startsWith("surah_")) {
      const number =
        Number(
          data.replace(
            "surah_",
            ""
          )
        );

      const surah =
        surahs.find(
          s => s[0] === number
        );

      if (!surah) return;

      const audio =
        `https://cdn.islamic.network/quran/audio-surah/128/ar.alafasy/${number}.mp3`;

      const info =
`📖 <b>سورة ${escapeText(
        surah[1]
      )}</b>

🔢 رقم السورة:
${surah[0]}

📜 عدد الآيات:
${surah[2]}

🎧 رابط التلاوة:
${audio}

يمكنك فتح الرابط لسماع السورة كاملة.`;

      await safeSend(
        msg.chat.id,
        info,
        {
          parse_mode: "HTML"
        }
      );

      return;
    }

    if (data === "k_start") {
      const khatma =
        getKhatma(user.id);

      khatma.active = true;
      khatma.startedAt =
        khatma.startedAt ||
        now();
      khatma.updatedAt = now();

      saveDatabase();

      const next =
        surahs.find(
          s =>
            !khatma.completed.includes(
              s[0]
            )
        );

      await safeSend(
        msg.chat.id,
`🕌 <b>بدأت ختمتك</b>

📖 السورة التالية:
<b>${next ? next[1] : "مكتملة"}</b>

استخدم زر "إتمام السورة" بعد الانتهاء.`,
        {
          parse_mode: "HTML"
        }
      );

      return;
    }

    if (data === "k_progress") {
      const khatma =
        getKhatma(user.id);

      await safeSend(
        msg.chat.id,
`📊 <b>تقدم الختمة</b>

📖 ${khatma.completed.length}/114
📈 ${khatmaProgress(
          khatma
        )}%`,
        {
          parse_mode: "HTML"
        }
      );

      return;
    }

    if (data === "k_reset") {
      const khatma =
        getKhatma(user.id);

      khatma.completed = [];
      khatma.active = false;
      khatma.startedAt = null;
      khatma.updatedAt = now();

      saveDatabase();

      await safeSend(
        msg.chat.id,
        "🔄 تم إعادة الختمة من البداية."
      );

      return;
    }
  } catch (error) {
    console.error(
      "callback:",
      error.message
    );
  }
});

/* ========================================================
   WELCOME
======================================================== */

bot.on(
  "new_chat_members",
  async msg => {
    if (!isGroup(msg)) return;

    const group =
      ensureGroup(msg.chat);

    if (!group.settings.welcome) {
      return;
    }

    for (const member of msg.new_chat_members || []) {
      if (member.is_bot) continue;

      ensureUser(member);

      await safeSend(
        msg.chat.id,
`👋 أهلاً بك يا <b>${escapeText(
          userDisplayName(member)
        )}</b>

نورت جروبنا ❤️

🤖 ${BOT_NAME}`,
        {
          parse_mode: "HTML"
        }
      );
    }
  }
);

/* ========================================================
   CHAT MEMBER EVENTS
======================================================== */

bot.on(
  "left_chat_member",
  async msg => {
    if (!isGroup(msg)) return;

    const group =
      ensureGroup(msg.chat);

    group.lastSeen = now();

    saveDatabase();
  }
);

/* ========================================================
   GENERAL MESSAGE HANDLER
======================================================== */

bot.on("message", async msg => {
  try {
    if (!msg || !msg.from) {
      return;
    }

    if (msg.new_chat_members) {
      return;
    }

    const user =
      ensureUser(msg.from);

    if (isGroup(msg)) {
      const group =
        ensureGroup(msg.chat);

      group.stats.messages++;

      if (
        group.stats.messages >
        1000000
      ) {
        group.stats.messages =
          900000;
      }
    }

    if (
      db.settings.maintenance &&
      !isOwner(msg.from)
    ) {
      if (
        msg.text &&
        !msg.text.startsWith("/start")
      ) {
        return;
      }
    }

    if (
      msg.text &&
      msg.text.startsWith("/")
    ) {
      return;
    }

    if (
      msg.text &&
      await handleGameAnswer(msg)
    ) {
      return;
    }

    if (
      isGroup(msg) &&
      msg.text
    ) {
      const text =
        msg.text.trim()
          .toLowerCase();

      const replies =
        ensureReplies(msg.chat.id);

      const shortcuts =
        ensureShortcuts(msg.chat.id);

      const group =
        ensureGroup(msg.chat);

      if (
        group.settings.replies &&
        replies[text]
      ) {
        await safeSend(
          msg.chat.id,
          replies[text].text
        );

        return;
      }

      if (shortcuts[text]) {
        await safeSend(
          msg.chat.id,
          shortcuts[text].text
        );

        return;
      }
    }

    saveDatabase();
  } catch (error) {
    console.error(
      "message handler:",
      error.message
    );
  }
});

/* ========================================================
   OWNER COMMANDS
======================================================== */

bot.onText(
  /^\/maintenance(?:\s+(on|off))?$/i,
  async (msg, match) => {
    if (!isOwner(msg.from)) {
      await safeSend(
        msg.chat.id,
        "❌ للمالك فقط."
      );

      return;
    }

    const mode =
      String(match[1] || "")
        .toLowerCase();

    if (mode === "on") {
      db.settings.maintenance = true;
    } else if (mode === "off") {
      db.settings.maintenance = false;
    } else {
      await safeSend(
        msg.chat.id,
        `⚙️ الصيانة: ${
          db.settings.maintenance
            ? "🟢 مفعلة"
            : "🔴 غير مفعلة"
        }\n\n/maintenance on\n/maintenance off`
      );

      return;
    }

    saveDatabase();

    await safeSend(
      msg.chat.id,
      `✅ تم ${
        db.settings.maintenance
          ? "تفعيل"
          : "إيقاف"
      } وضع الصيانة.`
    );
  }
);

bot.onText(
  /^\/bank_global\s+(on|off)$/i,
  async (msg, match) => {
    if (!isOwner(msg.from)) {
      await safeSend(
        msg.chat.id,
        "❌ للمالك فقط."
      );

      return;
    }

    db.settings.bankEnabled =
      match[1].toLowerCase() ===
      "on";

    saveDatabase();

    await safeSend(
      msg.chat.id,
      `🏦 البنك العام: ${
        db.settings.bankEnabled
          ? "🟢 مفتوح"
          : "🔴 مقفول"
      }`
    );
  }
);

bot.onText(
  /^\/games_global\s+(on|off)$/i,
  async (msg, match) => {
    if (!isOwner(msg.from)) {
      await safeSend(
        msg.chat.id,
        "❌ للمالك فقط."
      );

      return;
    }

    db.settings.gamesEnabled =
      match[1].toLowerCase() ===
      "on";

    saveDatabase();

    await safeSend(
      msg.chat.id,
      `🎮 الألعاب العامة: ${
        db.settings.gamesEnabled
          ? "🟢 مفتوحة"
          : "🔴 مقفولة"
      }`
    );
  }
);

/* ========================================================
   USER LOOKUP
======================================================== */

bot.onText(
  /^\/user\s+(\d+)$/i,
  async (msg, match) => {
    if (!isOwner(msg.from)) {
      await safeSend(
        msg.chat.id,
        "❌ للمالك فقط."
      );

      return;
    }

    const user =
      db.users[String(match[1])];

    if (!user) {
      await safeSend(
        msg.chat.id,
        "❌ المستخدم غير موجود."
      );

      return;
    }

    await safeSend(
      msg.chat.id,
`👤 <b>بيانات المستخدم</b>

الاسم:
${escapeText(user.name)}

Username:
${escapeText(
        user.username
          ? "@" + user.username
          : "غير موجود"
      )}

Telegram ID:
<code>${user.telegramId}</code>

رقم الحساب:
<code>${user.accountNumber}</code>

الرصيد:
<b>${money(user.balance)}</b>

النقاط:
<b>${money(user.points)}</b>

التسجيل:
${formatDate(user.registeredAt)}`,
      {
        parse_mode: "HTML"
      }
    );
  }
);

/* ========================================================
   GROUP ADMIN LIST
======================================================== */

bot.onText(
  /^\/admins$/i,
  async msg => {
    if (!isGroup(msg)) {
      await safeSend(
        msg.chat.id,
        "❌ داخل الجروب فقط."
      );

      return;
    }

    const group =
      ensureGroup(msg.chat);

    const admins =
      Object.values(
        group.admins || {}
      );

    if (!admins.length) {
      await safeSend(
        msg.chat.id,
        "🛡️ لا يوجد مشرفون مضافون لنظام البوت."
      );

      return;
    }

    let text =
      "🛡️ <b>مشرفو نظام البوت</b>\n\n";

    admins.forEach(
      (admin, index) => {
        text +=
`${index + 1}. ${escapeText(
          admin.name
        )} ${
          admin.username
            ? "@" + admin.username
            : ""
        }\n`;
      }
    );

    await safeSend(
      msg.chat.id,
      text,
      {
        parse_mode: "HTML"
      }
    );
  }
);

/* ========================================================
   ACCOUNT SEARCH
======================================================== */

bot.onText(
  /^\/account\s+(\d+)$/i,
  async (msg, match) => {
    ensureUser(msg.from);

    const account =
      String(match[1]);

    const target =
      Object.values(db.users)
        .find(
          u =>
            String(
              u.accountNumber
            ) === account
        );

    if (!target) {
      await safeSend(
        msg.chat.id,
        "❌ رقم الحساب غير موجود."
      );

      return;
    }

    await safeSend(
      msg.chat.id,
`🏦 <b>الحساب</b>

🔢 الرقم:
<code>${target.accountNumber}</code>

👤 الاسم:
${escapeText(target.name)}

🟢 الحساب موجود وجاهز للتحويل.`,
      {
        parse_mode: "HTML"
      }
    );
  }
);

/* ========================================================
   PREMIUM STATUS
======================================================== */

bot.onText(
  /^\/mypremium$/i,
  async msg => {
    const user =
      ensureUser(msg.from);

    if (!isPremium(user.id)) {
      await safeSend(
        msg.chat.id,
        "👤 حسابك ليس Premium."
      );

      return;
    }

    await safeSend(
      msg.chat.id,
`👑 <b>Premium</b>

🟢 مفعل

📅 ينتهي:
${formatDate(
        user.premiumUntil
      )}`,
      {
        parse_mode: "HTML"
      }
    );
  }
);

/* ========================================================
   ERROR HANDLING
======================================================== */

bot.on("polling_error", error => {
  console.error(
    "Polling error:",
    error.message
  );
});

process.on(
  "uncaughtException",
  error => {
    console.error(
      "Uncaught Exception:",
      error
    );

    saveDatabaseNow();
  }
);

process.on(
  "unhandledRejection",
  error => {
    console.error(
      "Unhandled Rejection:",
      error
    );
  }
);

process.on(
  "SIGINT",
  () => {
    saveDatabaseNow();
    process.exit(0);
  }
);

process.on(
  "SIGTERM",
  () => {
    saveDatabaseNow();
    process.exit(0);
  }
);

/* ========================================================
   STARTUP
======================================================== */

(async () => {
  try {
    const me =
      await bot.getMe();

    console.log(
      "======================================"
    );

    console.log(
      `🤖 ${BOT_NAME}`
    );

    console.log(
      `👤 @${me.username}`
    );

    console.log(
      `👑 Owner: @${OWNER_USERNAME}`
    );

    console.log(
      `💾 Database: ${DB_FILE}`
    );

    console.log(
      "🟢 Bot is running..."
    );

    console.log(
      "======================================"
    );

    saveDatabaseNow();
  } catch (error) {
    console.error(
      "❌ Bot startup failed:",
      error.message
    );

    process.exit(1);
  }
})();

require("dotenv").config();
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.GROUP_CHAT_ID; // ID của group
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;
const GROUP_CHAT_IDS = ["-1002338239150", "-1002261315432", "-1002343434921"];
let submittedUsers = new Set();
let userReportsByGroup = {}; // Dữ liệu lưu trữ bài tập theo từng nhóm
let trackedUsersByGroup = {}; // Dữ liệu lưu danh sách thành viên theo từng nhóm
const HOURS = "23";
const MINUTES = "50";

async function fetchGroupMembers(chatId) {
  try {
    const response = await axios.get(`${TELEGRAM_API}/getChatAdministrators`, {
      params: { chat_id: chatId },
    });

    trackedUsersByGroup[chatId] = response.data.result
      .map((member) => member.user.username)
      .filter(Boolean);
  } catch (error) {
    console.error(`Lỗi kết nối Telegram API cho nhóm ${chatId}:`, error);
  }
}

// Gửi thống kê cuối ngày
async function sendSummary() {
  const groupUsers = await getGroupMembers();
  let notSubmitted = groupUsers.filter((user) => !submittedUsers.has(user.id));

  let report = "📌 *DANH SÁCH CHƯA NỘP BÀI:*\n";
  report += notSubmitted
    .map((u) => `@${u.username || u.first_name}`)
    .join("\n");

  await sendMessage(CHAT_ID, report);
  submittedUsers.clear(); // Reset danh sách
}

async function sendReport(chatId) {
  let reportMessage = "📋 *Danh sách hashtag được theo dõi hôm nay*\n\n";
  const userReports = userReportsByGroup[chatId] || {};
  const trackedUsers = trackedUsersByGroup[chatId] || [];
  const usersReported = Object.keys(userReports);

  // Thống kê người đã gửi bài
  for (const user of usersReported) {
    reportMessage += `@${user} - Đã gửi ${userReports[user].length} bài.\n`;
  }

  // Thống kê người chưa gửi bài
  const usersNotReported = trackedUsers.filter(
    (user) => !usersReported.includes(user)
  );
  if (usersNotReported.length > 0) {
    reportMessage += `\n⚠️ *Danh sách chưa gửi bài tập:*\n`;
    for (const user of usersNotReported) {
      reportMessage += `@${user} - Chưa gửi bài.\n`;
    }
  } else {
    reportMessage += `\n✅ Tất cả thành viên đã gửi bài tập hôm nay.`;
  }

  await sendMessage(chatId, reportMessage);
  submittedUsers.clear(); // Reset danh sách
  delete userReportsByGroup[chatId];
}

// Hàm lấy danh sách thành viên nhóm (yêu cầu bot phải là admin)
async function getGroupMembers() {
  try {
    const response = await axios.get(`${TELEGRAM_API}/getChatAdministrators`, {
      params: { chat_id: CHAT_ID },
    });
    return response.data.result.map((admin) => admin.user);
  } catch (error) {
    console.error("Lỗi khi lấy danh sách thành viên:", error.message);
    return [];
  }
}
// Xử lý webhook nhận tin nhắn từ Telegram
app.post(`/webhook/${TOKEN}`, async (req, res) => {
  const message = req.body.message;
  if (!message || !message.text) return res.sendStatus(200);

  const userId = message.from.id;
  const username = message.from.username || message.from.first_name;
  const chatId = message.chat.id;
  if (message.text.includes("#track")) {
    submittedUsers.add(userId);
    // them danh sach vao nhung nguoi da  nop bai
    if (!userReportsByGroup[chatId]) {
      userReportsByGroup[chatId] = {};
    }
    if (!userReportsByGroup[chatId][username]) {
      userReportsByGroup[chatId][username] = [];
    }
    userReportsByGroup[chatId][username].push(text);
    await sendMessage(
      chatId,
      `Cảm ơn @${username} đã gửi bài tập. Hãy giữ tinh thần học tập nhé!`
    );
  } else if (message.text.includes("#summary")) {
    // sendSummary();
    sendReportToGroupChats();
  }

  res.sendStatus(200);
});

// Hàm gửi tin nhắn
async function sendMessage(chatId, text) {
  await axios.post(`${TELEGRAM_API}/sendMessage`, {
    chat_id: chatId,
    text: text,
    parse_mode: "Markdown",
  });
}

async function sendReportToGroupChats() {
  const groupChatIds = GROUP_CHAT_IDS;
  for (const chatId of groupChatIds) {
    await sendReport(chatId);
  }
}
// Cài đặt lịch trình chạy mỗi ngày (ví dụ: 23:50)
setInterval(() => {
  const now = new Date();
  const currentHours = now.getHours();
  const currentMinutes = now.getMinutes();
  if (String(currentHours) === HOURS && String(currentMinutes) === MINUTES) {
    // sendSummary();
    sendReportToGroupChats();
  }
}, 60000); // Kiểm tra mỗi phút

async function initialize() {
  const groupChatIds = GROUP_CHAT_IDS;
  for (const chatId of groupChatIds) {
    await fetchGroupMembers(chatId);
  }
  console.log("trackedUsersByGroup ====", trackedUsersByGroup);
}

initialize();
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Bot đang chạy trên cổng ${PORT}`);
});



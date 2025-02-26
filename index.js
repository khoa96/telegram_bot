require("dotenv").config();
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const TOKEN = process.env.BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;
const GROUP_CHAT_IDS = process.env.GROUP_CHAT_IDS.split(",").map(Number);

let submittedUsers = new Set();
let userReportsByGroup = {}; // Dữ liệu lưu trữ bài tập theo từng nhóm
let trackedUsersByGroup = {}; // Dữ liệu lưu danh sách thành viên theo từng nhóm
let threadIdsByGroup = {}; // lưu danh sách threadId đã fgửi

const HOURS = process.env.HOURS;
const MINUTES = process.env.MINUTES;
const HASHTAG = "#submit";
const REPORT = "#report";

function getFormatedDate() {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0"); // Lấy ngày (DD)
  const month = String(now.getMonth() + 1).padStart(2, "0"); // Lấy tháng (MM) (Tháng bắt đầu từ 0)
  const year = now.getFullYear(); // Lấy năm (YYYY)

  return `${day}/${month}/${year}`;
}

async function fetchGroupMembers(chatId) {
  try {
    const response = await axios.get(`${TELEGRAM_API}/getChatAdministrators`, {
      params: { chat_id: chatId },
    });
    trackedUsersByGroup[chatId] = response.data.result.map(
      (admin) => admin.user
    );
    userReportsByGroup[chatId] = [];
  } catch (error) {
    console.error(`Lỗi kết nối Telegram API cho nhóm ${chatId}:`, error);
  }
}

async function sendReport(chatId) {
  try {
    console.log("=======call send report ===");
    const groupUsers = trackedUsersByGroup[chatId] || [];
    const userReported = userReportsByGroup[chatId] || [];
    // const threadId = threadIdsByGroup[chatId] || ""; // Lấy threadId đã lưu
    let notSubmitted = groupUsers.filter((user) => {
      return !user.is_bot && !userReported.includes(String(user.id));
    });

    const formatedDate = getFormatedDate();
    let report = `📌 *DANH SÁCH THÀNH VIÊN CHƯA NỘP BÀI NGÀY ${formatedDate}*\n`;
    report += notSubmitted
      .map((user) => {
        const mention = user.username || user.first_name || user.last_name;
        const lastName = user?.last_name || "";
        const firstName = user?.first_name || "";
        let username = `${lastName} ${firstName}`;
        return `@${mention} (${username})`;
      })
      .join("\n");

    // console.log("thread Id =====", threadId);
    // if (!!threadId) {
    //   await sendMessage(chatId, report, threadId);
    // } else {
    //   await sendMessage(chatId, report, "");
    // }
    await sendMessage2(chatId, report);
    userReportsByGroup[chatId] = [];
  } catch (err) {}
}

async function sendReportToGroups() {
  const groupChatIds = GROUP_CHAT_IDS;
  for (const chatId of groupChatIds) {
    await sendReport(chatId);
  }
}

// Xử lý webhook nhận tin nhắn từ Telegram
app.post(`/webhook/${TOKEN}`, async (req, res) => {
  const message = req.body.message;
  if (!message) return res.sendStatus(200);

  const threadId = message.message_thread_id;
  const userId = message.from.id;
  const chatId = message.chat.id;
  const username =
    message.from.username || message.from.first_name || message.from.last_name;

  const textMessage = message.text || "";
  const captionMessage = message.caption || "";
  const lowerCaseTextMessage = textMessage.toLowerCase();
  const lowerCaseCaptionMessage = captionMessage.toLowerCase();

  console.log("lowerCaseTextMessage=====", lowerCaseTextMessage);
  console.log("lowerCaseCaptionMessage", lowerCaseCaptionMessage);

  const isCanRespond =
    lowerCaseTextMessage.includes(HASHTAG) ||
    lowerCaseCaptionMessage.includes(HASHTAG);

  const isCanReport =
    lowerCaseTextMessage.includes(REPORT) ||
    lowerCaseCaptionMessage.includes(REPORT);

  if (isCanRespond) {
    console.log("=====call 01 ===");
    submittedUsers.add(userId);
    if (!userReportsByGroup[chatId]) {
      userReportsByGroup[chatId] = [];
    }

    if (!threadIdsByGroup[chatId] && threadId) {
      threadIdsByGroup[chatId] = threadId; // Lưu threadId cho nhóm
    }
    let currentUserReportsByGroup = userReportsByGroup[chatId];
    currentUserReportsByGroup.push(String(userId));
    userReportsByGroup[chatId] = currentUserReportsByGroup;

    await sendMessage(
      message.chat.id,
      `Cảm ơn @${username} đã gửi bài tập. Hãy học tiếng Anh đều đặn nhé!`,
      threadId
    );
    console.log("threadIdsByGroup =====", threadIdsByGroup);
    return;
  }
  if (isCanReport) {
    console.log("=====call 02 ===");
    sendReport(chatId);
  }
  res.sendStatus(200);
});

// Hàm gửi tin nhắn
async function sendMessage(chatId, text, messageThreadId) {
  try {
    let response;
    if (!!messageThreadId) {
      response = await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId,
        text: text,
        parse_mode: "Markdown",
        message_thread_id: messageThreadId, // Gửi đúng forum
      });
    } else {
      response = await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId,
        text: text,
        parse_mode: "Markdown",
      });
    }
    // console.log("📩 Message sent:", response.data);
  } catch (error) {
    console.error(
      "🚨 Error sending message:",
      error.response?.data || error.message
    );
  }
}

async function sendMessage2(chatId, text) {
  try {
    console.log("=====call here ====");
    const response = await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: chatId,
      text: text,
      parse_mode: "Markdown",
    });

    console.log("📩 Message sent:", response.data);
  } catch (error) {
    console.error(
      "🚨 Error sending message:",
      error.response?.data || error.message
    );
  }
}

async function initialize() {
  const groupChatIds = GROUP_CHAT_IDS;
  for (const chatId of groupChatIds) {
    await fetchGroupMembers(chatId);
  }
}

// lấy danh sách thành viên của mỗi nhóm chat.
initialize();
// Cài đặt lịch trình chạy mỗi ngày (ví dụ: 23:50)
setInterval(() => {
  const now = new Date();
  const currentHours = now.getHours();
  const currentMinutes = now.getMinutes();
  if (
    String(currentHours) === String(HOURS) &&
    String(currentMinutes) === String(MINUTES)
  ) {
    sendReportToGroups();
  }
}, 60000);


// Chạy server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Bot đang chạy trên cổng ${PORT}`);
});

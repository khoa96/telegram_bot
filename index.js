require("dotenv").config();
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.GROUP_CHAT_ID; // ID của group
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;

let submittedUsers = new Set();

const HOURS = "11";
const MINUTES = ["05", "10", "15", "20", "25", "30"];

// Gửi thống kê cuối ngày
async function sendSummary() {
  const groupUsers = await getGroupMembers();
  console.log("group users =======", groupUsers);
  let notSubmitted = groupUsers.filter((user) => !submittedUsers.has(user.id));

  let report = "📌 *DANH SÁCH CHƯA NỘP BÀI:*\n";
  report += notSubmitted
    .map((u) => `@${u.username || u.first_name}`)
    .join("\n");

  await sendMessage(CHAT_ID, report);
  submittedUsers.clear(); // Reset danh sách
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

  if (message.text.includes("#track")) {
    submittedUsers.add(userId);
    await sendMessage(
      message.chat.id,
      `Cảm ơn @${username} đã gửi bài tập. Hãy giữ tinh thần học tập nhé!`
    );
  } else if (message.text.includes("#summary")) {
    sendSummary();
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

// Cài đặt lịch trình chạy mỗi ngày (ví dụ: 23:50)
setInterval(() => {
  const now = new Date();
  const currentHours = now.getHours();
  const currentMinutes = now.getMinutes();
  if (
    String(currentHours) === HOURS &&
    MINUTES.includes(String(currentMinutes))
  ) {
    sendSummary();
  }
}, 60000); // Kiểm tra mỗi phút

// Chạy server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Bot đang chạy trên cổng ${PORT}`);
});



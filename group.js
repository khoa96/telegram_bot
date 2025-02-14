const TelegramBot = require("node-telegram-bot-api");
const fetch = require("node-fetch");
const token = "YOUR_BOT_TOKEN"; // Thay YOUR_BOT_TOKEN bằng token của bạn

const bot = new TelegramBot(token, { polling: true });

const groupReports = {}; // Lưu dữ liệu theo từng nhóm { chatId: { userReports, trackedUsers } }

// Hàm lấy danh sách quản trị viên hoặc thành viên nhóm
async function fetchGroupMembers(chatId) {
  const apiUrl = `https://api.telegram.org/bot${token}/getChatAdministrators?chat_id=${chatId}`;

  try {
    const response = await fetch(apiUrl);
    const data = await response.json();

    if (data.ok) {
      const trackedUsers = data.result
        .map((member) => member.user.username)
        .filter(Boolean);
      if (!groupReports[chatId]) {
        groupReports[chatId] = { userReports: {}, trackedUsers: [] };
      }
      groupReports[chatId].trackedUsers = trackedUsers;
      console.log(
        `Danh sách thành viên nhóm ${chatId} đã cập nhật:`,
        trackedUsers
      );
    } else {
      console.error(
        `Lỗi khi lấy danh sách quản trị viên cho nhóm ${chatId}:`,
        data
      );
    }
  } catch (error) {
    console.error(`Lỗi kết nối Telegram API cho nhóm ${chatId}:`, error);
  }
}

// Lắng nghe tin nhắn từ người dùng trong nhiều nhóm
bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text || "";

  if (!groupReports[chatId]) {
    groupReports[chatId] = { userReports: {}, trackedUsers: [] };
  }

  // Kiểm tra hashtag #track
  if (text.includes("#track")) {
    const username = msg.from.username || "Người dùng ẩn danh";
    if (!groupReports[chatId].userReports[username]) {
      groupReports[chatId].userReports[username] = [];
    }
    groupReports[chatId].userReports[username].push(text);
    bot.sendMessage(chatId, `Cảm ơn @${username}, bạn đã gửi bài.`);
  }
});

// Hàm gửi báo cáo hàng ngày cho từng nhóm
function sendDailyReport() {
  for (const chatId in groupReports) {
    let reportMessage = "📋 *Danh sách hashtag được theo dõi hôm nay*\n\n";

    const { userReports, trackedUsers } = groupReports[chatId];
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

    bot.sendMessage(chatId, reportMessage, { parse_mode: "Markdown" });

    // Xóa dữ liệu sau báo cáo
    Object.keys(userReports).forEach((user) => delete userReports[user]);
  }
}

// Gửi báo cáo hàng ngày vào 23:50
setInterval(() => {
  const now = new Date();
  if (now.getHours() === 23 && now.getMinutes() === 50) {
    sendDailyReport();
  }
}, 60000);

// Lấy danh sách thành viên của nhiều nhóm (Thay YOUR_GROUP_CHAT_IDS thành mảng chatId thực tế)
const groupChatIds = [
  "YOUR_GROUP_CHAT_ID_A",
  "YOUR_GROUP_CHAT_ID_B",
  "YOUR_GROUP_CHAT_ID_C",
];

groupChatIds.forEach((chatId) => fetchGroupMembers(chatId));

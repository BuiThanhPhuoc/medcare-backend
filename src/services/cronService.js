const cron = require('node-cron');
const db = require('../config/db');
const { sendConfirmationEmail } = require('./emailService'); 

// Chạy vào 8:00 sáng mỗi ngày: "0 8 * * *"
// (Để test ngay bây giờ, bạn có thể đổi thành "*/1 * * * *" để nó chạy mỗi phút)
cron.schedule("0 8 * * *", async () => {
    console.log("⏳ Đang chạy Cron Job kiểm tra lịch khám ngày mai...");
    try {
        // Tìm các lịch khám vào ngày mai và trạng thái đang pending hoặc confirmed
        const [appointments] = await db.execute(`
            SELECT a.*, u.email, u.username 
            FROM appointments a
            JOIN users u ON a.patient_id = u.id
            WHERE a.appointment_date = CURDATE() + INTERVAL 1 DAY
            AND a.status IN ('pending', 'confirmed')
        `);

        if (appointments.length > 0) {
            for (const appt of appointments) {
                // Tái sử dụng lại hàm gửi mail, nhưng thay đổi nội dung subject/text (ở đây mình dùng tạm hàm cũ cho nhanh, bạn có thể viết thêm 1 hàm sendReminderEmail trong emailService)
                await sendConfirmationEmail(
                    appt.email, 
                    appt.appointment_date, 
                    appt.appointment_time
                );
                console.log(`✅ Đã gửi email nhắc lịch cho ${appt.email}`);
            }
        } else {
            console.log("Không có lịch khám nào vào ngày mai cần nhắc.");
        }
    } catch (error) {
        console.error("❌ Lỗi khi chạy Cron Job:", error);
    }
});
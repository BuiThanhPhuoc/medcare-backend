const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const sendConfirmationEmail = async (patientEmail, date, time) => {
    try {
        const mailOptions = {
            from: `"Phòng khám MedCare" <${process.env.EMAIL_USER}>`,
            to: patientEmail,
            subject: 'Xác nhận đặt lịch khám thành công',
            text: `Chào bạn,\n\nBạn đã đặt lịch khám thành công tại phòng khám MedCare.\n- Ngày khám: ${date}\n- Thời gian: ${time}\n\nVui lòng đến đúng giờ để được phục vụ tốt nhất.\n\nTrân trọng,\nPhòng khám MedCare`
        };

        await transporter.sendMail(mailOptions);
        console.log('✅ Đã gửi email xác nhận đến:', patientEmail);
    } catch (error) {
        console.error('❌ Lỗi gửi email:', error);
    }
};

module.exports = { sendConfirmationEmail };
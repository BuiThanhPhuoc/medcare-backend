const db = require('./src/config/db'); 

const seedSpecialties = async () => {
    // Danh sách 44 khoa phòng chuẩn quy mô Bệnh viện đa khoa
    const specialties = [
        { ten: 'Khoa khám bệnh', slug: 'khoa-kham-benh', mo_ta: 'Tổ chức khám bệnh ngoại trú, phân loại và phân luồng bệnh nhân.' },
        { ten: 'Khoa Hồi sức cấp cứu', slug: 'khoa-hoi-suc-cap-cuu', mo_ta: 'Tiếp nhận, xử trí và điều trị tích cực các bệnh nhân cấp cứu nặng.' },
        { ten: 'Khoa Nội tổng hợp', slug: 'khoa-noi-tong-hop', mo_ta: 'Khám và điều trị nội trú các bệnh lý nội khoa chung.' },
        { ten: 'Khoa Nội tim mạch', slug: 'khoa-noi-tim-mach', mo_ta: 'Chẩn đoán và điều trị các bệnh lý tim mạch, huyết áp.' },
        { ten: 'Khoa Nội tiêu hóa', slug: 'khoa-noi-tieu-hoa', mo_ta: 'Điều trị các bệnh lý liên quan đến dạ dày, ruột, gan, mật.' },
        { ten: 'Khoa Nội cơ – xương – khớp', slug: 'khoa-noi-co-xuong-khop', mo_ta: 'Chẩn đoán và điều trị các bệnh lý về hệ cơ, xương và khớp.' },
        { ten: 'Khoa Nội thận – tiết niệu', slug: 'khoa-noi-than-tiet-nieu', mo_ta: 'Điều trị bệnh lý về thận và đường tiết niệu nội khoa.' },
        { ten: 'Khoa Nội tiết', slug: 'khoa-noi-tiet', mo_ta: 'Khám và điều trị bệnh đái tháo đường, tuyến giáp và các bệnh nội tiết khác.' },
        { ten: 'Khoa Dị ứng', slug: 'khoa-di-ung', mo_ta: 'Chẩn đoán và điều trị các bệnh lý dị ứng, miễn dịch lâm sàng.' },
        { ten: 'Khoa Huyết Học lâm sàng', slug: 'khoa-huyet-hoc-lam-sang', mo_ta: 'Điều trị các bệnh lý liên quan đến máu và cơ quan tạo máu.' },
        { ten: 'Khoa Truyền nhiễm', slug: 'khoa-truyen-nhiem', mo_ta: 'Cách ly, chẩn đoán và điều trị các bệnh do vi sinh vật lây truyền.' },
        { ten: 'Khoa Lao', slug: 'khoa-lao', mo_ta: 'Chẩn đoán, điều trị và quản lý các bệnh nhân lao phổi, lao ngoài phổi.' },
        { ten: 'Khoa Da Liễu', slug: 'khoa-da-lieu', mo_ta: 'Khám và điều trị các bệnh lý về da, lông, tóc, móng.' },
        { ten: 'Khoa Thần kinh', slug: 'khoa-than-kinh', mo_ta: 'Điều trị các bệnh lý thuộc hệ thần kinh trung ương và ngoại biên.' },
        { ten: 'Khoa Tâm thần', slug: 'khoa-tam-than', mo_ta: 'Khám, tư vấn và điều trị các rối loạn tâm lý, tâm thần.' },
        { ten: 'Khoa Y học cổ truyền', slug: 'khoa-y-hoc-co-truyen', mo_ta: 'Khám chữa bệnh bằng thuốc Đông y, châm cứu, xoa bóp bấm huyệt.' },
        { ten: 'Khoa Lão học', slug: 'khoa-lao-hoc', mo_ta: 'Chăm sóc sức khỏe, điều trị bệnh lý đặc thù cho người cao tuổi.' },
        { ten: 'Khoa Nhi', slug: 'khoa-nhi', mo_ta: 'Khám, điều trị và chăm sóc sức khỏe toàn diện cho trẻ em.' },
        { ten: 'Khoa Ngoại tổng hợp', slug: 'khoa-ngoai-tong-hop', mo_ta: 'Khám và phẫu thuật điều trị các bệnh lý ngoại khoa chung.' },
        { ten: 'Khoa Ngoại thần kinh', slug: 'khoa-ngoai-than-kinh', mo_ta: 'Phẫu thuật điều trị các chấn thương và bệnh lý sọ não, cột sống.' },
        { ten: 'Khoa Ngoại lồng ngực', slug: 'khoa-ngoai-long-nguc', mo_ta: 'Phẫu thuật các bệnh lý lồng ngực, phổi và tim mạch ngoại khoa.' },
        { ten: 'Khoa Ngoại tiêu hóa', slug: 'khoa-ngoai-tieu-hoa', mo_ta: 'Phẫu thuật ống tiêu hóa, gan, mật, tụy.' },
        { ten: 'Khoa Ngoại thận – tiết niệu', slug: 'khoa-ngoai-than-tiet-nieu', mo_ta: 'Phẫu thuật các bệnh lý đường tiết niệu và cơ quan sinh dục nam.' },
        { ten: 'Khoa Chấn thương chỉnh hình', slug: 'khoa-chan-thuong-chinh-hinh', mo_ta: 'Xử trí, phẫu thuật chấn thương và phục hồi dị tật xương khớp.' },
        { ten: 'Khoa Bỏng', slug: 'khoa-bong', mo_ta: 'Cấp cứu, điều trị, phẫu thuật tạo hình và phục hồi tổn thương do bỏng.' },
        { ten: 'Khoa Phẫu thuật gây mê hồi sức', slug: 'khoa-phau-thuat-gay-me-hoi-suc', mo_ta: 'Thực hiện công tác vô cảm, gây mê và hồi sức trước, trong, sau phẫu thuật.' },
        { ten: 'Khoa Phụ sản', slug: 'khoa-phu-san', mo_ta: 'Chăm sóc thai kỳ, đỡ đẻ và điều trị các bệnh lý phụ khoa.' },
        { ten: 'Khoa Tai – mũi – họng', slug: 'khoa-tai-mui-hong', mo_ta: 'Khám, nội soi và điều trị các bệnh lý vùng tai, mũi, họng.' },
        { ten: 'Khoa Răng – hàm – mặt', slug: 'khoa-rang-ham-mat', mo_ta: 'Chăm sóc sức khỏe răng miệng, nha khoa thẩm mỹ và phẫu thuật hàm mặt.' },
        { ten: 'Khoa mắt', slug: 'khoa-mat', mo_ta: 'Khám đo thị lực, chẩn đoán và phẫu thuật các bệnh lý về mắt.' },
        { ten: 'Khoa Vật lý trị liệu', slug: 'khoa-vat-ly-tri-lieu', mo_ta: 'Tập luyện vật lý trị liệu, phục hồi chức năng vận động cho bệnh nhân.' },
        { ten: 'Khoa Y học hạt nhân', slug: 'khoa-y-hoc-hat-nhan', mo_ta: 'Ứng dụng đồng vị phóng xạ trong chẩn đoán hình ảnh và điều trị ung bướu.' },
        { ten: 'Khoa Truyền máu', slug: 'khoa-truyen-mau', mo_ta: 'Tiếp nhận, sàng lọc, lưu trữ và cung cấp chế phẩm máu an toàn.' },
        { ten: 'Khoa Lọc máu (thận nhân tạo)', slug: 'khoa-loc-mau', mo_ta: 'Thực hiện lọc máu, chạy thận nhân tạo chu kỳ cho bệnh nhân suy thận.' },
        { ten: 'Khoa Huyết học', slug: 'khoa-huyet-hoc', mo_ta: 'Khoa cận lâm sàng thực hiện các xét nghiệm chuyên sâu về tế bào máu.' },
        { ten: 'Khoa Hóa Sinh', slug: 'khoa-hoa-sinh', mo_ta: 'Khoa cận lâm sàng phân tích các chỉ số hóa sinh trong máu, dịch cơ thể.' },
        { ten: 'Khoa Vi sinh', slug: 'khoa-vi-sinh', mo_ta: 'Khoa cận lâm sàng nuôi cấy, phân lập vi sinh vật và làm kháng sinh đồ.' },
        { ten: 'Khoa Chẩn đoán hình ảnh', slug: 'khoa-chan-doan-hinh-anh', mo_ta: 'Thực hiện siêu âm, chụp X-quang, CT Scanner, MRI phục vụ lâm sàng.' },
        { ten: 'Khoa Thăm dò chức năng', slug: 'khoa-tham-do-chuc-nang', mo_ta: 'Thực hiện điện tâm đồ, điện não đồ, hô hấp ký và các đo lường chức năng.' },
        { ten: 'Khoa Nội soi', slug: 'khoa-noi-soi', mo_ta: 'Thực hiện các thủ thuật nội soi tiêu hóa, hô hấp để chẩn đoán và can thiệp.' },
        { ten: 'Khoa Giải phẫu bệnh', slug: 'khoa-giai-phau-benh', mo_ta: 'Xét nghiệm tế bào học, mô bệnh học nhằm chẩn đoán bản chất khối u.' },
        { ten: 'Khoa Chống nhiễm khuẩn', slug: 'khoa-chong-nhiem-khuan', mo_ta: 'Giám sát, quản lý và phòng ngừa nhiễm khuẩn trong toàn bộ bệnh viện.' },
        { ten: 'Khoa Dược', slug: 'khoa-duoc', mo_ta: 'Cung ứng, quản lý, pha chế thuốc và tư vấn thông tin sử dụng thuốc.' },
        { ten: 'Khoa Dinh dưỡng', slug: 'khoa-dinh-duong', mo_ta: 'Xây dựng khẩu phần ăn, tư vấn và cung cấp chế độ dinh dưỡng bệnh lý.' }
    ];

    try {
        console.log("=========================================");
        console.log("⏳ Bắt đầu nạp danh mục Khoa Phòng Bệnh Viện...");
        console.log(`📊 Tổng cộng: ${specialties.length} Khoa`);
        console.log("=========================================\n");

        let addedCount = 0;
        let skippedCount = 0;

        for (let item of specialties) {
            // Kiểm tra xem slug chuyên khoa đã tồn tại chưa
            const [existing] = await db.execute(`SELECT id FROM specialties WHERE slug = ?`, [item.slug]);

            if (existing.length > 0) {
                console.log(`⏩ Bỏ qua: [${item.ten}] (Đã tồn tại)`);
                skippedCount++;
            } else {
                // Thêm mới
                await db.execute(
                    `INSERT INTO specialties (ten, slug, mo_ta) VALUES (?, ?, ?)`,
                    [item.ten, item.slug, item.mo_ta]
                );
                console.log(`✅ Đã thêm: [${item.ten}]`);
                addedCount++;
            }
        }

        console.log("\n=========================================");
        console.log("🎉 HOÀN TẤT NẠP DỮ LIỆU!");
        console.log(`📈 Đã thêm mới: ${addedCount} khoa`);
        console.log(`📉 Đã bỏ qua: ${skippedCount} khoa`);
        console.log("=========================================");
        
        process.exit(0); 
    } catch (error) {
        console.error("\n❌ Lỗi nghiêm trọng khi bơm dữ liệu:", error);
        process.exit(1); 
    }
};

// Khởi chạy
seedSpecialties();
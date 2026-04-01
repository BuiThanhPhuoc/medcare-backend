const db = require('./src/config/db'); 

const seedPostsData = async () => {
    // 1. Danh sách Danh mục bài viết Y tế chuẩn
    const categories = [
        { name: 'Tin tức Y tế', slug: 'tin-tuc-y-te', description: 'Cập nhật tin tức y tế, dịch bệnh và hoạt động của bệnh viện' },
        { name: 'Kiến thức Sức khỏe', slug: 'kien-thuc-suc-khoe', description: 'Bài viết chia sẻ kiến thức phòng và chữa bệnh cơ bản' },
        { name: 'Dinh dưỡng & Đời sống', slug: 'dinh-duong-doi-song', description: 'Tư vấn chế độ ăn uống, tập luyện nâng cao sức khỏe' },
        { name: 'Mẹ & Bé', slug: 'me-va-be', description: 'Kiến thức chăm sóc thai kỳ, mẹ bầu và sức khỏe trẻ sơ sinh' },
        { name: 'Bệnh học', slug: 'benh-hoc', description: 'Từ điển tra cứu chi tiết về các loại bệnh lý' },
        { name: 'Cẩm nang Dược phẩm', slug: 'cam-nang-duoc-pham', description: 'Hướng dẫn sử dụng thuốc an toàn và hiệu quả' }
    ];

    // 2. Danh sách các Thẻ (Tags) phổ biến
    const tags = [
        { name: 'Covid-19', slug: 'covid-19' },
        { name: 'Tim mạch', slug: 'tim-mach' },
        { name: 'Tiểu đường', slug: 'tieu-duong' },
        { name: 'Dinh dưỡng', slug: 'dinh-duong' },
        { name: 'Ung thư', slug: 'ung-thu' },
        { name: 'Tiêm chủng', slug: 'tiem-chung' },
        { name: 'Nhi khoa', slug: 'nhi-khoa' },
        { name: 'Làm đẹp', slug: 'lam-dep' },
        { name: 'Sức khỏe tâm thần', slug: 'suc-khoe-tam-than' },
        { name: 'Xương khớp', slug: 'xuong-khop' }
    ];

    try {
        console.log("=========================================");
        console.log("⏳ Bắt đầu nạp dữ liệu Danh mục & Thẻ bài viết...");
        console.log("=========================================\n");

        // BƠM DANH MỤC
        console.log("📂 Đang kiểm tra và nạp Danh mục (Categories)...");
        for (let cat of categories) {
            const [existingCat] = await db.execute(`SELECT id FROM categories WHERE slug = ?`, [cat.slug]);
            if (existingCat.length > 0) {
                console.log(` ⏩ Bỏ qua Danh mục: [${cat.name}] (Đã tồn tại)`);
            } else {
                await db.execute(
                    `INSERT INTO categories (name, slug, description) VALUES (?, ?, ?)`,
                    [cat.name, cat.slug, cat.description]
                );
                console.log(` ✅ Đã thêm Danh mục: [${cat.name}]`);
            }
        }

        console.log("\n🏷️ Đang kiểm tra và nạp Thẻ (Tags)...");
        // BƠM THẺ
        for (let tag of tags) {
            const [existingTag] = await db.execute(`SELECT id FROM tags WHERE slug = ?`, [tag.slug]);
            if (existingTag.length > 0) {
                console.log(` ⏩ Bỏ qua Thẻ: [${tag.name}] (Đã tồn tại)`);
            } else {
                await db.execute(
                    `INSERT INTO tags (name, slug) VALUES (?, ?)`,
                    [tag.name, tag.slug]
                );
                console.log(` ✅ Đã thêm Thẻ: [${tag.name}]`);
            }
        }

        console.log("\n=========================================");
        console.log("🎉 HOÀN TẤT NẠP DỮ LIỆU BÀI VIẾT!");
        console.log("=========================================");
        
        process.exit(0); 
    } catch (error) {
        console.error("\n❌ Lỗi nghiêm trọng khi bơm dữ liệu:", error);
        process.exit(1); 
    }
};

// Khởi chạy
seedPostsData();
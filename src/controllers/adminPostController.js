const db = require('../config/db');

const adminPostController = {
    // 1. Lấy danh sách bài viết (Đã thêm LEFT JOIN để lấy tên Danh mục)
    getAllPosts: async (req, res) => {
        try {
            const [posts] = await db.execute(`
                SELECT p.*, c.name AS category_name 
                FROM posts p
                LEFT JOIN categories c ON p.category_id = c.id
                ORDER BY p.created_at DESC
            `);
            res.json({ posts });
        } catch (error) { 
            console.error("Lỗi get all posts:", error);
            res.status(500).json({ message: "Lỗi server" }); 
        }
    },

    // 2. Lấy thùng rác (Cũng thêm LEFT JOIN)
    getTrashedPosts: async (req, res) => {
        try {
            const [posts] = await db.execute(`
                SELECT p.*, c.name AS category_name 
                FROM posts p
                LEFT JOIN categories c ON p.category_id = c.id
                ORDER BY p.created_at DESC
            `);
            res.json({ posts });
        } catch (error) { res.status(500).json({ message: "Lỗi server" }); }
    },

    // 3. Lấy chi tiết 1 bài viết (Phải lấy kèm danh sách Tags)
    getPostById: async (req, res) => {
        try {
            const postId = req.params.id;
            const [posts] = await db.execute(`SELECT * FROM posts WHERE id = ?`, [postId]);
            
            if (posts.length === 0) {
                return res.status(404).json({ message: "Không tìm thấy bài viết" });
            }

            const post = posts[0];

            // Lấy danh sách ID các thẻ (tags) của bài viết này
            const [tags] = await db.execute(`SELECT tag_id FROM post_tag WHERE post_id = ?`, [postId]);
            // Biến nó thành 1 mảng đơn giản ví dụ: [1, 3, 5] để đẩy về Frontend
            post.tags = tags.map(t => t.tag_id);

            res.json({ post });
        } catch (error) { res.status(500).json({ message: "Lỗi server" }); }
    },

    // 4. Tạo bài viết mới (Cần lưu luôn Tags)
    createPost: async (req, res) => {
        const connection = await db.getConnection(); // Dùng connection để đảm bảo toàn vẹn dữ liệu
        try {
            await connection.beginTransaction();
            
            const { title, danh_muc_id, category_id, status, excerpt, content, published_at, thumbnail, meta_title, meta_description, tags } = req.body;
            
            // Hỗ trợ cả biến cũ và mới
            const finalCategoryId = category_id || danh_muc_id || null;

            // 4.1 Lưu bài viết
            const [result] = await connection.execute(
                `INSERT INTO posts (title, category_id, status, excerpt, content, published_at, thumbnail, meta_title, meta_description) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [title, finalCategoryId, status, excerpt, content, published_at || null, thumbnail, meta_title, meta_description]
            );

            const postId = result.insertId;

            // 4.2 Lưu Tags vào bảng post_tag
            if (tags && tags.length > 0) {
                for(let tagId of tags) {
                     await connection.execute(`INSERT INTO post_tag (post_id, tag_id) VALUES (?, ?)`, [postId, tagId]);
                }
            }

            await connection.commit();
            res.status(201).json({ message: "Thêm bài viết thành công!" });
        } catch (error) { 
            await connection.rollback();
            console.error("Lỗi create post:", error);
            res.status(500).json({ message: "Lỗi khi thêm bài viết" }); 
        } finally {
            connection.release();
        }
    },

    // 5. Cập nhật bài viết
    updatePost: async (req, res) => {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();
            const postId = req.params.id;
            const { title, danh_muc_id, category_id, status, excerpt, content, published_at, thumbnail, meta_title, meta_description, tags } = req.body;
            
            const finalCategoryId = category_id || danh_muc_id || null;

            // 5.1 Cập nhật thông tin bài viết
            await connection.execute(
                `UPDATE posts SET title=?, category_id=?, status=?, excerpt=?, content=?, published_at=?, thumbnail=?, meta_title=?, meta_description=? WHERE id=?`,
                [title, finalCategoryId, status, excerpt, content, published_at || null, thumbnail, meta_title, meta_description, postId]
            );

            // 5.2 Cập nhật Thẻ: Xóa sạch thẻ cũ của bài này đi, rồi add thẻ mới vào
            await connection.execute(`DELETE FROM post_tag WHERE post_id = ?`, [postId]);
            
            if (tags && tags.length > 0) {
                for(let tagId of tags) {
                     await connection.execute(`INSERT INTO post_tag (post_id, tag_id) VALUES (?, ?)`, [postId, tagId]);
                }
            }

            await connection.commit();
            res.json({ message: "Cập nhật thành công!" });
        } catch (error) { 
            await connection.rollback();
            console.error("Lỗi update post:", error);
            res.status(500).json({ message: "Lỗi cập nhật" }); 
        } finally {
            connection.release();
        }
    },

    // 6. Xóa mềm (Đưa vào thùng rác)
    softDeletePost: async (req, res) => {
        try {
            await db.execute(`UPDATE posts SET deleted_at = NOW() WHERE id = ?`, [req.params.id]);
            res.json({ message: "Đã chuyển vào thùng rác!" });
        } catch (error) { res.status(500).json({ message: "Lỗi xóa" }); }
    },

    // 7. Khôi phục
    restorePost: async (req, res) => {
        try {
            await db.execute(`UPDATE posts SET deleted_at = NULL WHERE id = ?`, [req.params.id]);
            res.json({ message: "Đã khôi phục bài viết!" });
        } catch (error) { res.status(500).json({ message: "Lỗi khôi phục" }); }
    },

    // 8. Xóa vĩnh viễn
    forceDeletePost: async (req, res) => {
        try {
            // Không cần xóa post_tag thủ công vì MySQL có cài ON DELETE CASCADE
            await db.execute(`DELETE FROM posts WHERE id = ?`, [req.params.id]);
            res.json({ message: "Đã xóa vĩnh viễn!" });
        } catch (error) { res.status(500).json({ message: "Lỗi xóa vĩnh viễn" }); }
    }
};

module.exports = adminPostController;
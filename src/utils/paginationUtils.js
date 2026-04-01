/**
 * Pagination Utilities
 * Hỗ trợ server-side pagination cho API
 */

/**
 * Tính toán LIMIT & OFFSET từ page và limit
 * @param {Number} page - Trang hiện tại (1-based)
 * @param {Number} limit - Số items per page
 * @returns {Object} {offset, limit}
 */
const calculatePagination = (page = 1, limit = 10) => {
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit) || 10)); // Max 100 items per page
    const offset = (pageNum - 1) * limitNum;

    return { 
        page: pageNum, 
        limit: limitNum, 
        offset 
    };
};

/**
 * Tạo metadata cho response
 * @param {Number} page - Trang hiện tại
 * @param {Number} limit - Số items per page
 * @param {Number} total - Tổng số items
 * @returns {Object} Pagination metadata
 */
const getPaginationMetadata = (page, limit, total) => {
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.max(1, parseInt(limit) || 10);
    const totalPages = Math.ceil(total / limitNum);

    return {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1
    };
};

/**
 * Middleware tự động parse pagination params
 */
const paginationMiddleware = (req, res, next) => {
    const pagination = calculatePagination(req.query.page, req.query.limit);
    req.pagination = pagination;
    next();
};

/**
 * Tạo response object chuẩn cho paginated data
 * @param {Array} data - Mảng dữ liệu
 * @param {Number} total - Tổng số items
 * @param {Object} pagination - Pagination info
 * @returns {Object} Response object
 */
const createPaginatedResponse = (data, total, pagination) => {
    return {
        success: true,
        data,
        pagination: getPaginationMetadata(pagination.page, pagination.limit, total)
    };
};

module.exports = {
    calculatePagination,
    getPaginationMetadata,
    paginationMiddleware,
    createPaginatedResponse
};

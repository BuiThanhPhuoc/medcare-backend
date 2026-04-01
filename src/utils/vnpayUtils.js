const crypto = require('crypto');

class VNPayUtil {
    constructor() {
        this.vnpayUrl = (process.env.VNPAY_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html').trim();
        this.tmnCode = (process.env.VNPAY_TMN_CODE || '').trim();
        this.secretKey = (process.env.VNPAY_SECRET_KEY || '').trim();
        this.returnUrl = (process.env.VNPAY_RETURN_URL || '').trim();

        // Hash algorithm có thể cấu hình qua env (mặc định SHA512)
        this.hashAlgorithm = (process.env.VNPAY_HASH_ALGORITHM || 'sha512').toLowerCase();

        console.log('=== VNPay Config ===');
        console.log('URL:', this.vnpayUrl);
        console.log('TMN Code:', this.tmnCode);
        console.log('Return URL:', this.returnUrl);
        console.log('Hash Algo:', this.hashAlgorithm);
        console.log('====================');
    }

    /**
     * Tạo URL thanh toán VNPay
     */
    buildPaymentUrl({ transactionRef, amount, orderInfo, ipAddress, locale = 'vn' }) {
        if (!this.tmnCode || !this.secretKey) {
            throw new Error('VNPay config thiếu TMN_CODE hoặc SECRET_KEY');
        }

        let vnp_Params = {
            vnp_Version: '2.1.0',
            vnp_Command: 'pay',
            vnp_TmnCode: this.tmnCode,
            vnp_Amount: Math.floor(amount * 100), // BẮT BUỘC x100
            vnp_CurrCode: 'VND',
            vnp_TxnRef: transactionRef,
            vnp_OrderInfo: this.normalizeText(orderInfo),
            vnp_OrderType: 'other',
            vnp_Locale: locale,
            vnp_ReturnUrl: this.returnUrl,
            vnp_IpAddr: ipAddress || '127.0.0.1',
            vnp_CreateDate: this.getCurrentDateTime()
        };

        // 1. Sort param
        vnp_Params = this.sortObject(vnp_Params);

        // 2. Tạo chuỗi hash (KHÔNG encode)
        const signData = this.buildHashData(vnp_Params);

        // 3. Tạo chữ ký
        const secureHash = this.createSignature(signData);

        // 4. Gắn chữ ký vào params
        vnp_Params['vnp_SecureHash'] = secureHash;
        // 5. Thêm kiểu chữ ký (nếu cần) để VNPay biết thuật toán dùng (không tham gia ký)
        vnp_Params['vnp_SecureHashType'] = this.hashAlgorithm.toUpperCase();

        // 6. Build query string (CÓ encode)
        const queryString = this.buildQueryString(vnp_Params);

        const paymentUrl = `${this.vnpayUrl}?${queryString}`;

        // DEBUG
        console.log('===== VNPAY DEBUG =====');
        console.log('SignData:', signData);
        console.log('SecureHash:', secureHash);
        console.log('PaymentURL:', paymentUrl);
        console.log('=======================');

        return paymentUrl;
    }

    /**
     * Verify chữ ký từ VNPay (IPN hoặc return)
     */
    verifyIpnSignature(vnp_Params) {
        const secureHash = vnp_Params['vnp_SecureHash'];

        let params = { ...vnp_Params };

        delete params['vnp_SecureHash'];
        delete params['vnp_SecureHashType'];

        // Sort
        params = this.sortObject(params);

        // Tạo lại hash data
        const signData = this.buildHashData(params);

        // Tạo chữ ký
        const checkSum = this.createSignature(signData);

        console.log('===== VERIFY SIGNATURE =====');
        console.log('Received:', secureHash);
        console.log('Generated:', checkSum);
        console.log('Match:', secureHash === checkSum);
        console.log('============================');

        return secureHash === checkSum;
    }

    /**
     * Tạo transaction ref
     */
    generateTransactionRef(prefix = 'TXN') {
        const time = Date.now();
        const random = Math.floor(Math.random() * 1000);
        return `${prefix}${time}${random}`;
    }

    /**
     * Format datetime chuẩn VNPay
     */
    getCurrentDateTime() {
        const date = new Date();
        return date
            .toISOString()
            .replace(/[-:TZ.]/g, '')
            .slice(0, 14);
    }

    /**
     * Sort object theo key a-z
     */
    sortObject(obj) {
        const sorted = {};
        Object.keys(obj)
            .sort()
            .forEach(key => {
                sorted[key] = obj[key];
            });
        return sorted;
    }

    // ✅ KHÔNG encode (dùng để ký)
    buildHashData(params) {
        return Object.keys(params)
            .map(key => `${key}=${params[key]}`)
            .join('&');
    }

    // ✅ encode (dùng cho URL)
    buildQueryString(params) {
        return Object.keys(params)
            .map(key => {
                let value = params[key];
                value = encodeURIComponent(value).replace(/%20/g, '+');
                return `${key}=${value}`;
            })
            .join('&');
    }

    /**
     * Tạo chữ ký SHA512
     */
    createSignature(data) {
        return crypto
            .createHmac('sha512', this.secretKey)
            .update(data, 'utf-8')
            .digest('hex')
            .toUpperCase();
    }

    /**
     * Loại bỏ dấu tiếng Việt để tránh lỗi hash
     */
    normalizeText(str = '') {
        return str
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/g, 'd')
            .replace(/Đ/g, 'D');
    }

    /**
     * Map trạng thái thanh toán
     */
    getPaymentStatus(code) {
        const map = {
            '00': { status: 'success', message: 'Thanh toán thành công' },
            '01': { status: 'failed', message: 'Giao dịch thất bại' },
            '02': { status: 'failed', message: 'Khách hàng hủy' },
            '07': { status: 'pending', message: 'Trừ tiền thành công nhưng lỗi' }
        };
        return map[code] || { status: 'unknown', message: 'Không xác định' };
    }
}

const vnpayUtils = new VNPayUtil();
module.exports = vnpayUtils;
require('dotenv').config({ path: './backend/.env' });
const vnpayUtils = require('./src/utils/vnpayUtils');

(async () => {
  try {
    const url = vnpayUtils.buildPaymentUrl({
      transactionRef: 'TEST12345',
      amount: 350000,
      orderInfo: 'Thanh toan test',
      ipAddress: '127.0.0.1'
    });
    console.log('Payment URL:', url);
  } catch (err) {
    console.error('Error:', err.message);
  }
})();
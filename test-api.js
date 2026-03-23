const jwt = require('jsonwebtoken');
const db = require('./src/config/db');
require('dotenv').config();

(async () => {
  try {
    // 1. Tạo admin token
    const adminToken = jwt.sign(
      { id: 5, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );
    console.log('Admin token:', adminToken);

    // 2. Test các API admin
    const axios = require('axios');
    const api = axios.create({
      baseURL: 'http://localhost:5000',
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });

    console.log('\n🔍 Testing /api/admin/doctors:');
    const doctorsRes = await api.get('/api/admin/doctors');
    console.log('✅ Doctors:', doctorsRes.data);

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    process.exit(1);
  }
})();

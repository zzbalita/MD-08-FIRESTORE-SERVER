// Test script để debug token
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Lấy token từ localStorage (copy từ browser console)
const testToken = "PASTE_YOUR_TOKEN_HERE";

console.log('🔍 Kiểm tra token...\n');

try {
    const decoded = jwt.verify(testToken, process.env.JWT_SECRET);
    console.log('✅ Token hợp lệ!');
    console.log('📋 Thông tin decoded:');
    console.log(JSON.stringify(decoded, null, 2));
    console.log('\n🔑 Role:', decoded.role);
    console.log('👤 UserID:', decoded.userId);

    if (decoded.role !== 'admin') {
        console.log('\n❌ LỖI: Role không phải "admin", là:', decoded.role);
    } else {
        console.log('\n✅ Role đúng là "admin"');
    }

    // Check expiry
    if (decoded.exp) {
        const expDate = new Date(decoded.exp * 1000);
        const now = new Date();
        console.log('\n⏰ Token hết hạn lúc:', expDate.toLocaleString('vi-VN'));
        console.log('⏰ Thời gian hiện tại:', now.toLocaleString('vi-VN'));

        if (now > expDate) {
            console.log('❌ Token đã hết hạn!');
        } else {
            console.log('✅ Token còn hạn');
        }
    }

} catch (err) {
    console.log('❌ Token không hợp lệ!');
    console.log('Lỗi:', err.message);
}

console.log('\n📝 Hướng dẫn:');
console.log('1. Mở browser console (F12)');
console.log('2. Chạy: localStorage.getItem("adminToken")');
console.log('3. Copy token và paste vào dòng 5 của file này');
console.log('4. Chạy: node test-token.js');

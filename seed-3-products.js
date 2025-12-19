require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./models/Product');

// Kết nối MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ Đã kết nối MongoDB'))
    .catch(err => {
        console.error('❌ Lỗi kết nối MongoDB:', err);
        process.exit(1);
    });

// 3 sản phẩm mới với ảnh URL
const newProducts = [
    {
        name: "Áo Polo Nam Premium",
        brand: "Lacoste",
        category: "Áo",
        price: 890000,
        import_price: 550000,
        description: [
            { field: "Chất liệu", value: "Cotton Pique cao cấp" },
            { field: "Xuất xứ", value: "Pháp" },
            { field: "Kiểu dáng", value: "Slim fit" },
            { field: "Đặc điểm", value: "Logo cá sấu thêu nổi" }
        ],
        variations: [
            { color: "Trắng", size: "M", quantity: 15 },
            { color: "Trắng", size: "L", quantity: 12 },
            { color: "Xanh Navy", size: "M", quantity: 10 },
            { color: "Xanh Navy", size: "L", quantity: 8 }
        ],
        image: "https://images.unsplash.com/photo-1586790170083-2f9ceadc732d?w=500",
        images: [
            "https://images.unsplash.com/photo-1586790170083-2f9ceadc732d?w=500",
            "https://images.unsplash.com/photo-1598032895397-b9c644f8d63a?w=500"
        ],
        status: "Đang bán",
        is_featured: true,
        sold: 67
    },
    {
        name: "Giày Sneaker Nữ Trắng",
        brand: "Adidas",
        category: "Giày",
        price: 1650000,
        import_price: 1050000,
        description: [
            { field: "Chất liệu", value: "Da tổng hợp + Mesh" },
            { field: "Đế", value: "Cao su non" },
            { field: "Công nghệ", value: "Cloudfoam" },
            { field: "Phong cách", value: "Casual, Sport" }
        ],
        variations: [
            { color: "Trắng", size: "36", quantity: 8 },
            { color: "Trắng", size: "37", quantity: 12 },
            { color: "Trắng", size: "38", quantity: 10 },
            { color: "Trắng", size: "39", quantity: 6 }
        ],
        image: "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=500",
        images: [
            "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=500",
            "https://images.unsplash.com/photo-1460353581641-37baddab0fa2?w=500"
        ],
        status: "Đang bán",
        is_featured: true,
        sold: 89
    },
    {
        name: "Túi Xách Tote Canvas",
        brand: "Herschel",
        category: "Phụ kiện",
        price: 650000,
        import_price: 380000,
        description: [
            { field: "Chất liệu", value: "Canvas dày dặn" },
            { field: "Kích thước", value: "40x35x12 cm" },
            { field: "Đặc điểm", value: "Nhiều ngăn, dây đeo chắc chắn" },
            { field: "Phù hợp", value: "Đi học, đi làm, du lịch" }
        ],
        variations: [
            { color: "Be", size: "OneSize", quantity: 20 },
            { color: "Đen", size: "OneSize", quantity: 18 },
            { color: "Xám", size: "OneSize", quantity: 15 }
        ],
        image: "https://images.unsplash.com/photo-1591561954557-26941169b49e?w=500",
        images: [
            "https://images.unsplash.com/photo-1591561954557-26941169b49e?w=500",
            "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=500"
        ],
        status: "Đang bán",
        is_featured: false,
        sold: 45
    }
];

// Hàm tính tổng quantity từ variations
function calculateTotalQuantity(variations) {
    return variations.reduce((sum, v) => sum + v.quantity, 0);
}

// Thêm sản phẩm vào database
async function seedNewProducts() {
    try {
        console.log('🌱 Bắt đầu thêm 3 sản phẩm mới...\n');

        // Tính toán quantity cho mỗi sản phẩm
        const productsWithQuantity = newProducts.map(product => ({
            ...product,
            quantity: calculateTotalQuantity(product.variations)
        }));

        // Thêm từng sản phẩm
        for (let i = 0; i < productsWithQuantity.length; i++) {
            const product = productsWithQuantity[i];
            const created = await Product.create(product);
            console.log(`✅ [${i + 1}/3] ${created.name}`);
            console.log(`   📦 Tồn kho: ${created.quantity} | 💰 Giá: ${created.price.toLocaleString()}₫ | 📊 Đã bán: ${created.sold}`);
            console.log(`   🖼️  Ảnh: ${created.image.substring(0, 50)}...`);
            console.log('');
        }

        console.log('🎉 Hoàn thành! Đã thêm 3 sản phẩm mới.\n');

        // Hiển thị thống kê
        const totalProducts = await Product.countDocuments();
        const dangBan = await Product.countDocuments({ status: "Đang bán" });
        const hetHang = await Product.countDocuments({ status: "Hết hàng" });
        const ngungBan = await Product.countDocuments({ status: "Ngừng bán" });

        console.log('📊 Thống kê database:');
        console.log(`   Tổng sản phẩm: ${totalProducts}`);
        console.log(`   ✅ Đang bán: ${dangBan}`);
        console.log(`   🔴 Hết hàng: ${hetHang}`);
        console.log(`   ⚪ Ngừng bán: ${ngungBan}`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Lỗi khi thêm sản phẩm:', error);
        process.exit(1);
    }
}

// Chạy script
seedNewProducts();

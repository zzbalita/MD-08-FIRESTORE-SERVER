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

// 15 sản phẩm mẫu
const sampleProducts = [
    {
        name: "Áo Thun Nam Basic",
        brand: "Nike",
        category: "Áo",
        price: 350000,
        import_price: 200000,
        description: [
            { field: "Chất liệu", value: "Cotton 100%" },
            { field: "Xuất xứ", value: "Việt Nam" },
            { field: "Kiểu dáng", value: "Regular fit" },
            { field: "Hướng dẫn bảo quản", value: "Giặt máy ở nhiệt độ thường" }
        ],
        variations: [
            { color: "Đen", size: "M", quantity: 20 },
            { color: "Đen", size: "L", quantity: 15 },
            { color: "Trắng", size: "M", quantity: 18 },
            { color: "Trắng", size: "L", quantity: 12 },
            { color: "Xám", size: "M", quantity: 10 },
            { color: "Xám", size: "L", quantity: 8 }
        ],
        image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500",
        images: [
            "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500",
            "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=500"
        ],
        status: "Đang bán",
        is_featured: true
    },
    {
        name: "Quần Jeans Slim Fit",
        brand: "Levi's",
        category: "Quần",
        price: 890000,
        import_price: 500000,
        description: [
            { field: "Chất liệu", value: "Denim cao cấp" },
            { field: "Xuất xứ", value: "USA" },
            { field: "Kiểu dáng", value: "Slim fit" },
            { field: "Màu sắc", value: "Xanh đậm" }
        ],
        variations: [
            { color: "Xanh đậm", size: "30", quantity: 15 },
            { color: "Xanh đậm", size: "32", quantity: 20 },
            { color: "Xanh đậm", size: "34", quantity: 12 },
            { color: "Đen", size: "30", quantity: 10 },
            { color: "Đen", size: "32", quantity: 15 },
            { color: "Đen", size: "34", quantity: 8 }
        ],
        image: "https://images.unsplash.com/photo-1542272604-787c3835535d?w=500",
        images: [
            "https://images.unsplash.com/photo-1542272604-787c3835535d?w=500",
            "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=500"
        ],
        status: "Đang bán",
        is_featured: true
    },
    {
        name: "Giày Sneaker Air Max",
        brand: "Nike",
        category: "Giày",
        price: 2500000,
        import_price: 1500000,
        description: [
            { field: "Chất liệu", value: "Da tổng hợp + Mesh" },
            { field: "Xuất xứ", value: "Vietnam" },
            { field: "Công nghệ", value: "Air Max cushioning" },
            { field: "Phù hợp", value: "Chạy bộ, thể thao" }
        ],
        variations: [
            { color: "Trắng", size: "40", quantity: 10 },
            { color: "Trắng", size: "41", quantity: 12 },
            { color: "Trắng", size: "42", quantity: 15 },
            { color: "Đen", size: "40", quantity: 8 },
            { color: "Đen", size: "41", quantity: 10 },
            { color: "Đen", size: "42", quantity: 12 }
        ],
        image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500",
        images: [
            "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500",
            "https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=500"
        ],
        status: "Đang bán",
        is_featured: true
    },
    {
        name: "Áo Khoác Hoodie",
        brand: "Adidas",
        category: "Áo",
        price: 750000,
        import_price: 450000,
        description: [
            { field: "Chất liệu", value: "Cotton blend" },
            { field: "Xuất xứ", value: "China" },
            { field: "Kiểu dáng", value: "Oversized" },
            { field: "Đặc điểm", value: "Có mũ trùm, túi kangaroo" }
        ],
        variations: [
            { color: "Đen", size: "M", quantity: 15 },
            { color: "Đen", size: "L", quantity: 20 },
            { color: "Đen", size: "XL", quantity: 10 },
            { color: "Xám", size: "M", quantity: 12 },
            { color: "Xám", size: "L", quantity: 18 },
            { color: "Xám", size: "XL", quantity: 8 }
        ],
        image: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=500",
        images: [
            "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=500",
            "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=500"
        ],
        status: "Đang bán",
        is_featured: false
    },
    {
        name: "Quần Short Thể Thao",
        brand: "Puma",
        category: "Quần",
        price: 420000,
        import_price: 250000,
        description: [
            { field: "Chất liệu", value: "Polyester" },
            { field: "Xuất xứ", value: "Vietnam" },
            { field: "Công nghệ", value: "DryCELL - thấm hút mồ hôi" },
            { field: "Phù hợp", value: "Tập gym, chạy bộ" }
        ],
        variations: [
            { color: "Đen", size: "M", quantity: 25 },
            { color: "Đen", size: "L", quantity: 30 },
            { color: "Xanh navy", size: "M", quantity: 20 },
            { color: "Xanh navy", size: "L", quantity: 22 }
        ],
        image: "https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=500",
        images: [
            "https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=500"
        ],
        status: "Đang bán",
        is_featured: false
    },
    {
        name: "Áo Sơ Mi Trắng",
        brand: "Zara",
        category: "Áo",
        price: 650000,
        import_price: 380000,
        description: [
            { field: "Chất liệu", value: "Cotton pha" },
            { field: "Xuất xứ", value: "Spain" },
            { field: "Kiểu dáng", value: "Slim fit" },
            { field: "Phù hợp", value: "Công sở, dự tiệc" }
        ],
        variations: [
            { color: "Trắng", size: "M", quantity: 18 },
            { color: "Trắng", size: "L", quantity: 15 },
            { color: "Trắng", size: "XL", quantity: 10 },
            { color: "Xanh nhạt", size: "M", quantity: 12 },
            { color: "Xanh nhạt", size: "L", quantity: 10 }
        ],
        image: "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=500",
        images: [
            "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=500"
        ],
        status: "Đang bán",
        is_featured: false
    },
    {
        name: "Giày Lười Da",
        brand: "Clarks",
        category: "Giày",
        price: 1800000,
        import_price: 1100000,
        description: [
            { field: "Chất liệu", value: "Da bò thật 100%" },
            { field: "Xuất xứ", value: "UK" },
            { field: "Đế giày", value: "Cao su tự nhiên" },
            { field: "Phù hợp", value: "Công sở, dạo phố" }
        ],
        variations: [
            { color: "Nâu", size: "40", quantity: 8 },
            { color: "Nâu", size: "41", quantity: 10 },
            { color: "Nâu", size: "42", quantity: 12 },
            { color: "Đen", size: "40", quantity: 7 },
            { color: "Đen", size: "41", quantity: 9 },
            { color: "Đen", size: "42", quantity: 10 }
        ],
        image: "https://images.unsplash.com/photo-1533867617858-e7b97e060509?w=500",
        images: [
            "https://images.unsplash.com/photo-1533867617858-e7b97e060509?w=500"
        ],
        status: "Đang bán",
        is_featured: false
    },
    {
        name: "Túi Xách Tote",
        brand: "Coach",
        category: "Phụ kiện",
        price: 3500000,
        import_price: 2200000,
        description: [
            { field: "Chất liệu", value: "Da thật cao cấp" },
            { field: "Xuất xứ", value: "USA" },
            { field: "Kích thước", value: "35x28x12 cm" },
            { field: "Đặc điểm", value: "Nhiều ngăn, dây đeo vai" }
        ],
        variations: [
            { color: "Đen", size: "OneSize", quantity: 10 },
            { color: "Nâu", size: "OneSize", quantity: 8 },
            { color: "Đỏ", size: "OneSize", quantity: 5 }
        ],
        image: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=500",
        images: [
            "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=500",
            "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=500"
        ],
        status: "Đang bán",
        is_featured: true
    },
    {
        name: "Mũ Lưỡi Trai",
        brand: "New Era",
        category: "Phụ kiện",
        price: 450000,
        import_price: 280000,
        description: [
            { field: "Chất liệu", value: "Cotton twill" },
            { field: "Xuất xứ", value: "USA" },
            { field: "Kiểu dáng", value: "Snapback" },
            { field: "Đặc điểm", value: "Có thể điều chỉnh size" }
        ],
        variations: [
            { color: "Đen", size: "OneSize", quantity: 30 },
            { color: "Xanh navy", size: "OneSize", quantity: 25 },
            { color: "Đỏ", size: "OneSize", quantity: 20 }
        ],
        image: "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=500",
        images: [
            "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=500"
        ],
        status: "Đang bán",
        is_featured: false
    },
    {
        name: "Áo Polo Nam",
        brand: "Lacoste",
        category: "Áo",
        price: 1200000,
        import_price: 750000,
        description: [
            { field: "Chất liệu", value: "Cotton piqué" },
            { field: "Xuất xứ", value: "France" },
            { field: "Kiểu dáng", value: "Classic fit" },
            { field: "Đặc điểm", value: "Logo cá sấu thêu" }
        ],
        variations: [
            { color: "Trắng", size: "M", quantity: 15 },
            { color: "Trắng", size: "L", quantity: 18 },
            { color: "Xanh navy", size: "M", quantity: 12 },
            { color: "Xanh navy", size: "L", quantity: 15 },
            { color: "Đỏ", size: "M", quantity: 10 },
            { color: "Đỏ", size: "L", quantity: 12 }
        ],
        image: "https://images.unsplash.com/photo-1586790170083-2f9ceadc732d?w=500",
        images: [
            "https://images.unsplash.com/photo-1586790170083-2f9ceadc732d?w=500"
        ],
        status: "Đang bán",
        is_featured: true
    },
    {
        name: "Quần Kaki Slim",
        brand: "Uniqlo",
        category: "Quần",
        price: 590000,
        import_price: 350000,
        description: [
            { field: "Chất liệu", value: "Cotton kaki" },
            { field: "Xuất xứ", value: "Japan" },
            { field: "Kiểu dáng", value: "Slim fit" },
            { field: "Đặc điểm", value: "Co giãn nhẹ, thoáng mát" }
        ],
        variations: [
            { color: "Be", size: "30", quantity: 20 },
            { color: "Be", size: "32", quantity: 25 },
            { color: "Be", size: "34", quantity: 15 },
            { color: "Xanh navy", size: "30", quantity: 18 },
            { color: "Xanh navy", size: "32", quantity: 22 },
            { color: "Xanh navy", size: "34", quantity: 12 }
        ],
        image: "https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=500",
        images: [
            "https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=500"
        ],
        status: "Đang bán",
        is_featured: false
    },
    {
        name: "Giày Chạy Bộ",
        brand: "Asics",
        category: "Giày",
        price: 2200000,
        import_price: 1400000,
        description: [
            { field: "Chất liệu", value: "Mesh thoáng khí" },
            { field: "Xuất xứ", value: "Japan" },
            { field: "Công nghệ", value: "GEL cushioning" },
            { field: "Phù hợp", value: "Chạy bộ đường dài" }
        ],
        variations: [
            { color: "Xanh dương", size: "40", quantity: 12 },
            { color: "Xanh dương", size: "41", quantity: 15 },
            { color: "Xanh dương", size: "42", quantity: 18 },
            { color: "Đen", size: "40", quantity: 10 },
            { color: "Đen", size: "41", quantity: 12 },
            { color: "Đen", size: "42", quantity: 15 }
        ],
        image: "https://images.unsplash.com/photo-1539185441755-769473a23570?w=500",
        images: [
            "https://images.unsplash.com/photo-1539185441755-769473a23570?w=500",
            "https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=500"
        ],
        status: "Đang bán",
        is_featured: false
    },
    {
        name: "Áo Len Cổ Tròn",
        brand: "H&M",
        category: "Áo",
        price: 550000,
        import_price: 320000,
        description: [
            { field: "Chất liệu", value: "Len pha cotton" },
            { field: "Xuất xứ", value: "Sweden" },
            { field: "Kiểu dáng", value: "Regular fit" },
            { field: "Phù hợp", value: "Mùa thu đông" }
        ],
        variations: [
            { color: "Xám", size: "M", quantity: 20 },
            { color: "Xám", size: "L", quantity: 18 },
            { color: "Đen", size: "M", quantity: 15 },
            { color: "Đen", size: "L", quantity: 12 },
            { color: "Nâu", size: "M", quantity: 10 },
            { color: "Nâu", size: "L", quantity: 8 }
        ],
        image: "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=500",
        images: [
            "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=500"
        ],
        status: "Đang bán",
        is_featured: false
    },
    {
        name: "Quần Jogger",
        brand: "Champion",
        category: "Quần",
        price: 680000,
        import_price: 400000,
        description: [
            { field: "Chất liệu", value: "Cotton blend" },
            { field: "Xuất xứ", value: "USA" },
            { field: "Kiểu dáng", value: "Tapered fit" },
            { field: "Đặc điểm", value: "Co giãn, bo gấu" }
        ],
        variations: [
            { color: "Đen", size: "M", quantity: 25 },
            { color: "Đen", size: "L", quantity: 30 },
            { color: "Đen", size: "XL", quantity: 20 },
            { color: "Xám", size: "M", quantity: 22 },
            { color: "Xám", size: "L", quantity: 28 },
            { color: "Xám", size: "XL", quantity: 18 }
        ],
        image: "https://images.unsplash.com/photo-1555689502-c4b22d76c56f?w=500",
        images: [
            "https://images.unsplash.com/photo-1555689502-c4b22d76c56f?w=500"
        ],
        status: "Đang bán",
        is_featured: false
    },
    {
        name: "Balo Laptop",
        brand: "The North Face",
        category: "Phụ kiện",
        price: 1500000,
        import_price: 950000,
        description: [
            { field: "Chất liệu", value: "Polyester chống nước" },
            { field: "Xuất xứ", value: "USA" },
            { field: "Dung tích", value: "28L" },
            { field: "Đặc điểm", value: "Ngăn laptop 15.6 inch, nhiều ngăn phụ" }
        ],
        variations: [
            { color: "Đen", size: "OneSize", quantity: 15 },
            { color: "Xanh navy", size: "OneSize", quantity: 12 },
            { color: "Xám", size: "OneSize", quantity: 10 }
        ],
        image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500",
        images: [
            "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500",
            "https://images.unsplash.com/photo-1622560480605-d83c853bc5c3?w=500"
        ],
        status: "Đang bán",
        is_featured: true
    }
];

// Hàm tính tổng quantity từ variations
function calculateTotalQuantity(variations) {
    return variations.reduce((sum, v) => sum + v.quantity, 0);
}

// Thêm sản phẩm vào database
async function seedProducts() {
    try {
        console.log('🌱 Bắt đầu thêm sản phẩm mẫu...\n');

        // Tính toán quantity cho mỗi sản phẩm
        const productsWithQuantity = sampleProducts.map(product => ({
            ...product,
            quantity: calculateTotalQuantity(product.variations)
        }));

        // Xóa tất cả sản phẩm cũ (tùy chọn - bỏ comment nếu muốn reset)
        // await Product.deleteMany({});
        // console.log('🗑️  Đã xóa tất cả sản phẩm cũ\n');

        // Thêm từng sản phẩm
        for (let i = 0; i < productsWithQuantity.length; i++) {
            const product = productsWithQuantity[i];
            const created = await Product.create(product);
            console.log(`✅ [${i + 1}/15] Đã thêm: ${created.name} (${created.brand}) - Tồn kho: ${created.quantity}`);
        }

        console.log('\n🎉 Hoàn thành! Đã thêm 15 sản phẩm mẫu vào database.');

        // Hiển thị thống kê
        const totalProducts = await Product.countDocuments();
        console.log(`📊 Tổng số sản phẩm trong database: ${totalProducts}`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Lỗi khi thêm sản phẩm:', error);
        process.exit(1);
    }
}

// Chạy script
seedProducts();

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

// 20 sản phẩm mẫu với trạng thái đa dạng
const sampleProducts = [
    {
        name: "Áo Thun Oversize Unisex",
        brand: "Local Brand",
        category: "Áo",
        price: 250000,
        import_price: 150000,
        description: [
            { field: "Chất liệu", value: "Cotton 100%" },
            { field: "Xuất xứ", value: "Việt Nam" },
            { field: "Form", value: "Oversize" }
        ],
        variations: [
            { color: "Đen", size: "M", quantity: 5 },
            { color: "Đen", size: "L", quantity: 3 },
            { color: "Trắng", size: "M", quantity: 2 }
        ],
        image: "https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=500",
        images: ["https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=500"],
        status: "Đang bán",
        is_featured: false,
        sold: 45
    },
    {
        name: "Quần Jean Baggy Nữ",
        brand: "Zara",
        category: "Quần",
        price: 750000,
        import_price: 450000,
        description: [
            { field: "Chất liệu", value: "Denim" },
            { field: "Kiểu dáng", value: "Baggy" }
        ],
        variations: [
            { color: "Xanh nhạt", size: "S", quantity: 0 },
            { color: "Xanh nhạt", size: "M", quantity: 0 }
        ],
        image: "https://images.unsplash.com/photo-1582418702059-97ebafb35d09?w=500",
        images: ["https://images.unsplash.com/photo-1582418702059-97ebafb35d09?w=500"],
        status: "Hết hàng",
        is_featured: false,
        sold: 120
    },
    {
        name: "Giày Thể Thao Running",
        brand: "New Balance",
        category: "Giày",
        price: 1900000,
        import_price: 1200000,
        description: [
            { field: "Chất liệu", value: "Mesh + Foam" },
            { field: "Công nghệ", value: "Fresh Foam" }
        ],
        variations: [
            { color: "Xám", size: "40", quantity: 15 },
            { color: "Xám", size: "41", quantity: 12 },
            { color: "Đen", size: "40", quantity: 8 }
        ],
        image: "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=500",
        images: ["https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=500"],
        status: "Đang bán",
        is_featured: true,
        sold: 78
    },
    {
        name: "Áo Khoác Dù 2 Lớp",
        brand: "The North Face",
        category: "Áo",
        price: 1200000,
        import_price: 750000,
        description: [
            { field: "Chất liệu", value: "Polyester chống nước" },
            { field: "Đặc điểm", value: "2 lớp, có mũ" }
        ],
        variations: [
            { color: "Đen", size: "L", quantity: 25 },
            { color: "Đen", size: "XL", quantity: 20 },
            { color: "Navy", size: "L", quantity: 18 }
        ],
        image: "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=500",
        images: ["https://images.unsplash.com/photo-1551028719-00167b16eac5?w=500"],
        status: "Đang bán",
        is_featured: true,
        sold: 92
    },
    {
        name: "Quần Short Kaki Nam",
        brand: "Uniqlo",
        category: "Quần",
        price: 390000,
        import_price: 220000,
        description: [
            { field: "Chất liệu", value: "Kaki cotton" },
            { field: "Kiểu dáng", value: "Slim fit" }
        ],
        variations: [
            { color: "Be", size: "30", quantity: 0 },
            { color: "Be", size: "32", quantity: 0 }
        ],
        image: "https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=500",
        images: ["https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=500"],
        status: "Ngừng bán",
        is_featured: false,
        sold: 156
    },
    {
        name: "Túi Đeo Chéo Mini",
        brand: "Charles & Keith",
        category: "Phụ kiện",
        price: 890000,
        import_price: 550000,
        description: [
            { field: "Chất liệu", value: "Da PU" },
            { field: "Kích thước", value: "18x12x6 cm" }
        ],
        variations: [
            { color: "Đen", size: "OneSize", quantity: 8 },
            { color: "Nâu", size: "OneSize", quantity: 5 }
        ],
        image: "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=500",
        images: ["https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=500"],
        status: "Đang bán",
        is_featured: false,
        sold: 34
    },
    {
        name: "Áo Sơ Mi Linen",
        brand: "Mango",
        category: "Áo",
        price: 650000,
        import_price: 380000,
        description: [
            { field: "Chất liệu", value: "Linen 100%" },
            { field: "Kiểu dáng", value: "Regular fit" }
        ],
        variations: [
            { color: "Trắng", size: "M", quantity: 3 },
            { color: "Trắng", size: "L", quantity: 2 }
        ],
        image: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=500",
        images: ["https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=500"],
        status: "Đang bán",
        is_featured: false,
        sold: 67
    },
    {
        name: "Giày Sandal Nữ",
        brand: "Birkenstock",
        category: "Giày",
        price: 1500000,
        import_price: 950000,
        description: [
            { field: "Chất liệu", value: "Da thật + Cork" },
            { field: "Đế", value: "EVA" }
        ],
        variations: [
            { color: "Nâu", size: "37", quantity: 0 },
            { color: "Nâu", size: "38", quantity: 0 }
        ],
        image: "https://images.unsplash.com/photo-1603487742131-4160ec999306?w=500",
        images: ["https://images.unsplash.com/photo-1603487742131-4160ec999306?w=500"],
        status: "Hết hàng",
        is_featured: false,
        sold: 89
    },
    {
        name: "Quần Jogger Nỉ",
        brand: "Nike",
        category: "Quần",
        price: 890000,
        import_price: 520000,
        description: [
            { field: "Chất liệu", value: "Cotton blend nỉ" },
            { field: "Công nghệ", value: "Dri-FIT" }
        ],
        variations: [
            { color: "Xám", size: "M", quantity: 30 },
            { color: "Xám", size: "L", quantity: 25 },
            { color: "Đen", size: "M", quantity: 28 }
        ],
        image: "https://images.unsplash.com/photo-1555689502-c4b22d76c56f?w=500",
        images: ["https://images.unsplash.com/photo-1555689502-c4b22d76c56f?w=500"],
        status: "Đang bán",
        is_featured: true,
        sold: 145
    },
    {
        name: "Mũ Bucket Hat",
        brand: "Stussy",
        category: "Phụ kiện",
        price: 350000,
        import_price: 200000,
        description: [
            { field: "Chất liệu", value: "Canvas" },
            { field: "Size", value: "Free size" }
        ],
        variations: [
            { color: "Đen", size: "OneSize", quantity: 15 },
            { color: "Be", size: "OneSize", quantity: 12 }
        ],
        image: "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=500",
        images: ["https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=500"],
        status: "Đang bán",
        is_featured: false,
        sold: 56
    },
    {
        name: "Áo Hoodie Basic",
        brand: "H&M",
        category: "Áo",
        price: 550000,
        import_price: 320000,
        description: [
            { field: "Chất liệu", value: "Cotton blend" },
            { field: "Kiểu dáng", value: "Regular fit" }
        ],
        variations: [
            { color: "Xám", size: "M", quantity: 0 },
            { color: "Xám", size: "L", quantity: 0 }
        ],
        image: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=500",
        images: ["https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=500"],
        status: "Ngừng bán",
        is_featured: false,
        sold: 203
    },
    {
        name: "Giày Boot Chelsea",
        brand: "Dr. Martens",
        category: "Giày",
        price: 3200000,
        import_price: 2000000,
        description: [
            { field: "Chất liệu", value: "Da bò thật" },
            { field: "Đế", value: "AirWair" }
        ],
        variations: [
            { color: "Đen", size: "40", quantity: 6 },
            { color: "Đen", size: "41", quantity: 4 },
            { color: "Nâu", size: "40", quantity: 3 }
        ],
        image: "https://images.unsplash.com/photo-1608256246200-53e635b5b65f?w=500",
        images: ["https://images.unsplash.com/photo-1608256246200-53e635b5b65f?w=500"],
        status: "Đang bán",
        is_featured: true,
        sold: 23
    },
    {
        name: "Quần Tây Công Sở",
        brand: "Zara",
        category: "Quần",
        price: 790000,
        import_price: 460000,
        description: [
            { field: "Chất liệu", value: "Polyester pha" },
            { field: "Kiểu dáng", value: "Slim fit" }
        ],
        variations: [
            { color: "Đen", size: "29", quantity: 12 },
            { color: "Đen", size: "30", quantity: 15 },
            { color: "Xám", size: "29", quantity: 10 }
        ],
        image: "https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=500",
        images: ["https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=500"],
        status: "Đang bán",
        is_featured: false,
        sold: 87
    },
    {
        name: "Áo Tanktop Gym",
        brand: "Gymshark",
        category: "Áo",
        price: 420000,
        import_price: 250000,
        description: [
            { field: "Chất liệu", value: "Polyester + Spandex" },
            { field: "Công nghệ", value: "Quick dry" }
        ],
        variations: [
            { color: "Đen", size: "M", quantity: 0 },
            { color: "Đen", size: "L", quantity: 0 }
        ],
        image: "https://images.unsplash.com/photo-1571731956672-f2b94d7dd0cb?w=500",
        images: ["https://images.unsplash.com/photo-1571731956672-f2b94d7dd0cb?w=500"],
        status: "Hết hàng",
        is_featured: false,
        sold: 178
    },
    {
        name: "Kính Mát Aviator",
        brand: "Ray-Ban",
        category: "Phụ kiện",
        price: 2800000,
        import_price: 1800000,
        description: [
            { field: "Chất liệu", value: "Kim loại + Kính UV400" },
            { field: "Kiểu dáng", value: "Aviator classic" }
        ],
        variations: [
            { color: "Vàng", size: "OneSize", quantity: 8 },
            { color: "Đen", size: "OneSize", quantity: 6 }
        ],
        image: "https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=500",
        images: ["https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=500"],
        status: "Đang bán",
        is_featured: true,
        sold: 41
    },
    {
        name: "Áo Cardigan Len",
        brand: "Uniqlo",
        category: "Áo",
        price: 690000,
        import_price: 410000,
        description: [
            { field: "Chất liệu", value: "Len pha cotton" },
            { field: "Kiểu dáng", value: "Regular fit" }
        ],
        variations: [
            { color: "Be", size: "M", quantity: 18 },
            { color: "Be", size: "L", quantity: 15 },
            { color: "Xám", size: "M", quantity: 12 }
        ],
        image: "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=500",
        images: ["https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=500"],
        status: "Đang bán",
        is_featured: false,
        sold: 63
    },
    {
        name: "Giày Slip-On Vans",
        brand: "Vans",
        category: "Giày",
        price: 1200000,
        import_price: 750000,
        description: [
            { field: "Chất liệu", value: "Canvas" },
            { field: "Đế", value: "Cao su vulcanized" }
        ],
        variations: [
            { color: "Đen", size: "40", quantity: 0 },
            { color: "Đen", size: "41", quantity: 0 }
        ],
        image: "https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?w=500",
        images: ["https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?w=500"],
        status: "Ngừng bán",
        is_featured: false,
        sold: 234
    },
    {
        name: "Quần Legging Yoga",
        brand: "Lululemon",
        category: "Quần",
        price: 1500000,
        import_price: 950000,
        description: [
            { field: "Chất liệu", value: "Nylon + Lycra" },
            { field: "Công nghệ", value: "4-way stretch" }
        ],
        variations: [
            { color: "Đen", size: "S", quantity: 22 },
            { color: "Đen", size: "M", quantity: 25 },
            { color: "Xám", size: "S", quantity: 18 }
        ],
        image: "https://images.unsplash.com/photo-1506629082955-511b1aa562c8?w=500",
        images: ["https://images.unsplash.com/photo-1506629082955-511b1aa562c8?w=500"],
        status: "Đang bán",
        is_featured: true,
        sold: 112
    },
    {
        name: "Thắt Lưng Da Nam",
        brand: "Gucci",
        category: "Phụ kiện",
        price: 4500000,
        import_price: 2800000,
        description: [
            { field: "Chất liệu", value: "Da bò thật 100%" },
            { field: "Khóa", value: "Kim loại mạ vàng" }
        ],
        variations: [
            { color: "Đen", size: "OneSize", quantity: 5 },
            { color: "Nâu", size: "OneSize", quantity: 3 }
        ],
        image: "https://images.unsplash.com/photo-1624222247344-550fb60583c2?w=500",
        images: ["https://images.unsplash.com/photo-1624222247344-550fb60583c2?w=500"],
        status: "Đang bán",
        is_featured: false,
        sold: 19
    },
    {
        name: "Áo Blazer Nữ",
        brand: "Mango",
        category: "Áo",
        price: 1200000,
        import_price: 720000,
        description: [
            { field: "Chất liệu", value: "Polyester cao cấp" },
            { field: "Kiểu dáng", value: "Fitted" }
        ],
        variations: [
            { color: "Đen", size: "S", quantity: 0 },
            { color: "Đen", size: "M", quantity: 0 }
        ],
        image: "https://images.unsplash.com/photo-1591369822096-ffd140ec948f?w=500",
        images: ["https://images.unsplash.com/photo-1591369822096-ffd140ec948f?w=500"],
        status: "Hết hàng",
        is_featured: false,
        sold: 95
    }
];

// Hàm tính tổng quantity từ variations
function calculateTotalQuantity(variations) {
    return variations.reduce((sum, v) => sum + v.quantity, 0);
}

// Thêm sản phẩm vào database
async function seedProducts() {
    try {
        console.log('🌱 Bắt đầu thêm 20 sản phẩm mẫu...\n');

        // Tính toán quantity cho mỗi sản phẩm
        const productsWithQuantity = sampleProducts.map(product => ({
            ...product,
            quantity: calculateTotalQuantity(product.variations)
        }));

        // Thêm từng sản phẩm
        for (let i = 0; i < productsWithQuantity.length; i++) {
            const product = productsWithQuantity[i];
            const created = await Product.create(product);
            console.log(`✅ [${i + 1}/20] ${created.name} - ${created.status} - Tồn: ${created.quantity} - Đã bán: ${created.sold}`);
        }

        console.log('\n🎉 Hoàn thành! Đã thêm 20 sản phẩm mẫu.');

        // Hiển thị thống kê
        const totalProducts = await Product.countDocuments();
        const dangBan = await Product.countDocuments({ status: "Đang bán" });
        const hetHang = await Product.countDocuments({ status: "Hết hàng" });
        const ngungBan = await Product.countDocuments({ status: "Ngừng bán" });

        console.log('\n📊 Thống kê database:');
        console.log(`   Tổng sản phẩm: ${totalProducts}`);
        console.log(`   Đang bán: ${dangBan}`);
        console.log(`   Hết hàng: ${hetHang}`);
        console.log(`   Ngừng bán: ${ngungBan}`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Lỗi khi thêm sản phẩm:', error);
        process.exit(1);
    }
}

// Chạy script
seedProducts();

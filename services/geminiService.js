const { GoogleGenerativeAI } = require('@google/generative-ai');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Origin = require('../models/Origin');
const Order = require('../models/Order');

/**
 * Gemini Service - Handles AI-powered bot responses with feature detection
 */
class GeminiService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.model = null;
    this.genAI = null;
    
    if (this.apiKey && this.apiKey !== 'your_gemini_api_key_here') {
      try {
        this.genAI = new GoogleGenerativeAI(this.apiKey);
        // Use gemini-2.0-flash (stable, fast, widely available)
        this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        console.log('✅ Gemini AI service initialized with model: gemini-2.0-flash');
      } catch (error) {
        console.error('❌ Failed to initialize Gemini AI:', error.message);
        this.model = null;
      }
    } else {
      console.warn('⚠️ GEMINI_API_KEY not found or is placeholder. Bot will use keyword-based responses.');
    }
  }

  /**
   * Detect features from user message using Gemini AI
   * @param {string} userMessage - The user's message
   * @returns {Promise<Object>} Detected features
   */
  async detectFeatures(userMessage) {
    // If Gemini is not available, fallback to keyword-based detection
    if (!this.model) {
      return this.detectFeaturesKeywordBased(userMessage);
    }

    try {
      // List of available features
      const availableFeatures = {
        products: 'Sản phẩm - câu hỏi về sản phẩm, tìm kiếm sản phẩm, danh sách sản phẩm, giá sản phẩm',
        orders: 'Đơn hàng - câu hỏi về đơn hàng, tra cứu đơn hàng, trạng thái đơn hàng',
        categories: 'Danh mục - câu hỏi về danh mục sản phẩm, phân loại',
        brands: 'Thương hiệu - câu hỏi về thương hiệu, nhãn hiệu',
        pricing: 'Giá cả - câu hỏi về giá, giá rẻ, giá đắt, so sánh giá',
        shipping: 'Vận chuyển - câu hỏi về giao hàng, thời gian giao, phí ship',
        payment: 'Thanh toán - câu hỏi về phương thức thanh toán, COD, VNPay',
        return_policy: 'Đổi trả - câu hỏi về chính sách đổi trả, hoàn tiền'
      };

      const detectionPrompt = `Bạn là hệ thống phân loại câu hỏi. Phân tích câu hỏi của khách hàng và xác định các tính năng (features) liên quan.

Các tính năng có sẵn:
${Object.entries(availableFeatures).map(([key, desc]) => `- ${key}: ${desc}`).join('\n')}

Câu hỏi của khách hàng: "${userMessage}"

Hãy trả lời CHỈ bằng JSON với format sau:
{
  "products": true/false,
  "orders": true/false,
  "categories": true/false,
  "brands": true/false,
  "pricing": true/false,
  "shipping": true/false,
  "payment": true/false,
  "return_policy": true/false
}

Chỉ đánh dấu true cho các tính năng thực sự liên quan đến câu hỏi. Ví dụ:
- "sản phẩm rẻ nhất" → {"products": true, "pricing": true, ...others: false}
- "đơn hàng của tôi" → {"orders": true, ...others: false}
- "giao hàng bao lâu" → {"shipping": true, ...others: false}

Trả lời CHỈ bằng JSON, không có text khác:`;

      const result = await this.model.generateContent(detectionPrompt);
      const response = await result.response;
      const responseText = response.text().trim();
      
      // Parse JSON response
      // Remove markdown code blocks if present
      let jsonText = responseText;
      if (jsonText.includes('```json')) {
        jsonText = jsonText.split('```json')[1].split('```')[0].trim();
      } else if (jsonText.includes('```')) {
        jsonText = jsonText.split('```')[1].split('```')[0].trim();
      }
      
      const detectedFeatures = JSON.parse(jsonText);
      
      // Ensure all features are boolean and add general flag
      const features = {
        products: Boolean(detectedFeatures.products || false),
        orders: Boolean(detectedFeatures.orders || false),
        categories: Boolean(detectedFeatures.categories || false),
        brands: Boolean(detectedFeatures.brands || false),
        pricing: Boolean(detectedFeatures.pricing || false),
        shipping: Boolean(detectedFeatures.shipping || false),
        payment: Boolean(detectedFeatures.payment || false),
        return_policy: Boolean(detectedFeatures.return_policy || false),
        general: !(detectedFeatures.products || detectedFeatures.orders || 
                   detectedFeatures.categories || detectedFeatures.brands || 
                   detectedFeatures.pricing || detectedFeatures.shipping || 
                   detectedFeatures.payment || detectedFeatures.return_policy)
      };
      
      console.log(`🤖 AI detected features:`, features);
      return features;
      
    } catch (error) {
      console.error('❌ Error in AI feature detection, falling back to keyword-based:', error.message);
      // Fallback to keyword-based detection
      return this.detectFeaturesKeywordBased(userMessage);
    }
  }

  /**
   * Detect features from user message using keyword matching (fallback)
   * @param {string} userMessage - The user's message
   * @returns {Object} Detected features
   */
  detectFeaturesKeywordBased(userMessage) {
    const lowerMessage = userMessage.toLowerCase();
    const features = {
      products: false,
      orders: false,
      categories: false,
      brands: false,
      pricing: false,
      shipping: false,
      payment: false,
      return_policy: false,
      general: true
    };

    // Pricing-related keywords (check first as it often combines with products)
    const pricingKeywords = [
      'giá', 'price', 'giá cả', 'bao nhiêu', 'chi phí', 'cost',
      'rẻ', 'cheap', 'cheapest', 'giá rẻ', 'giá thấp', 'giá tốt',
      'đắt', 'expensive', 'giá cao', 'giá đắt',
      'giảm giá', 'sale', 'khuyến mãi', 'discount', 'giảm',
      'từ', 'dưới', 'trên', 'khoảng', 'range', 'between'
    ];
    
    if (pricingKeywords.some(keyword => lowerMessage.includes(keyword))) {
      features.pricing = true;
      features.general = false;
    }

    // Product-related keywords (more comprehensive)
    const productKeywords = [
      'sản phẩm', 'product', 'item', 'hàng',
      'áo', 'quần', 'giày', 'dép', 'túi', 'ví', 'mũ', 'kính',
      'phụ kiện', 'accessory', 'quần áo', 'clothing', 'fashion',
      'tìm', 'find', 'search', 'mua', 'buy', 'bán', 'sell',
      'show', 'hiển thị', 'danh sách', 'list', 'liệt kê',
      'có gì', 'what', 'nào', 'which', 'gì', 'what'
    ];
    
    if (productKeywords.some(keyword => lowerMessage.includes(keyword))) {
      features.products = true;
      features.general = false;
    }

    // Special cases: pricing + products combined queries
    const combinedProductPricing = [
      'sản phẩm rẻ', 'cheap product', 'sản phẩm giá rẻ',
      'sản phẩm rẻ nhất', 'cheapest product', 'sản phẩm giá thấp nhất',
      'sản phẩm đắt nhất', 'most expensive product',
      'sản phẩm giảm giá', 'product on sale', 'sản phẩm khuyến mãi'
    ];
    
    if (combinedProductPricing.some(pattern => lowerMessage.includes(pattern))) {
      features.products = true;
      features.pricing = true;
      features.general = false;
    }

    // Order-related keywords
    const orderKeywords = [
      'đơn hàng', 'order', 'mã đơn', 'order id', 'order code',
      'tra cứu đơn', 'kiểm tra đơn', 'check order', 'xem đơn',
      'đơn của tôi', 'my order', 'lịch sử đơn', 'order history',
      'trạng thái đơn', 'order status', 'đơn đã đặt'
    ];
    
    if (orderKeywords.some(keyword => lowerMessage.includes(keyword))) {
      features.orders = true;
      features.general = false;
    }

    // Category-related keywords
    const categoryKeywords = [
      'danh mục', 'category', 'categories', 'loại', 'phân loại',
      'nhóm', 'group', 'dòng sản phẩm', 'product line'
    ];
    
    if (categoryKeywords.some(keyword => lowerMessage.includes(keyword))) {
      features.categories = true;
      features.general = false;
    }

    // Brand-related keywords
    const brandKeywords = [
      'thương hiệu', 'brand', 'nhãn hiệu', 'label',
      'hãng', 'manufacturer', 'nhà sản xuất'
    ];
    
    if (brandKeywords.some(keyword => lowerMessage.includes(keyword))) {
      features.brands = true;
      features.general = false;
    }

    // Shipping-related keywords
    const shippingKeywords = [
      'ship', 'shipping', 'giao hàng', 'vận chuyển', 'delivery',
      'thời gian giao', 'delivery time', 'khi nào giao', 'when deliver',
      'phí ship', 'shipping fee', 'phí vận chuyển', 'delivery cost',
      'miễn phí ship', 'free shipping', 'free delivery'
    ];
    
    if (shippingKeywords.some(keyword => lowerMessage.includes(keyword))) {
      features.shipping = true;
      features.general = false;
    }

    // Payment-related keywords
    const paymentKeywords = [
      'thanh toán', 'payment', 'pay', 'trả tiền', 'pay money',
      'cod', 'cash on delivery', 'thanh toán khi nhận',
      'vnpay', 'momo', 'zalopay', 'chuyển khoản', 'bank transfer',
      'thẻ', 'card', 'visa', 'mastercard'
    ];
    
    if (paymentKeywords.some(keyword => lowerMessage.includes(keyword))) {
      features.payment = true;
      features.general = false;
    }

    // Return policy keywords
    const returnKeywords = [
      'đổi', 'exchange', 'trả', 'return', 'hoàn', 'refund',
      'đổi trả', 'return policy', 'chính sách đổi trả',
      'hoàn tiền', 'money back', 'bảo hành', 'warranty'
    ];
    
    if (returnKeywords.some(keyword => lowerMessage.includes(keyword))) {
      features.return_policy = true;
      features.general = false;
    }

    // If any specific feature is detected, it's not general
    if (features.products || features.orders || features.categories || 
        features.brands || features.pricing || features.shipping || 
        features.payment || features.return_policy) {
      features.general = false;
    }

    return features;
  }

  /**
   * Fetch data from database based on detected features
   * @param {Object} features - Detected features
   * @param {string} userId - User ID (for orders)
   * @param {string} userMessage - Original user message for more targeted queries
   * @returns {Promise<Object>} Fetched data
   */
  async fetchFeatureData(features, userId = null, userMessage = '') {
    const data = {};
    const lowerMessage = userMessage.toLowerCase();

    try {
      // Fetch products if needed
      if (features.products) {
        let productQuery = { 
          isDeleted: false,
          status: 'Đang bán'
        };
        
        // Try to extract product name or category from message for more targeted search
        // Look for common product keywords
        const productKeywords = ['áo', 'quần', 'giày', 'dép', 'túi', 'ví', 'mũ', 'kính'];
        const foundKeyword = productKeywords.find(kw => lowerMessage.includes(kw));
        
        if (foundKeyword) {
          // Search for products containing the keyword in name
          productQuery.name = { $regex: foundKeyword, $options: 'i' };
        }
        
        // Determine sort order based on pricing feature
        let sortOrder = { sold: -1 }; // Default: sort by popularity
        
        if (features.pricing) {
          // If pricing is involved, check for specific pricing queries
          if (lowerMessage.includes('rẻ') || lowerMessage.includes('cheap') || 
              lowerMessage.includes('thấp') || lowerMessage.includes('lowest') ||
              lowerMessage.includes('rẻ nhất') || lowerMessage.includes('cheapest')) {
            // Sort by price ascending (cheapest first)
            sortOrder = { price: 1 };
          } else if (lowerMessage.includes('đắt') || lowerMessage.includes('expensive') ||
                     lowerMessage.includes('cao') || lowerMessage.includes('highest') ||
                     lowerMessage.includes('đắt nhất') || lowerMessage.includes('most expensive')) {
            // Sort by price descending (most expensive first)
            sortOrder = { price: -1 };
          } else {
            // General pricing query - sort by price ascending
            sortOrder = { price: 1 };
          }
        }
        
        const products = await Product.find(productQuery)
          .select('name price category origin image sold quantity')
          .sort(sortOrder)
          .limit(20)
          .lean();
        data.products = products;
      }

      // Fetch categories if needed
      if (features.categories) {
        const categories = await Category.find({ 
          status: 'Hiển thị'
        })
          .select('name slug')
          .sort({ name: 1 })
          .limit(20)
          .lean();
        data.categories = categories;
      }

      // Fetch brands if needed
      if (features.brands) {
        const origins = await Origin.find()
          .select('name slug')
          .sort({ name: 1 })
          .limit(20)
          .lean();
        data.brands = origins;
      }

      // Fetch user orders if needed
      if (features.orders && userId) {
        const orders = await Order.find({ user_id: userId })
          .select('_id status total_amount items createdAt payment_method')
          .sort({ createdAt: -1 })
          .limit(10)
          .lean();
        data.orders = orders;
      }

    } catch (error) {
      console.error('❌ Error fetching feature data:', error.message);
    }

    return data;
  }

  /**
   * Generate bot response using Gemini AI
   * @param {string} userMessage - The user's message
   * @param {Array} chatHistory - Previous messages for context (optional)
   * @param {string} userId - User ID for fetching user-specific data
   * @returns {Promise<{text: string, responseType: string, confidenceScore: number}>}
   */
  async generateResponse(userMessage, chatHistory = [], userId = null) {
    // If Gemini is not available, return null to fallback to keyword-based
    if (!this.model) {
      return null;
    }

    try {
      // Step 1: Detect features/sector from user message
      const features = await this.detectFeatures(userMessage);
      console.log(`🔍 Detected features:`, features);
      
      // Step 2: Fetch relevant data from database based on detected sector
      const featureData = await this.fetchFeatureData(features, userId, userMessage);
      console.log(`📊 Fetched data:`, {
        products: featureData.products?.length || 0,
        categories: featureData.categories?.length || 0,
        brands: featureData.brands?.length || 0,
        orders: featureData.orders?.length || 0
      });

      // Step 3: Build strict system instruction emphasizing data accuracy
      const systemInstructionText = `Bạn là Trợ lý ảo của FireStore - một cửa hàng thời trang online tại Việt Nam.

QUAN TRỌNG - QUY TẮC NGHIÊM NGẶT:
- CHỈ sử dụng dữ liệu được cung cấp trong phần "DỮ LIỆU TỪ CƠ SỞ DỮ LIỆU" bên dưới
- KHÔNG được tạo ra hoặc bịa đặt thông tin về sản phẩm, giá cả, đơn hàng
- Nếu không có dữ liệu liên quan, hãy nói rõ "Tôi không có thông tin về [chủ đề] trong hệ thống"
- Nếu có dữ liệu, hãy trích dẫn chính xác từ dữ liệu được cung cấp

Nhiệm vụ của bạn:
- Trả lời câu hỏi của khách hàng một cách thân thiện, chuyên nghiệp bằng tiếng Việt
- Sử dụng CHÍNH XÁC dữ liệu được cung cấp - không thêm thắt thông tin
- Giữ câu trả lời ngắn gọn, dễ hiểu (tối đa 200 từ)
- Nếu không có dữ liệu phù hợp, đề xuất khách hàng chuyển sang chat với nhân viên hỗ trợ
- Luôn lịch sự và nhiệt tình

Thông tin chung về FireStore (chỉ dùng khi không có dữ liệu cụ thể):
- Miễn phí ship cho đơn từ 500k
- Thời gian giao hàng: Nội thành HCM/HN 1-2 ngày, các tỉnh thành khác 3-5 ngày
- Hỗ trợ thanh toán: COD, VNPay, MoMo, ZaloPay, chuyển khoản
- Chính sách đổi trả: Đổi size trong 7 ngày, hoàn tiền nếu lỗi sản xuất`;

      // Build conversation history for context
      // Filter and format messages, ensuring history starts with a user message
      let formattedHistory = [];
      let foundFirstUser = false;
      
      for (const msg of chatHistory.slice(-10)) {
        // Skip leading bot messages until we find the first user message
        if (!foundFirstUser && msg.sender_type !== 'user') {
          continue; // Skip bot/admin messages at the start
        }
        
        foundFirstUser = true; // Once we find a user message, include all subsequent messages
        
        formattedHistory.push({
          role: msg.sender_type === 'user' ? 'user' : 'model',
          parts: [{ text: msg.message }]
        });
      }

      // Step 4: Build user message with structured database data
      // Format data clearly and explicitly for Gemini
      let userMessageWithContext = `Câu hỏi của khách hàng: ${userMessage}`;
      
      // Add database data in a clear, structured format
      if (Object.keys(featureData).length > 0) {
        userMessageWithContext += '\n\n=== DỮ LIỆU TỪ CƠ SỞ DỮ LIỆU ===\n';
        userMessageWithContext += 'CHỈ sử dụng thông tin dưới đây để trả lời. KHÔNG tạo ra thông tin mới.\n\n';
        
        if (featureData.products && featureData.products.length > 0) {
          userMessageWithContext += '--- SẢN PHẨM (từ database) ---\n';
          featureData.products.slice(0, 15).forEach((p, idx) => {
            userMessageWithContext += `${idx + 1}. Tên: "${p.name}" | Giá: ${p.price.toLocaleString('vi-VN')}đ | Danh mục: ${p.category || 'N/A'} | Nguồn gốc: ${p.origin || 'N/A'} | Đã bán: ${p.sold || 0}\n`;
          });
          userMessageWithContext += '\n';
        }
        
        if (featureData.categories && featureData.categories.length > 0) {
          userMessageWithContext += '--- DANH MỤC (từ database) ---\n';
          featureData.categories.forEach((c, idx) => {
            userMessageWithContext += `${idx + 1}. ${c.name}\n`;
          });
          userMessageWithContext += '\n';
        }
        
        if (featureData.brands && featureData.brands.length > 0) {
          userMessageWithContext += '--- THƯƠNG HIỆU (từ database) ---\n';
          featureData.brands.forEach((b, idx) => {
            userMessageWithContext += `${idx + 1}. ${b.name}\n`;
          });
          userMessageWithContext += '\n';
        }
        
        if (featureData.orders && featureData.orders.length > 0) {
          userMessageWithContext += '--- ĐƠN HÀNG CỦA KHÁCH HÀNG (từ database) ---\n';
          featureData.orders.forEach((o, idx) => {
            const orderDate = o.createdAt ? new Date(o.createdAt).toLocaleDateString('vi-VN') : 'N/A';
            userMessageWithContext += `${idx + 1}. Mã đơn: ${o._id} | Trạng thái: ${o.status} | Tổng tiền: ${o.total_amount.toLocaleString('vi-VN')}đ | Ngày: ${orderDate}\n`;
          });
          userMessageWithContext += '\n';
        }
        
        userMessageWithContext += '=== KẾT THÚC DỮ LIỆU ===\n';
        userMessageWithContext += '\nHãy trả lời câu hỏi của khách hàng CHỈ dựa trên dữ liệu trên.';
      } else {
        userMessageWithContext += '\n\nLƯU Ý: Không có dữ liệu cụ thể từ database cho câu hỏi này. Hãy trả lời dựa trên thông tin chung về FireStore hoặc đề xuất liên hệ nhân viên hỗ trợ.';
      }

      // Step 5: Configure Gemini with lower temperature to reduce hallucinations
      const chatConfig = {
        generationConfig: {
          temperature: 0.3, // Lower temperature for more factual, less creative responses
          topK: 20, // Reduced for more focused responses
          topP: 0.8, // Reduced for more deterministic responses
          maxOutputTokens: 500,
        },
      };
      
      // Step 6: Generate response from Gemini AI
      let responseText;
      
      if (formattedHistory.length === 0) {
        // No history - include system instruction in the prompt
        const promptWithSystem = `${systemInstructionText}\n\n${userMessageWithContext}\n\nTrợ lý ảo FireStore:`;
        const result = await this.model.generateContent(promptWithSystem);
        const response = await result.response;
        responseText = response.text().trim();
      } else {
        // Has history - start chat with history
        chatConfig.history = formattedHistory;
        const chat = this.model.startChat(chatConfig);
        const prompt = `${systemInstructionText}\n\n${userMessageWithContext}\n\nTrợ lý ảo FireStore:`;
        
        const result = await chat.sendMessage(prompt);
        const response = await result.response;
        responseText = response.text().trim();
      }
      
      // Step 7: Return exactly the response from Gemini (no modifications)
      console.log(`✅ Gemini response generated (length: ${responseText.length} chars)`);
      
      let responseType = this.determineResponseType(userMessage, responseText);
      // Validate and ensure responseType is a valid enum value
      responseType = this.validateResponseType(responseType);
      const confidenceScore = this.calculateConfidence(responseText);
      
      return {
        text: responseText, // Return exactly what Gemini generated
        responseType: responseType,
        confidenceScore: confidenceScore
      };

    } catch (error) {
      console.error('❌ Gemini AI error:', error.message);
      // Return null to fallback to keyword-based responses
      return null;
    }
  }

  /**
   * Validate response type against allowed enum values
   * @param {string} responseType - Response type to validate
   * @returns {string} Valid response type
   */
  validateResponseType(responseType) {
    const validTypes = ['greeting', 'product_info', 'product_list', 'pricing', 'shipping', 'support', 'help', 'info', 'default'];
    if (validTypes.includes(responseType)) {
      return responseType;
    }
    // Map invalid types to valid ones
    const typeMapping = {
      'general': 'default',
      'order_info': 'info',
      'payment': 'pricing',
      'return_policy': 'support'
    };
    return typeMapping[responseType] || 'default';
  }

  /**
   * Determine response type based on message content
   * Returns only valid enum values: 'greeting', 'product_info', 'product_list', 'pricing', 'shipping', 'support', 'help', 'info', 'default'
   */
  determineResponseType(userMessage, botResponse) {
    const lowerUserMsg = userMessage.toLowerCase();
    const lowerBotMsg = botResponse.toLowerCase();

    if (lowerUserMsg.includes('chào') || lowerUserMsg.includes('hello') || lowerUserMsg.includes('hi')) {
      return 'greeting';
    } else if (lowerUserMsg.includes('sản phẩm') || lowerUserMsg.includes('áo') || lowerUserMsg.includes('quần')) {
      return 'product_info';
    } else if (lowerUserMsg.includes('đơn hàng') || lowerUserMsg.includes('order')) {
      return 'info'; // Map order_info to 'info' (valid enum)
    } else if (lowerUserMsg.includes('ship') || lowerUserMsg.includes('giao hàng')) {
      return 'shipping';
    } else if (lowerUserMsg.includes('thanh toán') || lowerUserMsg.includes('payment')) {
      return 'pricing'; // Map payment to 'pricing' (valid enum)
    } else if (lowerUserMsg.includes('đổi') || lowerUserMsg.includes('trả') || lowerUserMsg.includes('hoàn')) {
      return 'support'; // Map return_policy to 'support' (valid enum)
    } else if (lowerBotMsg.includes('nhân viên') || lowerBotMsg.includes('admin')) {
      return 'support';
    } else {
      return 'default'; // Map 'general' to 'default' (valid enum)
    }
  }

  /**
   * Calculate confidence score (0-1)
   */
  calculateConfidence(responseText) {
    const length = responseText.length;
    const hasQuestion = responseText.includes('?');
    const hasUncertainty = responseText.includes('có thể') || 
                          responseText.includes('không chắc') ||
                          responseText.includes('không rõ');

    let score = 0.7; // Base score

    if (length > 50 && length < 300) {
      score += 0.1; // Good length
    }

    if (hasUncertainty) {
      score -= 0.2; // Less confident if uncertain
    }

    if (!hasQuestion) {
      score += 0.1; // More confident if providing direct answer
    }

    return Math.min(1.0, Math.max(0.5, score));
  }

  /**
   * Check if Gemini AI is available
   */
  isAvailable() {
    return this.model !== null && this.apiKey !== null && this.apiKey !== 'your_gemini_api_key_here';
  }
}

// Export singleton instance
module.exports = new GeminiService();


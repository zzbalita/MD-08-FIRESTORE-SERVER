// Chat Models
const Chat = require('./Chat');
const AdminChat = require('./AdminChat');
const ChatMessage = require('./ChatMessage');

// Chat Support Models (New)
const ChatRoom = require('./ChatRoom');
const ChatSupport = require('./ChatSupport');
const UserStatus = require('./UserStatus');

// User Models
const User = require('./User');
const Admin = require('./Admin');

// Product Models
const Product = require('./Product');
const Category = require('./Category');
const Brand = require('./Brand');
const Size = require('./Size');
const DescriptionField = require('./DescriptionField');

// Order Models
const Order = require('./Order');
const Payment = require('./Payment');
const Address = require('./Address');

// Other Models
const Wishlist = require('./Wishlist');
const Comment = require('./Comment');
const OTP = require('./otp.model');

module.exports = {
  // Chat Models
  Chat,
  AdminChat,
  ChatMessage,
  
  // Chat Support Models (New)
  ChatRoom,
  ChatSupport,
  UserStatus,
  
  // User Models
  User,
  Admin,
  
  // Product Models
  Product,
  Category,
  Brand,
  Size,
  DescriptionField,
  
  // Order Models
  Order,
  Payment,
  Address,
  
  // Other Models
  Wishlist,
  Comment,
  OTP
};

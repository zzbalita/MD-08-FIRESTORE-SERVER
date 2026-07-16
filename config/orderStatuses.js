const ORDER_STATUSES = ['pending', 'confirmed', 'delivered'];

const STATUS_LABELS = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  delivered: 'Đã giao hàng',
};

const STATUS_TRANSITIONS = {
  pending: ['confirmed'],
  confirmed: ['delivered'],
  delivered: [],
};

function isValidOrderStatus(status) {
  return ORDER_STATUSES.includes(status);
}

function canTransition(from, to) {
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

module.exports = {
  ORDER_STATUSES,
  STATUS_LABELS,
  STATUS_TRANSITIONS,
  isValidOrderStatus,
  canTransition,
};

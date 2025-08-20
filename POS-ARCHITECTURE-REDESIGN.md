thêm pos-order.service:
	sử dụng localstorage (env.get/set Storage) để ghi danh sách các đơn hàng (interface POS_Order)
	cho các hàm CRUD để xử lý database localstorage
	cho các hàm xử lý luồng đồng bộ qua API khi có internet
	sử dụng cơ chế tracking bằng property Code = lib.generateUID cho cả order và orderline
	các hàm private calcOrder

ở cart service tôi muốn kiến trúc lại:
	đọc nội dung cart từ pos-order.service
	chỉ giữ lại các luồng xử lý đến UI giỏ hàng

move các hàm lấy biến môi trường và config ở pos.service xuống pos-env-data.service

tất cả các pos-xxx.service đều được truy vấn và sử dụng thông qua pos.service, không trực tiếp từ component pos-order-detail
riêng pos-order có thể dùng trực tiếp pos-order.service

ĐIỂM CẦN THẢO LUẬN
1. LocalStorage Performance với Large Dataset
Số lượng order khoảng dưới 1000 đơn / ngày.
Các đơn hàng đã sync thành công và đã settled qua 1 ngày sẽ được xả khỏi LocalStorage.

2. Sync Strategy Details
	resolveSyncConflict như này là hợp lý:
  // Server wins for payments
  // Local wins for pending changes  
  // Merge for non-conflicting fields
  // có thể thêm cơ chế dùng ModifiedDate để ưu tiên conflict resolution
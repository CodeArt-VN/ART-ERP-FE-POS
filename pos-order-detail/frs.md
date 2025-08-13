## Tài liệu đặc tả yêu cầu chức năng (Functional Requirements Specification - FRS)

### Màn hình chi tiết đơn hàng (Order detail)

### 1. Giới thiệu

* **1.1. Mục đích của tài liệu**
  Tài liệu này mô tả chi tiết các yêu cầu chức năng cho màn hình chi tiết đơn hàng. Nó phục vụ như một tài liệu hướng dẫn cho đội ngũ phát triển, kiểm thử, và các bên liên quan để hiểu rõ cách hệ thống sẽ hoạt động và tương tác với người dùng.
* **1.2. Phạm vi tài liệu**
  Tài liệu này tập trung vào các chức năng cụ thể của màn hình chi tiết đơn hàng, bao gồm hiển thị trạng thái bàn, tương tác với bàn (thêm món, tăng/giảm số lượng món, xóa món khỏi bàn,...), lọc menu theo thao tác người dùng.
* **1.3. Tham chiếu**
  * User Requirements Specification (URS) - Màn hình chi tiết đơn hàng (Order detail) v1.0
  * [Thêm các tài liệu tham chiếu khác nếu có, ví dụ: UI/UX Wireframes, Design Mockups]
* **1.4. Thuật ngữ và từ viết tắt**
  * **POS:** Point of Sale - Hệ thống điểm bán hàng
  * **FRS:** Functional Requirements Specification - Tài liệu đặc tả yêu cầu chức năng
  * **UI:** User Interface - Giao diện người dùng
  * **UX:** User Experience - Trải nghiệm người dùng
  * **Menu:** Thực đơn
  * **Actor:** Người dùng hoặc hệ thống tương tác với hệ thống.

---

### 2. Các chức năng chi tiết (Detailed Functional Requirements)

Mỗi chức năng được mô tả dựa trên các Use Case từ URS, nhưng chi tiết hơn về cách hệ thống sẽ xử lý và hiển thị.

#### 2.1. FR-01: Hiển thị tổng quan thông tin bàn

* **FR-01.1: Hiển thị Menu**

  * **Mô tả:** Hệ thống phải hiển thị danh sách các menu.
  * **Giao diện:** Danh sách các menu, mỗi menu là một nút bấm rõ ràng, có hình ảnh, có thể click/chạm.
  * **Hành vi:** Khi người dùng chọn một menu, danh sách các món ăn được cập nhật ngay lập tức theo menu để lọc ra các món theo menu.
* **FR-01.2: Các chức năng thao tác trên menu(Danh sách menu, thanh tìm kím menu)**

  * **Mô tả:** Hệ thống phải cung cấp các nút menu ngữ cảnh để thực hiện các thao tác quản lý bàn phức tạp.
  * **Giao diện:** Hiển thị danh sách menu và thanh tìm kiếm:
    * **Tên menu:** (Sushi, Nước uống). Phông chữ rõ ràng, dễ đọc, có hình ảnh của menu đi kèm.
      * **Hành vi:** Khi người dùng chọn một menu, danh sách các món ăn được cập nhật ngay lập tức theo menu để lọc ra các món theo menu.
    * **Thanh tìm kiếm menu:** Hiển thị thanh tìm kiếm cho phép người dùng tương tác nhập chuỗi tìm kiếm.
      * **Hành vi:** Người dùng nhập vào tên menu hoặc mã menu, màn hình hiển thị sẽ cập nhật lại menu và các món ăn trùng khớp theo menu tìm được.
* **FR-02.1: Hiển thị món ăn**

  * **Mô tả:** Hệ thống phải hiển thị danh sách các món ăn được nhóm lại theo menu.
  * **Giao diện:** Danh sách các món ăn, mỗi món ăn sẽ hiển thị hình ảnh, giá, tên món, nút thêm vào giỏ hàng, có thể click/chạm.
  * **Hành vi:** Khi người dùng bấm nút thêm vào giỏ hàng, món ăn phải được thêm vào danh sách các sản phẩm đặt hàng bên phải, hoặc tăng số lượng lên nếu món ăn đã tồn tại trong giỏ hàng. ** Lưu ý đơn hàng bị khóa, tạm tính, đã thanh toán thì không thể thêm món ăn.
* **FR-02.2: Các chức năng thao tác trên món ăn(Thêm món ăn)**

  * **Mô tả:** Người dùng thao tác thêm món ăn khi bấm vào biểu tượng "Thêm vào giỏ hàng" trên món ăn.
  * **Giao diện:** Hiển thị nút bấm "Thêm vào giỏ hàng" trên ô món ăn:
  * **Hành vi:** Khi người bấm vào biểu tượng "Thêm vào giỏ hàng", món ăn sẽ được thêm vào trong dánh sách các món ăn của bàn bên phải, nếu món ăn đã tồn tại từ trước thì số lượng sẽ được tăng thêm.
* **FR-03.1: Hiển thị danh sách món ăn của bàn**

  * **Mô tả:** Hệ thống phải hiển thị danh sách các món ăn đã được đặt hàng, bao gồm các món đã thanh toán và các món mới, thông tin khuyến mãi, chiết khấu, tổng hóa đơn, xuất hóa đơn, thông tin khách hàng và cho phép thanh toán.
  * **Giao diện:** Hiển thị theo nhóm:

    * **Nhóm 1:**  Hiển thị các món ăn gồm 2 tab món mới và đã làm, các món ăn hiển thị phải có hình ảnh, tên món, giá món, thuế GTGT, ngày giờ đặt món theo format hh:mm dd/MM.
    * **Các chức năng thao tác trên món ăn:** Các chức năng thao tác trên món ăn(+/- số lượng, thêm ghi chú, xóa khỏi bàn).
    * **Thêm số lượng:** Giao diện nút bấm cho phép người dùng thêm số lượng món ăn.
    * **Hành vi:** Khi người dùng bấm nút thêm số lượng(+), số lượng món ăn phải được tăng lên 1.
    * **Giảm số lượng:** Giao diện nút bấm cho phép người dùng giảm số lượng món ăn.
    * **Hành vi:** Khi người dùng bấm nút giảm số lượng(-), số lượng món ăn phải được giảm xuống 1.
      Nếu số lượng món ăn bằng không thì sẽ mở popup hỏi lại có muốn xóa món ăn khỏi đơn không.
    * **Thêm ghi chú:** Nút bấm cho phép người dùng mở popup thêm ghi chú vào món ăn
    * **Hành vi:** Khi người dùng bấm nút thêm ghi chú, mở một popup hiển thị sẵn danh sách các ghi chú thông dụng cho người dùng bấm chọn, hoặc người dùng có thể tự điền ghi chú.
    * **Xóa món ăn:** Nút bấm ho phép người dùng xóa món ăn khỏi đơn.
    * **Hành vi:** Khi người dùng bấm nút xóa món ăn, phải hiển thị popup để hỏi lại quyết định xóa món.
    * **Nhóm 2:**  Hiển thị các khuyển mãi và chiết khấu, nút bấm thếm khuyến mãi/Vouncher.

      * **Các chức năng thao tác nhóm khuyễn mã/chiết khấu:** Chức năng thao tác khuyến mãi/Vouncher.
        * **Thêm khuyến mãi/vouncher:** Giao diện nút bấm cho phép người dùng thêm khuyến mãi/Vouncher.
        * **Hành vi:** Khi người dùng bấm nút Thêm khuyến mãi/chiết khấu, mở 1 popup load các khuyễn mãi, chiết khấu cho đơn hàng, người dùng chọn và thêm vào đơn hàng, đơn hàng sẽ cập nhật lại thông tin khuyến mãi/chiết khấu, tổng bill.
    * **Nhóm 3:**  Hiển thị tổng giá trị bill, chiết khấu, phí phục vụ, tổng tiền sau thuế, số tiền đã thanh toán, nút xuất hóa đơn.

      * **Các chức năng thao tác nhóm tổng bill** Nút bấm Xuất hóa đơn.
        * **Xuất hóa đơn:** Giao diện nút bấm cho phép người dùng thêm thông tin xuất hóa đơn.
        * **Hành vi:** Khi người dùng bấm nút Xuất hóa đơn sẽ mở popup load các thông tin của khách hàng  như Mã khách hàng, Mã số thuế, Email, Tên công ty, Địa chỉ công ty, người dùng có thể chỉnh sửa trực tiếp trên popup. Nếu người dùng bấm áp dụng thì đơn hàng sẽ cập nhập là có xuất hóa đơn cho khách.
    * **Nhóm 4:**  Hiển thị thông tin khách hàng, thời gian mở bàn, số lượng khách tại bàn, mã bàn, tình trạng bàn.

      * **Các chức năng thao tác nhóm thông tin khách hàng** Combo box chọn khách hàng, nút tạo mới khách hàng, ô điền số lượng khách, combo box chọn mã bàn, nút hủy bàn.
        * **Chọn khách hàng:** Hiển thị thông tin tên khách hàng.
          * **Hành vi:** Giao diện hiên thị tên khách hàng, người dùng bấm vào sẽ sổ ra danh sách khách hàng để chọn, có thể điền thông tin như tên, mã khách hàng để tìm kiếm, sau khi chọn, đơn hàng sẽ cập nhật lại thông tin khách hàng.
        * **Tạo khách hàng:** Nút bấm tạo khách hàng mới.
          * **Hành vi:** Người dùng bấm vào nút tạo Khách hàng mới sẽ mở popup điền thông tin tên và số điện thoại của khách hàng. Sau khi bấm thêm khách hàng, thông tin khách hàng sẽ cập nhập lại.
        * **Số lượng khách hàng:** Hiển thị số lượng khách thực ngồi tại bàn.
          * **Hành vi:** Người dùng có thể chỉnh sửa, điền số lượng khách trong bàn.
        * **Danh sách bàn:** Hiển thị mặc định bàn hiện tại, và các bàn khác của đơn hàng nếu có.
          * **Hành vi:** Người dùng có thể chỉnh sửa, xóa, thêm một bàn khác vào đơn, lúc này đơn sẽ tồn tại trên các bàn người dùng chọn.//check cau hinh
        * **Hủy đơn hàng:** Hiển thị nút bấm hủy để người dùng có thể hủy đơn.
          * **Hành vi:** Khi người dùng bấm nút hủy đơn sẽ mở một popup cho người dùng chọn các lý do hủy đơn, hoặc người dùng chọn Lý do khác để có thể nhập nội dung. Sau khi bấm đồng ý thì tình trạng đơn sẽ chuyển trạng thái Đã hủy.
  * **FR-03.2: Hiện thị lưu và tính tiền**

    * **Mô tả:** Hệ thống phải hiển thị nút lưu và tính tiền, tạm tính tiền.
    * **Giao diện:** Hiển thị theo nhóm nút gồm lưu và tính tiền, tạm tính tiền:
      * **Nút lưu:** Hiện thị nút lưu nằm trong footer của thông tin bàn.
        * **Hành vi:** Khi người dùng bấm vào nút Lưu, sẽ mở lên popup thông báo còn bao nhiêu món chưa gửi quầy Bar/bếp, nếu bấm xác nhận sẽ gửi lệnh in đến quầy bar/bếp. Sau đó hệ thống sẽ lưu lại đơn hàng.
      * **Nút lưu:** Hiển thị nút tạm tính tiền nằm trong footer của thông tin bàn.
        * **Hành vi:** Khi người dùng bấm vào nút tạm tính tiền, sẽ mở lên popup thông báo còn bao nhiêu món chưa gửi quầy Bar/bếp, nếu bấm xác nhận sẽ gửi lệnh in đến quầy bar/bếp. Sau đó bàn sẽ chuyển qua trạng thái 'TemporaryBill' và hiển thị nút in phiếu và nút tính tiền.
      * **Nút in bill:** Hiển thị nút in phiếu nằm trong footer của thông tin bàn.
        * **Hành vi:** Điều kiện hiển thị là khi bàn ở trạng thái 'TemporaryBill'. Khi người dùng bấm vào nút in phiếu, sẽ tạo lệnh in bill để xuất bill.
      * **Nút tính tiền:** Hiển thị nút tính tiền nằm trong footer của thông tin bàn.
        * **Hành vi:** Điều kiện hiển thị là khi bàn ở trạng thái 'TemporaryBill'. Khi người dùng bấm vào nút tính tiền sẽ mở trang thanh toán. Sau khi thanh toán bàn sẽ chuyển trạng thái Done.

#### 2.2. FR-05: Lưu thông tin đơn hàng trường hợp mất kết nối mạng

* **FR-01.1: Thông tin tổng quan trên cùng**
  * **Mô tả:** Hệ thống phải lưu trữ được thông tin đơn hàng ngay cả khi còn hoặc mất kết nối, để sau khi có lại kết nối sẽ đồng bộ đơn hàng về server để trong trường hợp mất kết nối người dùng vẫn có thể tương tác và sử dụng phần mềm chính xác.
  * **Giả định:** Đây là trường hợp mất kết nối mạng.
  * **Hành vi:** Các số liệu này phải được cập nhật theo thời gian thực khi có đơn hàng mới được tạo, thêm, bớt món ăn,thanh toán, khách hàng ra về, v.v. sau đó đồng bộ lại dữ liêu lên server.
* **FR-01.2: Thực hiện**
  * **Mô tả:** Phải xây dựng được cơ chế lưu trữ dữ liệu tại local sao cho khi người dùng tương tác hệ thống, chỉnh sửa đơn hàng, vẫn có thể lưu lại, cần phải ràng buộc lại các chức năng tương tác.
  * **Chức năng:** :
    * **Thêm/giảm số lượng/xóa món ăn:** Lưu lại trạng thái, số lượng các sản phẩm trong bàn lại ở storage, khi có mạng sẽ đồng bộ lại lên server.
    * **Tạm tính tiền/tính tiền:** Lưu lại trạng thái cuối cùng của bill, số lượng sản phẩm, đã tính tiền bao nhiêu ở storage.

### 3. Yêu cầu giao diện người dùng (User Interface Requirements)

* **3.1. Thiết kế tổng thể:**
  * Giao diện phải hiện đại, sạch sẽ và phù hợp với thương hiệu của nhà hàng/quán cafe.
  * Bố cục phải trực quan, dễ hiểu ngay cả với người dùng mới.
  * Sử dụng màu sắc và biểu tượng nhất quán để biểu thị trạng thái và chức năng.
* **3.2. Điều hướng:**
  * Các nút điều hướng chính và các khu vực chức năng phải rõ ràng, dễ tiếp cận.
  * Cần có khả năng quay lại màn hình trước hoặc màn hình chính một cách dễ dàng.
* **3.3. Phản hồi và thông báo:**
  * Hệ thống phải cung cấp phản hồi hình ảnh (ví dụ: highlight nút, thay đổi màu sắc) khi người dùng tương tác.
  * Các thông báo thành công, lỗi, hoặc cảnh báo phải rõ ràng, dễ hiểu và hiển thị ở vị trí dễ thấy.
* **3.4. Tối ưu cho cảm ứng:**
  * Các nút bấm, ô chọn phải có kích thước đủ lớn để dễ dàng thao tác bằng ngón tay trên màn hình cảm ứng.
  * Hỗ trợ cử chỉ chạm và vuốt (nếu cần thiết cho trải nghiệm người dùng).

---

### 4. Quy tắc nghiệp vụ (Business Rules)

* **BR-01:** (Nhắc lại từ URS): Chỉ bàn ở trạng thái Scheduler mới có thể thêm món mới.
* **BR-02:** (Nhắc lại từ URS): Khách hàng thanh toán bàn, sau đó có gọi thêm món thì số tiền đã thanh toán sẽ cập nhật trên giao diện.
* **BR-03:** (Nhắc lại từ URS): Khi chọn thêm bàn cho đơn hàng, đơn hàng sẽ có mặt trên các bàn.
* **BR-04:** (Nhắc lại từ URS): Khi tách hóa đơn, tổng tiền của các hóa đơn con phải bằng tổng tiền của hóa đơn gốc.
* **BR-05:** (Nhắc lại từ URS): Thông tin số lượng món phải được cập nhật theo thời gian thực.
* **BR-06:** (Nhắc lại từ URS): Các biểu tượng/màu sắc trạng thái bàn phải nhất quán và dễ hiểu.
* **BR-07:** (Từ URS, cần làm rõ): Ý nghĩa chính xác của các con số nhỏ màu đỏ/xanh trên ô bàn và biểu tượng "đĩa"/"người" phải được định nghĩa rõ ràng trong phần cấu hình hoặc tài liệu liên quan.

---

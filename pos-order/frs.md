## Tài liệu đặc tả yêu cầu chức năng (Functional Requirements Specification - FRS)

### Màn hình Quản lý Bàn/Khu vực (Table/Area Management Screen)


### 1. Giới thiệu

* **1.1. Mục đích của tài liệu**
  Tài liệu này mô tả chi tiết các yêu cầu chức năng cho màn hình Quản lý Bàn/Khu vực của hệ thống POS. Nó phục vụ như một tài liệu hướng dẫn cho đội ngũ phát triển, kiểm thử, và các bên liên quan để hiểu rõ cách hệ thống sẽ hoạt động và tương tác với người dùng.
* **1.2. Phạm vi tài liệu**
  Tài liệu này tập trung vào các chức năng cụ thể của màn hình Quản lý Bàn/Khu vực, bao gồm hiển thị trạng thái bàn, tương tác với bàn (mở đơn, chỉnh sửa, gộp, tách, chuyển), lọc khu vực và hiển thị thông tin tổng quan.
* **1.3. Tham chiếu**
  * User Requirements Specification (URS) - Màn hình Quản lý Bàn/Khu vực v1.0
  * [Thêm các tài liệu tham chiếu khác nếu có, ví dụ: UI/UX Wireframes, Design Mockups]
* **1.4. Thuật ngữ và từ viết tắt**
  * **POS:** Point of Sale - Hệ thống điểm bán hàng
  * **FRS:** Functional Requirements Specification - Tài liệu đặc tả yêu cầu chức năng
  * **UI:** User Interface - Giao diện người dùng
  * **UX:** User Experience - Trải nghiệm người dùng
  * **Actor:** Người dùng hoặc hệ thống tương tác với hệ thống.

---

### 2. Các chức năng chi tiết (Detailed Functional Requirements)

Mỗi chức năng được mô tả dựa trên các Use Case từ URS, nhưng chi tiết hơn về cách hệ thống sẽ xử lý và hiển thị.

#### 2.1. FR-01: Hiển thị tổng quan trạng thái bàn

* **FR-01.1: Hiển thị Khu vực**
  * **Mô tả:** Hệ thống phải hiển thị danh sách các khu vực (ví dụ: "Khu A", "Khu B", "Khu C", "Phòng họp VIP", "Convention", "Tất cả") dưới dạng các nút bấm hoặc tab ở phần trên của màn hình chính.
  * **Giao diện:** Mỗi khu vực là một nút bấm rõ ràng, có thể click/chạm. Nút/tab của khu vực đang được chọn phải có màu sắc hoặc hiệu ứng nổi bật.
  * **Hành vi:** Khi người dùng chọn một khu vực, danh sách bàn phía dưới phải được cập nhật ngay lập tức để chỉ hiển thị các bàn thuộc khu vực đó.
* **FR-01.2: Hiển thị ô bàn (Table Box)**
  * **Mô tả:** Mỗi bàn trong nhà hàng/quán cafe phải được biểu diễn bằng một ô hình chữ nhật trên màn hình. Các ô bàn phải được sắp xếp theo bố cục hợp lý, phản ánh phần nào bố trí vật lý của nhà hàng.
  * **Giao diện:** Mỗi ô bàn phải hiển thị:
    * **Tên/Mã bàn:** (Ví dụ: GLA01, GLB02). Phông chữ rõ ràng, dễ đọc.
    * **Trạng thái bàn (qua màu sắc):**
      * **Xanh lá cây:** Bàn trống, sẵn sàng phục vụ.
      * **Đỏ:** Bàn đang có khách/đang phục vụ/chờ thanh toán.
      * **Vàng:** Bàn đang ở trạng thái đặc biệt (ví dụ: đã đặt trước, đang chờ gộp/tách, đang dọn dẹp).
      * [Cần xác nhận từ bạn nếu có thêm màu sắc/trạng thái khác và ý nghĩa của chúng]
    * **Thông tin tóm tắt:** (Khi bàn không trống)
      * **Số lượng khách:** Được hiển thị bằng số nhỏ (ví dụ: số "2" trên GLA01).**Giả định:** Đây là số khách hiện tại tại bàn.
      * **Tổng tiền tạm tính:** (Ví dụ: "234,539" trên GLA06). Phải được cập nhật theo thời gian thực khi món được thêm/xóa.
      * **Thời gian:** (Ví dụ: "20:47" trên GLA06).**Giả định:** Đây là thời gian khách ngồi hoặc thời gian đơn hàng được tạo.
      * **Mã đơn hàng/Hóa đơn:** (Nếu có)
    * **Các biểu tượng bổ sung:** (Ví dụ: biểu tượng "đĩa", "người" trên GLB01).
      * **Giả định:** Biểu tượng "đĩa" có thể biểu thị món đã được gửi bếp/đang chuẩn bị/đã phục vụ.
      * **Giả định:** Biểu tượng "người" có thể biểu thị số khách.
      * [Cần xác nhận từ bạn ý nghĩa chính xác của các biểu tượng này]
  * **Hành vi:**
    * Ô bàn phải có thể click/chạm để thực hiện các thao tác.
    * Màu sắc và thông tin tóm tắt phải tự động cập nhật khi trạng thái bàn thay đổi.

#### 2.2. FR-02: Tương tác với bàn

* **FR-02.1: Mở/Chỉnh sửa đơn hàng (cho bàn trống/đang phục vụ)**
  * **Mô tả:** Khi người dùng chạm vào một ô bàn, hệ thống phải chuyển hướng đến màn hình chi tiết đơn hàng tương ứng.
  * **Giao diện:** Màn hình chi tiết đơn hàng phải cho phép:
    * Chọn món từ menu (có thể có phân loại danh mục, tìm kiếm).
    * Thêm/Bớt số lượng món.
    * Thêm ghi chú cho từng món (ví dụ: "ít đường", "không cay").
    * Xem tổng tiền tạm tính.
    * Nút "Gửi bếp/bar" (để in phiếu order).
    * Nút "Quay lại màn hình quản lý bàn".
  * **Hành vi:**
    * Nếu bàn trống: Mở một đơn hàng mới cho bàn đó. Trạng thái bàn trên màn hình tổng quan chuyển sang "đang phục vụ" (đỏ).
    * Nếu bàn đang phục vụ: Mở đơn hàng hiện có để chỉnh sửa.
* **FR-02.2: Các chức năng thao tác bàn (Gộp, Tách, Chuyển, In tạm tính)**
  * **Mô tả:** Hệ thống phải cung cấp các nút hoặc menu ngữ cảnh để thực hiện các thao tác quản lý bàn phức tạp.
  * **Giao diện:**
    * Khi người dùng chọn một hoặc nhiều bàn, các nút chức năng (ví dụ: "Chuyển bàn", "Gộp bàn", "Tách hóa đơn", "In tạm tính") phải hiển thị rõ ràng.
    * **Chuyển bàn:** Giao diện cho phép người dùng chọn bàn đích (trống hoặc đang phục vụ) để chuyển đơn hàng đến.
    * **Gộp bàn:** Giao diện cho phép người dùng chọn nhiều bàn để gộp đơn hàng thành một.
    * **Tách hóa đơn:** Giao diện hiển thị chi tiết các món trong đơn hàng, cho phép người dùng chọn các món để tách thành hóa đơn riêng.
    * **In tạm tính:** Nút in trực tiếp hóa đơn tạm tính cho bàn được chọn.
  * **Hành vi:**
    * **Chuyển bàn:** Sau khi chuyển, bàn gốc trở về trạng thái trống (xanh lá cây) và bàn đích cập nhật đơn hàng mới.
    * **Gộp bàn:** Các bàn gốc trở về trạng thái trống (xanh lá cây), bàn đích giữ trạng thái đang phục vụ với tổng đơn hàng đã gộp.
    * **Tách hóa đơn:** Tạo ra (các) đơn hàng/hóa đơn mới từ đơn hàng gốc, trạng thái bàn gốc vẫn là đang phục vụ cho đến khi tất cả các hóa đơn con được thanh toán.
    * **In tạm tính:** Gửi lệnh in đến máy in hóa đơn, không thay đổi trạng thái bàn.

#### 2.3. FR-03: Tìm kiếm bàn hoặc đơn hàng

* **FR-03.1: Thanh tìm kiếm**
  * **Mô tả:** Hệ thống phải cung cấp một thanh tìm kiếm ở vị trí dễ thấy (như trên cùng màn hình) để người dùng có thể nhanh chóng tìm kiếm bàn hoặc đơn hàng.
  * **Giao diện:** Ô nhập liệu cho phép nhập mã bàn, tên bàn, hoặc mã đơn hàng.
  * **Hành vi:** Khi người dùng nhập ký tự, hệ thống phải tự động lọc và hiển thị các bàn/đơn hàng phù hợp trong khu vực hiển thị chính hoặc trong một danh sách kết quả tìm kiếm riêng.

#### 2.4. FR-04: Hiển thị tổng quan hệ thống và danh sách đơn hàng chờ

* **FR-04.1: Thông tin tổng quan trên cùng**
  * **Mô tả:** Hệ thống phải hiển thị thông tin tổng quan về hoạt động hiện tại (ví dụ: "Đơn hàng: Số đơn 100 Số khách: 296") ở góc trên bên trái màn hình.
  * **Giả định:** Đây là tổng số đơn hàng đang hoạt động và tổng số khách đang có mặt trong toàn hệ thống.
  * **Hành vi:** Các số liệu này phải được cập nhật theo thời gian thực khi có đơn hàng mới được tạo, khách hàng ra về, v.v.
* **FR-04.2: Danh sách đơn hàng chờ/nổi bật (cột bên phải)**
  * **Mô tả:** Hệ thống phải hiển thị một danh sách các đơn hàng đang chờ xử lý hoặc có giá trị cao/thời gian chờ lâu ở cột bên phải màn hình.
  * **Giao diện:** Mỗi mục trong danh sách phải hiển thị:
    * **Mã bàn:** (Ví dụ: GLB01)
    * **Thời gian/Ngày:** (Ví dụ: "30/16 09/01").**Giả định:** Đây là thời gian đơn hàng được tạo hoặc thời gian chờ.
    * **Mã hóa đơn/ID đơn hàng:** (Ví dụ: "#123456").
    * **Tổng tiền tạm tính:** (Ví dụ: "200,210").
    * **Nút "Chuyển tiền":** (Giả định: đây là nút thanh toán nhanh hoặc chuyển thẳng đến màn hình thanh toán cho đơn hàng đó).
  * **Hành vi:**
    * Danh sách phải được sắp xếp theo tiêu chí nhất định (ví dụ: thời gian chờ lâu nhất, tổng tiền lớn nhất).
    * Click vào một mục trong danh sách phải chuyển người dùng đến màn hình chi tiết đơn hàng của bàn đó.

---

#### 2.4. FR-05: Lưu thông tin đơn hàng trường hợp mất kết nối mạng

* **FR-04.1: Thông tin tổng quan trên cùng**
  * **Mô tả:** Hệ thống phải lưu trữ được thông tin đơn hàng khi mất kết nối, để sau khi có lại kết nối sẽ đồng bộ đơn hàng về server để trong trường hợp mất kết nối người dùng vẫn có thể tương tác và sử dụng phần mềm chính xác.
  * **Giả định:** Đây là trường hợp mất kết nối mạng.
  * **Hành vi:** Các số liệu này phải được cập nhật theo thời gian thực khi có đơn hàng mới được tạo, khách hàng ra về, v.v. sau đó đồng bộ lại dữ liêu lên server.
* **FR-04.2: Thực hiện**
  * **Mô tả:** Phải xây dựng được cơ chế lưu trữ dữ liệu tại local sao cho khi người dùng tương tác hệ thống, chỉnh sửa đơn hàng, vẫn có thể lưu lại, cần phải ràng buộc lại các chức năng tương tác.
  * **Chức năng:** :
    * **Chuyển bàn:** Khóa chức năng chuyển bàn.
    * **Gộp bàn:**  Khóa chức năng gộp bàn.
  * **Hành vi:**
    * Các nút bấm chức năng không được bấm phải làm mờ đi, xám đi.
    * Click vào nút chức năng bị khóa sẽ hiện thông báo mất kết nối.

---

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

* **BR-01:** (Nhắc lại từ URS): Chỉ các bàn ở trạng thái "Trống" mới có thể được chọn để tạo đơn hàng mới.
* **BR-02:** (Nhắc lại từ URS): Một bàn đang phục vụ chỉ có thể được gộp hoặc chuyển sang một bàn khác cũng đang phục vụ hoặc trống.
* **BR-03:** (Nhắc lại từ URS): Khi gộp bàn, tất cả các món từ các đơn hàng được gộp phải được chuyển sang một đơn hàng duy nhất.
* **BR-04:** (Nhắc lại từ URS): Khi tách hóa đơn, tổng tiền của các hóa đơn con phải bằng tổng tiền của hóa đơn gốc.
* **BR-05:** (Nhắc lại từ URS): Thông tin tóm tắt trên ô bàn (số khách, tổng tiền tạm tính, thời gian) phải được cập nhật theo thời gian thực.
* **BR-06:** (Nhắc lại từ URS): Các biểu tượng/màu sắc trạng thái bàn phải nhất quán và dễ hiểu.
* **BR-07:** (Từ URS, cần làm rõ): Ý nghĩa chính xác của các con số nhỏ màu đỏ/xanh trên ô bàn và biểu tượng "đĩa"/"người" phải được định nghĩa rõ ràng trong phần cấu hình hoặc tài liệu liên quan.
* **BR-08:** Chức năng "Chuyển tiền" trong danh sách đơn hàng chờ phải dẫn đến quy trình thanh toán đầy đủ cho đơn hàng đó, bao gồm lựa chọn hình thức thanh toán và in hóa đơn.
* **BR-09:** Khi một bàn được thanh toán hoàn tất, trạng thái của bàn đó phải tự động chuyển về "Trống" và được làm mới trên màn hình.

---

### 5. Phụ lục

* User Requirements Specification (URS) - Màn hình Quản lý Bàn/Khu vực v1.0

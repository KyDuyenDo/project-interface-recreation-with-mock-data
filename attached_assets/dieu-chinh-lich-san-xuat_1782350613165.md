# Tài liệu thiết kế UX/UI — Trang điều chỉnh lịch sản xuất

**Phiên bản:** 1.1  
**Trạng thái:** Draft  
**Liên quan:** Module Lập lịch sản xuất — tách từ Step 6 của wizard 7 bước

---

## 1. Bối cảnh & lý do tách trang

### 1.1 Vấn đề với thiết kế cũ

Trong wizard lập lịch 7 bước, Step 6 ban đầu mang tên "Cập nhật lịch" và đóng hai vai trò khác nhau:

- **Vai trò 1:** Xem lại lịch vừa được hệ thống sắp xếp trước khi lưu (trong wizard).
- **Vai trò 2:** Điều chỉnh lịch đang chạy trong quá trình sản xuất thực tế.

Hai hành động này có ngữ cảnh hoàn toàn khác nhau. Khi planner quay lại Step 6 để điều chỉnh lịch đang chạy, họ bị đặt vào giữa một luồng wizard không còn phù hợp — gây bối rối về vị trí, mục đích, và quy trình lưu.

### 1.2 Quyết định thiết kế

Tách thành hai màn hình độc lập với mục đích rõ ràng:

| Màn hình | Vai trò | Khi nào dùng |
|---|---|---|
| **Step 6 trong wizard** | "Xem lại trước khi lưu" | Trong luồng tạo lịch mới |
| **Trang Điều chỉnh lịch** | "Sửa lịch đang chạy" | Trong quá trình sản xuất |

Vì cả hai màn hình đọc/ghi cùng một bảng dữ liệu, không cần logic đồng bộ phức tạp — thay đổi ở đâu cũng phản ánh ngay lập tức.

### 1.3 Chiến lược lịch: Rolling reschedule với Frozen Zone

Hệ thống áp dụng mô hình **Rolling Reschedule** thay vì lịch hoàn toàn cố định hoặc tái sắp toàn bộ mỗi lần có biến động.

- **Frozen zone (1–2 ngày gần nhất):** Đã vào sản xuất hoặc đã cấp phát vật liệu — không được chỉnh sửa.
- **Flexible zone gần (3–7 ngày tới):** Có thể điều chỉnh nhưng phải giữ trong ràng buộc hiện tại.
- **Flexible zone xa (tuần 2 trở đi):** Có thể sắp lại tự do theo ràng buộc mới.

---

## 2. Chiến lược tái sử dụng component từ Step 6

### 2.1 Tổng quan

Trang Điều chỉnh lịch **không xây dựng lại từ đầu**. Toàn bộ 5 component hiển thị dữ liệu trong Step 6 cũ — Lịch sắp xếp, Bảng chi tiết, Báo cáo ngày, Nối đuôi, Lịch sử — đều được tái sử dụng nguyên xi về logic dữ liệu và giao diện. Thứ thay đổi là **vị trí đặt** và **cách chúng phản ứng với nhau** trong layout mới.

Việc tách trang không tạo ra bản sao của các component — cả Step 6 và trang Điều chỉnh đều trỏ đến cùng một component, đọc/ghi cùng một nguồn dữ liệu. Thay đổi ở trang nào cũng phản ánh ngay ở trang kia.

### 2.2 Bảng tái sử dụng — từng component

| Component (Step 6 cũ) | Vị trí trong trang mới | Thay đổi so với Step 6 |
|---|---|---|
| **Lịch sắp xếp** | Vùng Main — trung tâm | Bật drag & drop (Step 6 chỉ xem). Thêm Frozen Zone. Thêm cảnh báo inline trên block. |
| **Bảng chi tiết** | Right Panel — chế độ mặc định | Thêm đồng bộ hai chiều với lịch (click dòng → highlight block và ngược lại). Thêm filter/sort. Thêm chuyển sang Inspector khi click. |
| **Báo cáo ngày** | Left Panel — tab thứ 2 | Rút gọn thành danh sách mini (mỗi ngày 1 dòng + progress bar). Bấm vào ngày mở drawer thay vì toàn trang. |
| **Nối đuôi** | Left Panel — tab mặc định | Thêm phản hồi real-time khi kéo thả (highlight chuỗi bị ảnh hưởng). |
| **Lịch sử** | Left Panel — tab thứ 3 | Thêm nút hoàn tác từng dòng độc lập. Phân nhóm theo phiên làm việc. |

### 2.3 Các component giữ nguyên hoàn toàn

Những phần sau **không thay đổi gì** khi chuyển sang trang mới — dùng lại component 100%:

- Màu mã hóa loại sản phẩm (nhất quán giữa lịch, nối đuôi, bảng chi tiết).
- Cấu trúc cột của Bảng chi tiết.
- Định dạng dòng log trong Lịch sử.
- Nội dung tooltip trên block đơn ở Lịch sắp xếp.
- Cấu trúc dữ liệu hiển thị trong Báo cáo ngày (thay đổi ở phần bao ngoài, không phải dữ liệu bên trong).

### 2.4 Wrapper mới cho trang Điều chỉnh

Thứ duy nhất được xây mới là lớp bao ngoài:

- **Layout 3 vùng** (Topbar + Left Panel + Main + Right Panel) — container mới, không có trong Step 6.
- **Topbar với KPI pills real-time** — không có trong Step 6.
- **Cơ chế Inspector** trong Right Panel — Step 6 không có chế độ click-để-chỉnh-sửa.
- **Drawer "Xem thay đổi"** (diff so baseline) — mới hoàn toàn.
- **Frozen Zone overlay** trên lịch — logic mới thêm vào component Lịch sắp xếp.

### 2.5 Hàm ý cho phát triển

Developer **không cần refactor** các component hiện tại — chỉ cần:

1. Expose thêm props/events để hỗ trợ các tính năng mới (ví dụ: prop `readOnly` cho Step 6, prop `frozenBefore` cho Frozen Zone, event `onBlockMove` để trigger cập nhật KPI).
2. Xây layout container mới cho trang Điều chỉnh.
3. Kết nối các event giữa các component (click trên Bảng chi tiết → scroll lịch đến block tương ứng).

---

## 3. Đối tượng người dùng

**Planner sản xuất** — người lập và điều phối lịch sản xuất hàng ngày.

**Đặc điểm sử dụng:**
- Làm việc trên màn hình lớn hoặc dual monitor.
- Điều chỉnh lịch theo cả hai cách: kéo thả trực quan trên lịch và nhập tay vào bảng chi tiết.
- Cần xem thông tin Nối đuôi và KPI cùng lúc với lịch khi đang thay đổi.
- Thao tác lặp đi lặp lại nhiều lần trong ngày khi có biến động.

---

## 4. Layout tổng thể

### 4.1 Cấu trúc 3 vùng

```
┌──────────────────────────────────────────────────────────────────────┐
│  TOPBAR — context + KPI nhanh + action buttons            [~52px]    │
├────────────────┬─────────────────────────────────┬───────────────────┤
│                │                                 │                   │
│  LEFT PANEL    │       MAIN — Lịch sắp xếp       │   RIGHT PANEL     │
│  ~280px        │       (Gantt / Calendar)         │   ~320px          │
│  [collapsible] │       flex — phần còn lại        │   [collapsible]   │
│                │                                 │                   │
└────────────────┴─────────────────────────────────┴───────────────────┘
```

Cả Left Panel và Right Panel đều có thể collapse bằng nút mũi tên ở cạnh, giúp mở rộng vùng lịch khi cần không gian.

### 4.2 Nguyên tắc bố cục

- **Chỉnh sửa ở giữa, thông tin bao quanh** — lịch luôn là tâm điểm, các panel hỗ trợ không che khuất.
- **Không điều hướng rời trang** — mọi thông tin chi tiết (đơn theo ngày, lịch sử, so sánh baseline) mở bằng drawer hoặc panel chuyển chế độ, không mở trang mới.
- **Phản hồi tức thì** — mọi thao tác kéo thả cập nhật KPI và bảng chi tiết ngay lập tức, không cần reload.

---

## 5. Vùng 1 — Topbar

### 4.1 Mô tả chung

Topbar cao ~52px, cố định trên cùng, không cuộn theo trang. Chia thành 3 cụm chức năng.

### 4.2 Cụm trái — Context lịch

Hiển thị breadcrumb ngắn xác định planner đang xem lịch nào:

```
Lịch sản xuất  /  Tuần 24 — T2 09/06 đến CN 15/06   ‹  ›
```

- Mũi tên `‹ ›` để chuyển tuần trước/sau.
- Dropdown nhỏ để nhảy đến tuần hoặc tháng cụ thể.
- Badge trạng thái lịch: `Nháp` (xám) / `Đang hiệu lực` (xanh) / `Có thay đổi chưa lưu` (cam).

### 4.3 Cụm giữa — KPI nhanh

4 pill số cập nhật real-time khi có thay đổi:

| Pill | Nội dung | Màu |
|---|---|---|
| Tổng đơn | Tổng số đơn trong tuần đang xem | Mặc định |
| Đúng hạn | % đơn đang đúng deadline | Xanh nếu > 80%, cam nếu 60–80%, đỏ nếu < 60% |
| Trễ | Số đơn đang bị trễ | Đỏ nếu > 0 |
| Công suất | % công suất máy được sử dụng | Cam nếu > 95% (quá tải) |

Khi planner kéo thả một đơn, các pill này thay đổi ngay — đây là phản hồi chính để biết thay đổi có cải thiện lịch hay không.

### 4.4 Cụm phải — Hành động

Các nút theo thứ tự ưu tiên từ trái sang phải:

- **Hoàn tác** (`Ctrl+Z`) — undo bước chỉnh sửa gần nhất. Có thể undo nhiều bước.
- **Xem thay đổi** — mở drawer từ dưới lên hiển thị diff table: danh sách các đơn đã bị dời so với baseline gốc (mã đơn, vị trí cũ, vị trí mới, lý do nếu có).
- **Lưu nháp** — lưu lịch hiện tại ở trạng thái nháp, chưa hiệu lực với sàn sản xuất.
- **Xác nhận lịch** — lưu và áp dụng lịch chính thức. Nút này disable cho đến khi có ít nhất 1 thay đổi. Khi bấm sẽ hiện modal xác nhận nhỏ trước khi ghi.

---

## 6. Vùng 2 — Left Panel: Bảng thông tin hỗ trợ

### 5.1 Mô tả chung

Panel rộng ~280px, nằm bên trái vùng lịch. Chứa các tab thông tin bổ sung mà planner cần xem đồng thời khi điều chỉnh lịch.

Dùng **icon tab dọc** ở cạnh trái panel (thay vì tab ngang thông thường) để tiết kiệm không gian chiều dọc. Hover vào icon sẽ hiển thị tooltip tên tab.

### 5.2 Tab Nối đuôi (mặc định mở)

**Mục đích:** Hiển thị các cụm đơn cùng loại sản phẩm đang chạy liên tiếp trên cùng một máy. Giúp planner tránh xen kẽ nhiều loại không cần thiết (gây tốn thời gian chuyển đổi, vệ sinh máy).

**Nội dung hiển thị:**
- Danh sách theo từng máy, mỗi máy là một nhóm.
- Trong mỗi máy, liệt kê các chuỗi đơn liên tiếp cùng loại, ví dụ: `[Loại A] ĐH-001 → ĐH-003 → ĐH-007` (3 đơn nối đuôi).
- Màu mã hóa theo loại sản phẩm — nhất quán với màu block trên lịch ở vùng giữa.
- Hiển thị tổng thời gian chuyển đổi (changeover) ước tính nếu chuỗi bị phá vỡ.

**Tương tác với lịch:**
- Khi planner kéo một đơn vào giữa một chuỗi đồng loại → chuỗi đó highlight đỏ nhạt trong panel, hiển thị cảnh báo "Xen kẽ — tăng changeover X phút".
- Khi planner ghép hai đơn cùng loại lại với nhau → chuỗi mới highlight xanh nhạt "Nối đuôi tốt".

### 5.3 Tab Báo cáo ngày

**Mục đích:** Xem nhanh tình hình từng ngày trong tuần — đơn nào chạy, máy nào bận, ngày nào có vấn đề.

**Nội dung hiển thị:**
- Danh sách 7 ngày theo hàng dọc, mỗi ngày gồm:
  - Thứ và ngày.
  - Tổng số đơn trong ngày.
  - Mini progress bar thể hiện % công suất của ngày đó (xanh / cam / đỏ theo ngưỡng).
  - Badge nhỏ nếu có đơn trễ trong ngày.

**Tương tác:**
- Bấm vào một ngày → drawer trượt lên từ dưới màn hình, hiển thị bảng chi tiết các đơn của ngày đó (mã đơn, máy, giờ bắt đầu/kết thúc, trạng thái). Không điều hướng rời trang.
- Trong drawer, bấm vào một đơn → lịch ở giữa cuộn đến và highlight block đó.

### 5.4 Tab Lịch sử thay đổi

**Mục đích:** Ghi lại toàn bộ log chỉnh sửa trong phiên làm việc hiện tại và các phiên trước.

**Nội dung hiển thị:**
- Timeline dọc, thứ tự mới nhất trên cùng.
- Mỗi dòng log gồm: thời gian · mô tả thay đổi · người thực hiện.
  - Ví dụ: `14:32 · Dời ĐH-0041 từ T3 14:00 sang T4 08:00, máy M2 · Nguyễn Văn A`
- Phân nhóm theo phiên (phiên hôm nay, phiên hôm qua...).
- Mỗi dòng có nút **Hoàn tác dòng này** để rollback thay đổi đó độc lập, không ảnh hưởng các thay đổi khác (nếu không có dependency).

---

## 7. Vùng 3 — Main: Lịch sắp xếp

### 6.1 Mô tả chung

Vùng trung tâm, chiếm phần còn lại sau khi trừ hai panel. Đây là vùng tương tác chính.

### 6.2 View switcher

Nằm ngay trên lịch, góc trái:

`Tuần` / `2 tuần` / `Tháng`

Mặc định là **Tuần** — phù hợp với điều chỉnh chi tiết theo ngày/giờ. Khi chuyển sang 2 tuần hoặc Tháng, block đơn thu nhỏ nhưng vẫn kéo thả được.

### 6.3 Cấu trúc lịch

- **Trục dọc (Y):** Danh sách máy / dây chuyền sản xuất.
- **Trục ngang (X):** Thời gian (giờ trong ngày nếu view Tuần, ngày nếu view Tháng).
- **Block đơn:** Mỗi đơn sản xuất là một hình chữ nhật màu, chiều rộng tương ứng thời lượng.

**Màu sắc block:**
- Mã hóa theo **loại sản phẩm** — nhất quán với màu trong panel Nối đuôi.
- Viền đỏ nếu đơn đang trễ so với deadline.
- Viền nét đứt nếu đơn thuộc vùng Flexible (có thể kéo).
- Nền block xám nhạt nếu thuộc vùng Frozen (không kéo được).

### 6.4 Frozen Zone

Các cột ngày thuộc Frozen Zone (mặc định 1–2 ngày tính từ hôm nay) hiển thị:
- Nền cột màu xám rất nhạt, phân biệt với các cột thông thường.
- Block đơn trong vùng này không kéo thả được.
- Hover vào block → tooltip "Đang trong sản xuất — không thể thay đổi".
- Label nhỏ ở đầu cột: `Frozen`.

### 6.5 Tương tác với block đơn

**Hover:**
- Tooltip xuất hiện tại chỗ gồm: Mã đơn · Loại SP · Deadline · Thời lượng.

**Click:**
- Right Panel chuyển sang chế độ Inspector, hiển thị chi tiết đơn đó.
- Block được highlight viền đậm hơn.

**Kéo thả (drag & drop):**
- Block có thể kéo sang máy khác hoặc khung giờ khác trong vùng Flexible.
- Trong khi kéo: slot hợp lệ hiển thị nền xanh nhạt, slot không hợp lệ hiển thị nền đỏ nhạt.
- Khi thả vào vị trí vi phạm ràng buộc (máy bảo trì, vượt deadline, trùng slot): block trả về vị trí cũ + hiện thông báo inline nhỏ ngay tại chỗ (không popup chặn).
- Khi thả thành công: KPI trên Topbar cập nhật, bảng chi tiết ở Right Panel cập nhật, log Lịch sử ghi nhận.

**Resize (kéo hai đầu block):**
- Kéo cạnh phải để thay đổi thời lượng dự kiến.
- Kéo cạnh trái để thay đổi giờ bắt đầu.
- Áp dụng tương tự ràng buộc và phản hồi như kéo thả.

### 6.6 Cảnh báo inline

Khi phát hiện vấn đề (không cần planner hỏi), hệ thống hiển thị icon cảnh báo nhỏ ngay trên block đơn bị ảnh hưởng:

| Icon | Ý nghĩa |
|---|---|
| Đồng hồ đỏ | Đơn sắp trễ deadline (< 4 giờ còn lại) |
| Tia chớp cam | Xen kẽ loại — tăng changeover |
| Khóa xám | Máy đang bảo trì trong khung giờ này |

Bấm vào icon → tooltip mở rộng giải thích chi tiết và gợi ý hành động.

---

## 8. Vùng 4 — Right Panel: Chi tiết & Inspector

### 7.1 Mô tả chung

Panel rộng ~320px, nằm bên phải vùng lịch. Hoạt động theo 2 chế độ, chuyển đổi tự động theo hành động của planner.

### 7.2 Chế độ mặc định — Bảng chi tiết

Hiển thị khi không có đơn nào đang được chọn.

**Nội dung:**
Bảng dòng toàn bộ đơn trong tuần đang xem, gồm các cột:

| Cột | Nội dung |
|---|---|
| Mã đơn | Link — click để focus block trên lịch |
| Loại SP | Tên + màu chấm nhỏ |
| Máy | Tên máy được phân |
| Bắt đầu | Ngày giờ bắt đầu |
| Kết thúc | Ngày giờ kết thúc |
| Deadline | Deadline yêu cầu |
| Trạng thái | Badge: Đúng hạn / Rủi ro / Trễ |

**Đồng bộ hai chiều:**
- Planner kéo block trên lịch → dòng tương ứng trong bảng cập nhật ngay (giờ bắt đầu/kết thúc thay đổi, badge trạng thái đổi màu nếu cần).
- Planner click vào một dòng trong bảng → lịch ở giữa cuộn đến và highlight block đó.

**Điều khiển bảng:**
- Sort theo cột: bấm header cột.
- Filter nhanh: 2 dropdown nhỏ ngay trên bảng — lọc theo Máy và theo Trạng thái.
- Tìm kiếm: ô tìm theo mã đơn.

### 7.3 Chế độ Inspector — khi click vào một đơn

Hiển thị khi planner click vào một block trên lịch hoặc click vào một dòng trong bảng chi tiết.

**Header Inspector:**
- Nút `← Về bảng` ở góc trái để quay lại chế độ mặc định.
- Mã đơn và tên loại sản phẩm làm tiêu đề.

**Thông tin đơn (read):**
- Khách hàng / đối tác.
- Loại sản phẩm, quy cách.
- Số lượng.
- Deadline gốc.
- Trạng thái hiện tại.

**Thông tin lịch (editable):**
- Máy được phân — dropdown chọn máy khác.
- Ngày/giờ bắt đầu — date-time picker.
- Thời lượng dự kiến — số giờ, có thể nhập tay.
- Ghi chú điều chỉnh — textarea ngắn.

Sau khi nhập tay, bấm `Cập nhật` để áp dụng. Thay đổi phản ánh ngay lên lịch và KPI topbar.

**So sánh baseline:**
Nút `Xem so với lịch gốc` ở cuối Inspector — mở drawer nhỏ từ phải sang trái chồng lên Inspector, hiển thị bảng 2 cột: Lịch gốc vs Lịch hiện tại cho đơn đang xem.

---

## 9. Luồng UX chính

### 8.1 Luồng vào trang

1. Planner truy cập trang Điều chỉnh lịch từ menu hoặc từ màn hình Lịch sản xuất.
2. Hệ thống tải lịch tuần hiện tại, cuộn lịch đến ngày hôm nay.
3. Các đơn trễ được highlight tự động (viền đỏ).
4. Left Panel mở tab Nối đuôi — planner thấy ngay các chuỗi đang bị xen kẽ.
5. Right Panel hiển thị Bảng chi tiết — planner đọc được tổng quan theo dòng.
6. KPI Topbar hiển thị tình trạng lịch tuần hiện tại.

Planner có bức tranh toàn cảnh ngay khi vào trang, không cần thao tác mở thêm gì.

### 8.2 Luồng điều chỉnh bằng kéo thả

1. Planner thấy đơn bị trễ / xen kẽ bất hợp lý → kéo block trên lịch.
2. Trong khi kéo: slot mục tiêu đổi màu (xanh = hợp lệ, đỏ = không hợp lệ).
3. Thả vào slot hợp lệ:
   - KPI Topbar cập nhật ngay (tỷ lệ đúng hạn, trễ...).
   - Panel Nối đuôi cập nhật chuỗi bị ảnh hưởng.
   - Bảng chi tiết Right Panel cập nhật dòng tương ứng.
   - Lịch sử ghi log thay đổi.
4. Planner quan sát KPI — nếu cải thiện thì giữ, nếu không thì Hoàn tác (`Ctrl+Z`).
5. Lặp lại cho đến khi hài lòng.

### 8.3 Luồng điều chỉnh bằng nhập tay

1. Planner click vào một dòng trong Bảng chi tiết → lịch highlight block đó.
2. Right Panel chuyển sang Inspector.
3. Planner thay đổi máy, giờ bắt đầu, hoặc thời lượng bằng form.
4. Bấm `Cập nhật` → lịch cập nhật, KPI cập nhật, log ghi nhận.
5. Bấm `← Về bảng` để tiếp tục xem bảng chi tiết.

### 8.4 Luồng xem báo cáo ngày

1. Planner mở Left Panel tab Báo cáo ngày.
2. Thấy ngày T4 có thanh công suất đỏ (quá tải).
3. Bấm vào T4 → drawer trượt lên hiển thị danh sách đơn ngày T4.
4. Xác định đơn nào có thể dời → đóng drawer, kéo block đó sang ngày khác.
5. Thanh công suất T4 cập nhật ngay trong tab Báo cáo ngày.

### 8.5 Luồng xem thay đổi & xác nhận

1. Sau khi điều chỉnh xong, planner bấm **Xem thay đổi** trên Topbar.
2. Drawer từ dưới trượt lên hiển thị diff table:
   - Mã đơn | Từ (baseline) | Đến (hiện tại) | Delta thời gian | Ảnh hưởng deadline
3. Planner review — có thể bấm "Hoàn tác" từng dòng trong drawer này nếu muốn.
4. Bấm **Xác nhận lịch** → modal nhỏ xác nhận xuất hiện.
5. Xác nhận → lịch được lưu chính thức, badge trên Topbar đổi sang `Đang hiệu lực`.

---

## 10. Xử lý ràng buộc & cảnh báo

### 9.1 Các ràng buộc được kiểm tra tự động

| Ràng buộc | Hành động khi vi phạm |
|---|---|
| Máy đang bảo trì trong khung giờ | Slot đổi đỏ khi kéo qua, không cho thả |
| Đơn bị đẩy qua deadline | Block đổi viền đỏ, KPI "Trễ" tăng |
| Vượt công suất máy | Icon cảnh báo trên block, pill "Công suất" đổi đỏ |
| Kéo vào vùng Frozen | Không cho thả, tooltip giải thích |
| Xen kẽ loại sản phẩm | Icon cảnh báo changeover, panel Nối đuôi highlight |

### 9.2 Nguyên tắc cảnh báo

- **Không chặn thao tác** — chỉ cảnh báo inline, không popup modal ngăn kéo thả. Planner là người ra quyết định cuối.
- **Cảnh báo tại chỗ** — icon và màu sắc ngay trên block bị ảnh hưởng, không ở góc màn hình.
- **Không lặp cảnh báo** — nếu planner đã thấy cảnh báo và vẫn thực hiện, không hiện lại lần nữa cho cùng thay đổi đó.

---

## 11. Trạng thái block đơn — bảng tham chiếu

| Trạng thái | Màu viền | Màu nền | Kéo được? |
|---|---|---|---|
| Bình thường | Theo loại SP | Theo loại SP (nhạt) | Có |
| Đang chọn | Viền đậm cùng màu | Như bình thường | Có |
| Trễ deadline | Đỏ | Theo loại SP (nhạt) | Có |
| Đang kéo | Nét đứt xanh | Trong suốt nhạt | — |
| Slot mục tiêu hợp lệ | Xanh | Xanh rất nhạt | — |
| Slot mục tiêu không hợp lệ | Đỏ | Đỏ rất nhạt | — |
| Trong Frozen Zone | Xám | Xám nhạt | Không |
| Có cảnh báo | Theo loại SP | Như bình thường + icon | Có |

---

## 12. Mối quan hệ với Step 6 trong wizard

Sau khi tách, Step 6 trong wizard được đổi tên thành **"Xem lại lịch"** và đơn giản hơn:

- Chỉ đọc — không cần kéo thả trong wizard (wizard là luồng tạo mới, không phải vận hành).
- Hiển thị tổng quan lịch vừa được sắp xếp để planner xác nhận trước khi lưu.
- Nút hành động chỉ có: `Lưu nháp` và `Xác nhận lịch chính thức`.
- Nếu planner muốn chỉnh sửa sâu sau khi xem: nút `Mở trong trang Điều chỉnh` → thoát wizard và mở trang này với lịch vừa tạo.

---

## 13. Các điểm cần làm rõ với team phát triển

1. **Đồng bộ real-time:** KPI Topbar và Bảng chi tiết cập nhật sau mỗi drag event hay sau khi thả? (Khuyến nghị: sau khi thả để tránh giật lag khi kéo.)
2. **Undo stack:** Bao nhiêu bước undo được lưu trong một phiên? Có persist qua refresh không?
3. **Conflict resolution:** Nếu hai planner mở cùng lịch và chỉnh đồng thời, hệ thống xử lý thế nào?
4. **Frozen Zone:** Ngưỡng "1–2 ngày" là cứng hay configurable theo từng nhà máy?
5. **Trigger tái sắp tự động:** Hệ thống có gợi ý "sắp lại phần flexible" khi có biến động lớn không, hay planner hoàn toàn thủ công?
6. **Lưu log:** Lịch sử thay đổi lưu bao lâu? Có phân quyền xem log của người khác không?

---

*Tài liệu này mô tả thiết kế UX/UI ở mức wireframe và luồng tương tác. Các quyết định về màu sắc chính xác, typography, và component library sẽ được xác định trong giai đoạn UI Design.*

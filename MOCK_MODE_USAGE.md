# Mock Mode - GA Config Wizard

## Giới thiệu

Mock Mode cho phép bạn **kiểm tra toàn bộ GA Config Wizard mà không cần phải nhập dữ liệu từ các step trước**. Mỗi step được khởi tạo với dữ liệu mock thực tế để có thể di chuyển tự do giữa các step.

## Cách sử dụng

### Cách 1: Bấm nút "Mock Mode" trên trang Lập lịch

1. Đi tới trang "Lập lịch" (http://localhost:5173/runs)
2. Bấm nút **"Mock Mode"** (tím) ở thanh công cụ trên cùng
3. Hệ thống sẽ chuyển sang chế độ mock và hiển thị **tất cả dữ liệu mock** cho Step 1

### Cách 2: Truy cập trực tiếp bằng URL

Bạn có thể truy cập bất kỳ step nào trực tiếp bằng URL:

```
http://localhost:5173/runs/new?mock=true&step=0  # Step 1: Chọn đơn
http://localhost:5173/runs/new?mock=true&step=1  # Step 2: Ưu tiên
http://localhost:5173/runs/new?mock=true&step=2  # Step 3: NVL về
http://localhost:5173/runs/new?mock=true&step=3  # Step 4: Ngày GC
http://localhost:5173/runs/new?mock=true&step=4  # Step 5: Chạy lịch
http://localhost:5173/runs/new?mock=true&step=5  # Step 6: Chỉnh sửa
http://localhost:5173/runs/new?mock=true&step=6  # Step 7: Xác nhận
```

## Dữ liệu Mock

Mock Mode sử dụng dữ liệu được định nghĩa trong file `src/pages/ga-config/mockData.js`:

### Step 1 - Chọn đơn (Orders)
- **5 đơn hàng thường** (ORD001-ORD005)
- **3 đơn hàng gia công** (GC001-GC003)
- Mỗi đơn có article, cutting die, model, quantity, và customer required date

### Step 2 - Ưu tiên (Capacity)
- **Priority Config** được cấu hình cho các model
- Chỉ định chuyền Primary/Secondary cho mỗi dạng giày
- Tích hợp cả regular orders và GC orders

### Step 3 - NVL về (Material ETA)
- Các đơn có ngày dự kiến NVL về
- Ghi đè (override) cho 3 đơn: ORD001, ORD002, GC001

### Step 4 - Ngày GC (GC Dates)
- 2 đơn gia công có ngày bắt đầu và kết thúc gia công
- GC001: 2026-07-25 đến 2026-07-29
- GC002: 2026-08-05 đến 2026-08-09

### Step 5 - Chạy lịch (Run GA)
- Sẽ hiển thị tóm tắt của tất cả dữ liệu được cấu hình
- Khi bấm "Chạy lịch", sẽ gửi yêu cầu tới API (không có mock API)

### Step 6 & 7
- Phụ thuộc vào kết quả từ Step 5

## Tính năng

✅ **Dữ liệu đầy đủ**: Mỗi step có dữ liệu mock hoàn chỉnh để kiểm tra UI/UX
✅ **Không cần backend**: Chế độ mock bỏ qua tất cả API calls cho việc lưu trữ
✅ **Di chuyển tự do**: Có thể jump tới bất kỳ step nào từ step indicator
✅ **Badge hiển thị**: Có badge "Mock Mode" tím để biết đang ở chế độ mock
✅ **Thoát dễ dàng**: Nút "Thoát Mock" ở topbar để quay lại chế độ bình thường

## Giới hạn

⚠️ **Không lưu trữ dữ liệu**: Khi ở mock mode, không có dữ liệu được lưu tới backend
⚠️ **Không có API calls**: Step 5 (Chạy lịch) sẽ fail vì không có backend mock
⚠️ **Chế độ test chỉ**: Mock mode chỉ dành cho testing UI/UX, không dành cho production

## Tùy chỉnh Mock Data

Để chỉnh sửa mock data, sửa file `src/pages/ga-config/mockData.js`:

```javascript
export const MOCK_REGULAR_ORDERS = [
  {
    order_id: "ORD001",
    order: {
      ARTICLE: "XL100",
      // ... các trường khác
    },
  },
  // ... thêm đơn hàng khác
];
```

Sau đó HMR (Hot Module Replacement) sẽ tự động cập nhật browser.

## Ví dụ sử dụng

### 1. Kiểm tra Step 1 với đơn hàng mock
```
http://localhost:5173/runs/new?mock=true&step=0
```

### 2. Kiểm tra Step 3 Material ETA được pre-filled
```
http://localhost:5173/runs/new?mock=true&step=2
```

### 3. Kiểm tra Step 4 GC Dates được pre-filled
```
http://localhost:5173/runs/new?mock=true&step=3
```

## FAQ

**Q: Tại sao mock mode không lưu dữ liệu?**
A: Mock mode bỏ qua tất cả API calls để draft creation, khiến nó chỉ dành cho testing UI mà không có side effects.

**Q: Tôi có thể chỉnh sửa dữ liệu mock rồi chạy lịch thực không?**
A: Không. Mock mode chỉ test UI. Để chạy lịch thực, bạn phải thoát mock mode và nhập dữ liệu thực tế.

**Q: Làm sao để thêm/xóa đơn hàng mock?**
A: Sửa `MOCK_REGULAR_ORDERS` hoặc `MOCK_GC_ORDERS` trong `mockData.js`.

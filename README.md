# Robot 2027 V2.4 Pro — Full-Body Bilingual AI & Data Collector

## 1. Kiến trúc V2.4
- **App Android (Bộ não chính):** Giao diện nhân vật Full-Screen đa hành động (`THINK_PACING` đi qua đi lại suy nghĩ, `THINK_CHIN` chống cằm, `SIT_PONDER` ngồi suy tư...), khung chat kéo thả kiểu Messenger (kéo 360° trên iPad, trượt lên/xuống trên điện thoại), đám mây suy nghĩ `💭 •••` kèm giọng trấn an 2 nhịp cho model 100MB–1GB+, bộ nhớ 2 thành phần (`sum` siêu ngắn + `full` đầy đủ) với 3 mức `Ngắn / Trung bình / Dài`, tự động chuyển đổi Việt ⇄ Anh, 4–5 lựa chọn mở hướng liên tục, và bộ gắn nhãn 1.000+ chủ đề.
- **Backend (`https://khotrithucso.io.vn/robot2027_2_4/index.php`):** 1 file PHP duy nhất, không dùng SQL, tự sinh `.htaccess` và lưu dữ liệu phân mảnh `.txt` (JSONL) theo `Word ID` và `Topic`, bảo vệ bằng chữ ký `HMAC-SHA256` nhúng trong mã máy C++.

## 2. Hướng dẫn Build APK tự động trên GitHub Actions
1. Tạo repository mới trên GitHub và đẩy toàn bộ thư mục này lên nhánh `main`.
2. Vào tab **Actions** trên GitHub để theo dõi tiến trình build tự động (~2 phút).
3. Đăng nhập tài khoản GitHub và tải file **`Robot2027-v2.4-apk`** trong mục **Artifacts** về cài lên điện thoại/tablet Android.

## 3. Cài đặt Model GGUF (100MB - 1GB+)
- Tải các model chuẩn như `Qwen2.5-0.5B-Instruct-Q4_K_M.gguf` (~390MB), `Llama-3.2-1B-Instruct-Q4_K_M.gguf` (~750MB), hoặc `Qwen2.5-1.5B-Instruct-Q4_K_M.gguf` (~1.05GB) vào thư mục `Download` trên điện thoại.
- Mở App $ightarrow$ bấm nút **⚙️ Cài đặt & Model** $ightarrow$ bấm **Quét file .gguf trên máy** $ightarrow$ chọn model và bấm **Nạp vào Não Robot**.

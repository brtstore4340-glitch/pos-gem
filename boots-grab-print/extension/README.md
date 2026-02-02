# Grab Print Chrome Extension

Chrome Extension สำหรับดึงข้อมูลคำสั่งซื้อจาก Grab Merchant Dashboard และพิมพ์ใบเสร็จ/ฉลาก

## Features

- **Auto-detect New Orders**: ตรวจจับคำสั่งซื้อใหม่อัตโนมัติผ่าน DOM observation
- **Popup Notifications**: แจ้งเตือนเมื่อมีคำสั่งซื้อใหม่
- **Print Preview**: ดูตัวอย่างก่อนพิมพ์
- **Thermal Printer Support**: รองรับกระดาษ 58mm และ 80mm
- **Dual Stub Label**: พิมพ์ฉลากแบบ 2 ส่วน (สำหรับ driver และ kitchen)
- **QR Code**: รองรับ QR code สำหรับ booking code

## Installation

1. เปิด Chrome และไปที่ `chrome://extensions/`
2. เปิด **Developer mode** (มุมขวาบน)
3. กด **Load unpacked**
4. เลือกโฟลเดอร์ `boots-grab-print/extension`

## Usage

### การใช้งานพื้นฐาน

1. เปิดหน้า [Grab Merchant Dashboard](https://merchant.grab.com)
2. กดไอคอน **GRAB PRINT** ที่ toolbar ของ Chrome
3. กด **Scan Orders** เพื่อโหลดรายการคำสั่งซื้อวันนี้
4. กด **พิมพ์** ที่คำสั่งซื้อที่ต้องการ

### การตั้งค่า

1. กดปุ่ม **Settings**
2. ตั้งค่า:
   - **branchId**: รหัสสาขา
   - **token**: Token สำหรับ API (ถ้ามี)
   - **pollingInterval**: ช่วงเวลาตรวจสอบคำสั่งซื้อใหม่ (วินาที)
   - **storeName**: ชื่อร้าน (แสดงบนใบเสร็จ)
   - **printerWidth**: ขนาดกระดาษ (58mm หรือ 80mm)

## File Structure

```
extension/
├── manifest.json          # Extension configuration
├── popup.html            # Main popup UI
├── print-preview.html    # Print preview (receipt)
├── label-print.html      # Dual stub label print
├── options.html          # Settings page
├── css/
│   └── print.css         # Thermal print styles
├── src/
│   ├── content.js        # DOM observation & extraction
│   ├── background.js     # Notifications & alarms
│   ├── popup.js          # Orders list & print actions
│   ├── options.js        # Settings management
│   ├── storage.js        # Storage utilities
│   ├── print-template.js # Receipt template renderer
│   ├── print-preview.js  # Print preview handler
│   ├── label-print.js    # Label print handler
│   └── print-template.js # Receipt rendering
└── icons/                # Extension icons
```

## Print Templates

### Receipt (ใบเสร็จ)
- ขนาด: 58mm หรือ 80mm
- ข้อมูล: Header, ข้อมูลคำสั่งซื้อ, รายการสินค้า, รวมเงิน, หมายเหตุ

### Dual Stub Label (ฉลาก 2 ส่วน)
- ขนาด: 80mm
- ส่วนบน: ปกติ (สำหรับ driver)
- ส่วนล่าง: พลิกกลับ 180° (สำหรับ kitchen)
- มี QR code สำหรับ booking code

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/jobs/ingest` | POST | ส่งข้อมูลคำสั่งซื้อไปยังระบบ |

## Permissions

- `tabs`: เข้าถึง tab ของ Grab Merchant
- `storage`: บันทึกการตั้งค่าและสถานะการพิมพ์
- `scripting`: inject content script
- `alarms`: ตั้งเวลาตรวจสอบคำสั่งซื้อ
- `notifications`: แจ้งเตือนเมื่อมีคำสั่งซื้อใหม่
- `activeTab`: เข้าถึง tab ที่ active

## Browser Support

- Google Chrome (Manifest V3)
- Microsoft Edge (Chromium)

## License

MIT License

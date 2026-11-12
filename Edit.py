import os
import requests
from pathlib import Path
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# 1. ตั้งค่า
BASE_URL = "https://raw.githubusercontent.com/dragogodev/cgs/master/Cardfight%20Vanguard"
SAVE_DIR = Path("vanguard_images")

SAVE_DIR.mkdir(exist_ok=True)

# 2. ตั้งค่าการเชื่อมต่อและ Retry
session = requests.Session()

retry = Retry(
    total=3,
    backoff_factor=1,
    status_forcelist=[429, 500, 502, 503, 504],
    allowed_methods=["GET"]
)

session.mount("https://", HTTPAdapter(max_retries=retry))
session.headers.update({"User-Agent": "Mozilla/5.0"})


# 3. ดาวน์โหลด JSON
def get_json(url):
    response = session.get(url, timeout=30)
    response.raise_for_status()
    return response.json()


# 4. เริ่มดาวน์โหลด
try:
    all_sets = get_json(f"{BASE_URL}/AllSets.json")
except (requests.RequestException, ValueError) as e:
    print(f"ไม่สามารถโหลดรายชื่อชุดการ์ด: {e}")
    raise SystemExit(1)

success = 0
skipped = 0
failed = 0

print(f"พบชุดการ์ดทั้งหมด {len(all_sets)} ชุด")

# 5. วนลูปชุดการ์ด
for s in all_sets:

    set_code = s.get("code")

    if not set_code:
        continue

    try:
        set_data = get_json(f"{BASE_URL}/sets/{set_code}.json")
    except (requests.RequestException, ValueError) as e:
        print(f"โหลดข้อมูล {set_code} ไม่สำเร็จ: {e}")
        failed += 1
        continue

    # แยกโฟลเดอร์ตามชุดการ์ด
    set_folder = SAVE_DIR / set_code
    set_folder.mkdir(parents=True, exist_ok=True)

    print(f"\nกำลังดาวน์โหลด: {set_code}")

    # 6. วนลูปการ์ดแต่ละใบ
    for card in set_data:

        img_url = card.get("image_url")
        card_num = card.get("number")

        if not img_url or not card_num:
            skipped += 1
            continue

        # ตั้งชื่อไฟล์
        card_num = str(card_num).replace("/", "_")
        save_path = set_folder / f"{card_num}.png"

        # ข้ามรูปที่มีอยู่แล้ว
        if save_path.exists():
            skipped += 1
            continue

        try:
            # ดาวน์โหลดรูปภาพ
            response = session.get(img_url, timeout=30)
            response.raise_for_status()

            # ตรวจสอบว่าเป็นรูปภาพ
            if not response.headers.get("Content-Type", "").startswith("image/"):
                failed += 1
                print(f"ไม่ใช่ไฟล์รูปภาพ: {card_num}")
                continue

            # บันทึกไฟล์
            save_path.write_bytes(response.content)

            success += 1
            print(f"สำเร็จ: {set_code}/{card_num}.png")

        except (requests.RequestException, OSError) as e:
            failed += 1
            print(f"ล้มเหลว: {card_num} - {e}")


# 7. สรุปผล
print("\n========== DOWNLOAD SUMMARY ==========")
print(f"ดาวน์โหลดสำเร็จ : {success}")
print(f"ข้ามรายการ      : {skipped}")
print(f"ดาวน์โหลดล้มเหลว : {failed}")
print("======================================")
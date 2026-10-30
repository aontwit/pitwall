---
playbook: drive
---

## ทำอะไร

`/pitwall:drive` สตาร์ต loop: รัน `/pitwall:lap` ต่อกันไปเรื่อยๆ โดยแต่ละ lap ตั้งคิว lap ถัดไปเอง จนกว่า queue จะว่างหรือคุณสั่งหยุด ตัว drive ไม่ได้ทำ task เอง มันรันเช็กด้านล่าง เขียน state ของ loop แล้วส่งต่อให้ lap แรก

## ใช้เมื่อ

- queue พร้อมแล้วและตอบคำถามครบแล้ว
- กำลังจะลุกจากเครื่องไปสักพัก หรือทิ้งไว้ทั้งคืน

## ลองใช้

```text
/pitwall:drive              start with the first pickable task
/pitwall:drive P2-05        start with this task (it must be in the queue)
```

ระหว่างที่ loop วิ่ง อย่าทำงานใน checkout นี้ เพราะมันสลับ branch อยู่ในนั้น

## ก่อนเริ่ม

drive จะไม่ยอมเริ่ม และบอกเหตุผล ถ้า:

- repo ยังไม่มี profile (รัน `/pitwall:init` ก่อน)
- working tree มีของที่ยังไม่ commit (commit หรือ stash ก่อน)
- `gh` ยังไม่ได้ sign in หรือยังไม่ได้ลง dependencies
- ใน queue ไม่มี task ที่หยิบได้ เพราะ blocked หมดหรือรอ merge อยู่ (รัน `/pitwall:queue` ก่อน หรือตอบคำถามที่ค้างอยู่)
- ใน [lead mode](../parallel-laps/) มี session อื่นยังเป็น lead อยู่ หรือมี worker ที่ brake ทิ้งไว้รออยู่ ขณะที่ `parallel` กลับมาเป็น 1 แล้ว (ตั้งให้มากกว่า 1 อีกครั้งเพื่อให้ worker พวกนั้นทำต่อ)

มันจะเริ่ม แต่เตือนคุณ ถ้า browser ใน profile ต่อไม่ติด (เช็กที่ใช้ browser จะรอไว้ และ task แบบ bug-fix จะถูก park) หรือ tool ของ tracker ยังไม่ได้เชื่อม (task จะไม่ถูกบันทึก)

## จะเห็นอะไร

ตัวอย่างมาจาก repo สมมติชื่อ `acme/shop`

```text
Loop started · 4 tasks in the queue
  Each round: pick from the queue → work → /pitwall:gauge → review → PR. No merges, no questions; stuck → park and move on.
  While it runs, don't work in this checkout.
  Stop with /pitwall:stop (after this task) or /pitwall:brake (now).
```

ถ้าตั้ง [`merge: auto`](../auto-merge/) ไว้ ข้อความตอนเริ่มก็ยังเขียนว่า "No merges" แต่ตอน sync ต้น round อาจ merge PR ที่เสร็จแล้วหนึ่งตัวเข้า dev branch

ถ้าใน profile ตั้ง `parallel` มากกว่า 1 ข้อความจะมีเพิ่มอีกบรรทัด: รัน task พร้อมกันได้สูงสุดเท่าค่านั้น แต่ละ task อยู่ใน worktree และ branch ของตัวเอง และ session นี้เป็น lead ([lead mode](../parallel-laps/))

หลังจากนั้นจะได้รายงาน round ละหนึ่งอัน แบบเดียวกับใน[หน้า lap](../lap/) round ที่คุณไม่ได้สั่งเองแล้วเปิด PR, park task หรือหยุด loop จะส่ง push notification มาหนึ่งครั้งด้วย ถ้าเครื่องคุณตั้งไว้ พอ queue ว่าง loop จะกลับมาเช็กทุก 30 นาทีว่ามี PR ไหน merge แล้วบ้าง

## หยุด

- `/pitwall:stop` ทำ task ที่ค้างอยู่ให้จบก่อน แล้วค่อยหยุด
- `/pitwall:brake` หยุดทันทีและเซฟงานเป็น WIP commit `/pitwall:drive` ครั้งถัดไปจะทำต่อจากตรงนั้น

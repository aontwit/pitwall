---
playbook: stop
---

## ทำอะไร

`/pitwall:stop` จบ loop หลัง task ปัจจุบันเสร็จ ถ้ามี task ทำอยู่ มันจะไม่ไปยุ่ง ปล่อยให้ round นั้นทำจนจบและเปิด PR แล้ว loop ค่อยหยุดเอง ถ้าอยู่ระหว่าง round จะหยุดทันที ใน [lead mode](../parallel-laps/) จะไม่เริ่ม worker ใหม่ ตัวที่รันอยู่ทำ PR ของตัวเองให้เสร็จ (หรือ park ไว้) แล้ว loop หยุดเมื่อไม่เหลือ worker สักตัว

ถ้าตั้ง [`merge: auto`](../auto-merge/) ไว้ คำสั่งนี้จะหยุดการ merge ด้วย ตั้งแต่ตอนนั้นจะไม่มี PR ไหน merge เข้า dev branch รวมถึง round เดี่ยวที่สั่งด้วย `/pitwall:lap` จนกว่า `/pitwall:drive` จะเริ่ม loop ใหม่ PR ที่ merge ไปแล้วก็ยังอยู่เหมือนเดิม

## ใช้เมื่อ

- อยากให้ loop จบ แต่ให้ task ปัจจุบันออกเป็น PR ก่อน
- กลับมาแล้ว และอยากได้ checkout คืนหลัง task นี้จบ

ถ้าจะหยุดกลาง task ให้ใช้ `/pitwall:brake`

## ลองใช้

```text
/pitwall:stop
```

## จะเห็นอะไร

ตัวอย่างมาจาก repo สมมติชื่อ `acme/shop` ตอนที่มี task ทำอยู่:

```text
Will stop after P2-05 finishes (currently at step reviewing).
```

ถ้าอยู่ระหว่าง round จะได้สรุปการรันทั้งหมด:

```text
Loop stopped
Done
  P2-04  #58   PARTIAL
  P2-07  #59   VERIFIED
Parked
  P2-05  agent/p2-05-saved-card  the plan does not say what happens when the saved card has expired
```

ตอนหยุด มันจะอ่าน session ด้วยว่ามีเรื่องไหนที่คุณพูดซ้ำบ่อย และจะบอกก็ต่อเมื่อเจออะไรใหม่

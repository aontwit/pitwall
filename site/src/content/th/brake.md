---
playbook: brake
---

## ทำอะไร

`/pitwall:brake` หยุด loop ทันที ขั้นแรกจะยกเลิก round ถัดไป จากนั้นเซฟ task ที่ยังไม่เสร็จเป็น WIP commit บน branch ของมัน (ถ้า hook ไม่ยอมให้ commit ก็ใช้ stash แทน) แล้วสลับกลับไปที่ base ไม่มีอะไรถูกทิ้ง และไม่มีการเปิด PR ไม่ push ด้วย ยกเว้น profile ตั้งให้ส่งงานต่อระหว่างเครื่อง กรณีนั้นจะ push WIP branch ขึ้นไปให้อีกเครื่องทำต่อได้

ใน [lead mode](../parallel-laps/) จะหยุด worker ทุกตัว แล้วเซฟแต่ละ worktree ที่ step ล่าสุดที่รู้ เป็น WIP commit (หรือ stash) บน branch ของตัวเอง โดยไม่สลับ branch พอสั่ง `/pitwall:drive` ครั้งถัดไป แต่ละตัวจะได้ทำต่อใน worker ตัวใหม่

ถ้าตั้ง [`merge: auto`](../auto-merge/) ไว้ คำสั่งนี้จะหยุดการ merge ด้วย ตั้งแต่ตอนนั้นจะไม่มี PR ไหน merge เข้า dev branch รวมถึง round เดี่ยวที่สั่งด้วย `/pitwall:lap` จนกว่า `/pitwall:drive` จะเริ่ม loop ใหม่ PR ที่ merge ไปแล้วก็ยังอยู่เหมือนเดิม

## ใช้เมื่อ

- ต้องการ checkout คืนเดี๋ยวนี้
- round กำลังไปในทางที่คุณไม่ต้องการ

ถ้าอยากให้ task ปัจจุบันจบก่อน ให้ใช้ `/pitwall:stop`

## ลองใช้

```text
/pitwall:brake
```

## จะเห็นอะไร

ตัวอย่างมาจาก repo สมมติชื่อ `acme/shop`

```text
Stopped P2-05 Pay with a saved card
  step    coding
  branch  agent/p2-05-saved-card
  saved   commit "wip: P2-05 stopped at coding"
Done      P2-04 #58 PARTIAL
Parked    none
Continue  /pitwall:drive resumes P2-05 from this step
```

ถ้าใช้ tracker ด้วย task จะได้ comment บอกว่าหยุดตรงไหนและเซฟงานไว้แบบไหน สถานะยังเป็น in progress เหมือนเดิม

## ทำต่อ

สั่ง `/pitwall:drive` round แรกจะหยิบ task ที่หยุดไว้มาทำต่อบน branch เดิม จาก step ที่ค้างไว้

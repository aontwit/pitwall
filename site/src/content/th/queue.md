---
playbook: queue
---

## ทำอะไร

`/pitwall:queue` เลือก task ที่ agent ทำจบได้เองคนเดียว ใส่ลง queue ของ loop แล้วถามคำถามที่ค้างทั้งหมดกับคุณครั้งเดียว เป็นช่องให้ติ๊ก พอติ๊กเสร็จ `/pitwall:drive` ก็วิ่งได้ทั้งคืนโดยไม่ต้องถามอีก

## ใช้เมื่อ

- plan PR ที่เพิ่ง merge มี row ใหม่
- อยากดูว่าอะไรพร้อมบ้างโดยไม่เปลี่ยนอะไรเลย (`dry`)
- มี task เข้ามาที่ยังไม่อยู่ใน plan: เล่าเป็นคำพูด แล้วมันจะกลายเป็น plan row

## ลองใช้

```text
/pitwall:queue                 both sources: the plan's unticked rows and the tracker's open tasks
/pitwall:queue dry             the table only, the queue is not touched
/pitwall:queue 2.6 2.7         these plan rows
/pitwall:queue add a price sort to search
/pitwall:queue remove 2.7
```

queue เก็บอยู่ใน state ของ loop มันไม่แก้ไฟล์ใน repo และไม่แตะ tracker

## เช็กหกข้อ

task จะเข้า queue ก็ต่อเมื่อผ่านครบทั้งหกข้อ:

<ol class="steps">
<li><strong>เขียน brief ได้</strong> row ระบุไฟล์และมี "Done when" ที่ตรวจได้</li>
<li><strong>พิสูจน์ได้อัตโนมัติ</strong> checks หรือ browser แสดงได้ว่าใช้งานได้จริง การจ่ายเงินจริงหรืออะไรที่ย้อนกลับไม่ได้ให้คุณเป็นคนทำ</li>
<li><strong>ไม่มีการตัดสินใจค้าง</strong> ถ้ามีค้าง ต้องเป็นเรื่องที่คุณตอบได้ด้วยการติ๊กช่องใน briefing</li>
<li><strong>ไม่ต้องรอคนนอกทีม</strong> ไม่มีค่าไหนที่ยังรอจาก backend, design หรือ ops</li>
<li><strong>จบได้ใน round เดียว</strong> ราว 90 นาทีและแปดไฟล์ งานที่ใหญ่กว่านั้นแต่วัดผลได้ ทำซ้ำเป็น round เล็กๆ ได้</li>
<li><strong>ไม่ทับกัน</strong> ไม่ทับกับ PR ที่เปิดอยู่ หรือไฟล์ที่ task อื่นจะแตะ</li>
</ol>

## จะเห็นอะไร

ตัวอย่างมาจาก repo สมมติชื่อ `acme/shop` อย่างแรกคือตาราง ก่อนที่อะไรจะเปลี่ยน:

| id | source | result | playbook | reason | failed | waiting for |
|---|---|---|---|---|---|---|
| P2-04 | plan | pass | feature | brief complete, proof at level B | | |
| P2-05 | plan | pass | feature | one question for the briefing | | |
| P2-06 | plan | fail | | tax rates come from the finance team | 4 | finance |
| P2-07 | plan | pass · repeat | ratchet | 212 lint warnings, one batch per round | | |
| P2-08 | plan | pass | bug-fix | the sort is wrong on a phone | | P2-04 merged |

จากนั้นคือ briefing พร้อมค่า default ที่แต่ละ task จะใช้ถ้าคุณไม่ตอบ:

```text
P2-05 Pay with a saved card
  What happens when the saved card has expired?
  ● Ask for a new card before paying (recommended)
  ○ Fall back to entering the card by hand
  ○ Wait: leave the task blocked
```

ถ้าตอบ "wait" หรือข้ามคำถามไป task นั้นจะยัง blocked อยู่ และ `/pitwall:queue` ครั้งหน้าจะถามอีก ค่า default ที่ loop เลือกเองจะขึ้นในแต่ละ PR ใต้หัวข้อ "Decisions to confirm"

## ขั้นต่อไป

รัน `/pitwall:lap` ถ้าจะทำ task เดียว หรือ `/pitwall:drive` ถ้าจะทำทั้ง queue

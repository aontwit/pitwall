---
playbook: plan
---

## ทำอะไร

`/pitwall:plan` อยู่ต้นทางของ loop มันสัมภาษณ์คุณเป็น round สั้นๆ ด้วยคำถามแบบติ๊กช่อง แล้วจดทุกคำตอบลง spec หรือ plan ก่อนขึ้น round ถัดไป ผลสุดท้ายคือ plan row ที่ `/pitwall:queue` หยิบไปทำได้ ส่งมาเป็น PR ที่แก้แค่ docs ให้คุณ merge เอง มันไม่เขียนโค้ดเลย

## ใช้เมื่อ

- repo ใหม่ที่ยังไม่มี spec
- phase ถัดไปใน plan ยังเขียนว่า `TBD`
- มีการตัดสินใจที่เปลี่ยนไป และ spec กับ row ต้องแก้ตาม

## ลองใช้

```text
/pitwall:plan                      choose the mode itself
/pitwall:plan phase-3              open that phase
/pitwall:plan prices now include tax
```

มันเลือก mode เองจากสิ่งที่เจอ: new ถ้ายังไม่มี spec (วางแผนทั้ง product) phase ถ้ามี phase ที่ยังเป็น `TBD` และ amend ถ้าคุณเล่าการตัดสินใจเป็นคำพูด

## ทำงานยังไง

<ol class="steps">
<li><strong>อ่านก่อน</strong> อ่าน spec, plan, กฎของ repo และคำถามที่ตอบไปแล้ว อะไรที่ไฟล์ตอบได้อยู่แล้วจะไม่ถามเลย</li>
<li><strong>ถามเป็น round</strong> round ละสองสามข้อ คำตอบที่แนะนำอยู่ข้อแรก และทุกตัวเลือกบอกว่าจะมีผลกับ plan ยังไง ถามเฉพาะข้อที่เรื่องที่ต้องรู้ก่อนลงตัวแล้ว ส่วนคำถามที่เปลี่ยนภาพรวมทั้งหมดจะได้ round ของมันเอง</li>
<li><strong>จดไปพร้อมกัน</strong> การตัดสินใจเรื่อง product ลง spec พร้อมกำกับ <code>(owner &lt;date&gt;)</code> ส่วนเรื่องลำดับและ process ลงตาราง answered ใน plan ไม่มีอะไรค้างอยู่แค่ในแชต</li>
<li><strong>เขียน row</strong> ทุก row อ้าง section ใน spec ระบุไฟล์ที่แตะ (ไม่เกินราวแปดไฟล์) และมี "Done when" ที่ตรวจได้ row ที่ต้องรอ verdict จากคนจะกลายเป็น gate row</li>
<li><strong>เปิด PR</strong> PR นี้แก้แค่ docs และมีตารางบอกว่าแต่ละการตัดสินใจไปลงที่ไหน วันที่เท่าไร คุณ merge เอง แล้วค่อยรัน <code class="cmd">/pitwall:queue</code></li>
</ol>

## จะเห็นอะไร

ตั้งแต่ round ที่สองไป ทุก round จะขึ้นต้นด้วยสรุปที่คุณแก้ได้ ตัวอย่างนี้มาจาก repo สมมติชื่อ `acme/shop`

```text
Last round
  · v1 sells to logged-in customers only (owner, 2026-10-11)
  · prices are shown with tax included
  · phase 2 ends when search and checkout pass on a phone

Q1  Is this right?
    ● Yes, continue (recommended)   ○ Change something
Q2  How should search sort by default?
    ● Relevance (recommended): the row adds a relevance score
    ○ Newest first: no score, simpler row
```

row ที่มันเขียนลง plan:

```text
| P2-04 | Sort search results by price | src/search/sort.ts, src/search/sort.test.ts |
  Done when: low → high and high → low both order correctly; equal prices keep newest first · spec §4.2
```

## ขั้นต่อไป

Merge plan PR แล้วรัน `/pitwall:queue` เรื่องที่ยังไม่ได้ตัดสินจะยังติดป้าย open ไว้ ส่วน phase ที่ยังไม่พร้อมจะยังเป็น `TBD` queue เลยข้ามไป

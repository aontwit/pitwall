---
playbook: parallel-laps
---

## ทำอะไร

ถ้า `parallel` ใน profile มากกว่า 1 session นี้จะกลายเป็น lead แทนที่จะทำ task เดียวใน checkout นี้ มันจะส่งแต่ละ task ให้ worker ที่รันอยู่เบื้องหลัง worker แต่ละตัวรัน [lap](../lap/) เต็มรอบตั้งแต่ Branch จนถึง PR ใน git worktree และ branch ของตัวเอง ถ้าไม่มี `parallel` หรือตั้งเป็น 1 lap จะทำทีละ task ใน checkout นี้ตามปกติ

> Lead mode ยังพิสูจน์ไม่ครบ มี batch จริงหนึ่งครั้งบน repo ของ pitwall (0.7.0) ที่เปิด PR สองตัวคู่กันได้ แต่ยังไม่เคยรันกับ backend ที่ตรึง port ไว้ และยังไม่เคยถูก stop หรือ brake ระหว่างที่ worker ทำงานอยู่ ลองใช้กับ repo ที่ถ้า round ค้างแล้วไม่เสียหายมาก

## lead ทำอะไรบ้าง

<ol class="steps">
<li><strong>เลือก batch.</strong> หยิบ task จาก queue ได้สูงสุด <code>parallel</code> ตัว โดย plan row ของแต่ละตัวต้องไม่ใช้ไฟล์ร่วมกัน ไฟล์ที่ loop resolve conflict เองอยู่แล้ว เช่น plan file หรือ <code>CHANGELOG.md</code> ไม่นับ task ที่ใช้ไฟล์ร่วมกันจะรอจน worker ของ task แรกเสร็จ (เปิด PR แล้วหรือ park ไปแล้ว) task ที่มาจาก tracker และไม่มี plan row จะไม่ถูกจัดเข้า batch แต่จะรันทีละตัวใน checkout นี้ตอนที่ไม่มี worker ทำงานอยู่</li>
<li><strong>เริ่ม worker หนึ่งตัวต่อหนึ่ง task.</strong> worker แต่ละตัวได้ brief กับ worktree และ branch ของตัวเอง แล้วทำ task จนเปิด PR ได้ (code, check, browser, review panel และ verifier) ภายใต้กฎเดียวกับ round แบบทีละ task worker ที่เรียก reviewer เองไม่ได้จะส่ง task คืน แล้ว lead จะรัน review panel, verifier และเปิด PR ให้แทน worker ใช้ agent และ model ของ code role ใน profile</li>
<li><strong>จดบัญชี.</strong> lead เป็นตัวเดียวที่เขียน loop state และ tracker worker ส่งทุกอย่างกลับมาใน report แล้ว lead เป็นคนบันทึก worker สองตัวจึงไม่มีทางเขียนไฟล์เดียวกัน worker ที่ park ก็ park แค่ task ของตัวเอง ตัวอื่นทำต่อตามปกติ</li>
<li><strong>ใช้ dev server ร่วมกัน.</strong> ถ้าตั้ง <code>port: fixed</code> จะมี dev server ตัวเดียวรันบน port ใน profile และ worker ผลัดกันใช้ ถ้าตั้ง <code>port: free</code> แต่ละ worktree รัน server ของตัวเองบน port ว่างถัดไป แต่ขั้นที่ต้อง sign in ยังต้องผลัดกันอยู่ เพราะ browser ตัวเดียวใช้ cookie ร่วมกันทุก port ส่วน pair run และขั้นที่ต้องให้คนทำ lead จะรันเองทีละอย่าง เพราะ lead เป็นตัวเดียวที่คุยกับคุณ</li>
<li><strong>เติมงานและ report.</strong> ถ้าสั่งผ่าน <code>/pitwall:drive</code> พอ worker ตัวไหนเสร็จ lead จะหยิบ task จาก queue มาเติมช่องนั้นใน turn เดียวกัน ถ้าคุณพิมพ์ <code>/pitwall:lap</code> เอง จะรัน batch เดียวแล้ว report เมื่อ worker ตัวสุดท้ายเสร็จ worker ที่ยังรันอยู่หลัง 180 นาทีจะถูกหยุดและ park พอไม่เหลือ worker แล้ว จะมี report เดียวสรุปทั้ง batch</li>
</ol>

lead มีได้ทีละ session เดียว ถ้า session ที่สองเจอ lead ที่ active อยู่ภายในชั่วโมงที่ผ่านมา มันจะไม่เริ่มอะไรเลยและบอกคุณ

## สิ่งที่จะเห็น

ได้ PR หนึ่งตัวต่อหนึ่ง task แต่ละตัวมี Verify table และ verdict ของตัวเอง เหมือน round แบบทีละ task ระหว่างที่ worker ทำงาน lead จะบอกว่าเริ่ม worker ตัวไหนไปแล้ว task ไหนที่ยังไม่ได้หยิบ และเพราะอะไร:

```text
Started  P2-04 · P2-07, each in its own worktree
Waiting  P2-06 shares src/search/sort.ts with P2-04
```

เมื่อ worker ตัวสุดท้ายของ `/pitwall:lap` ที่คุณพิมพ์เองเสร็จ report ของ round จะมีหนึ่งแถวต่อหนึ่ง task (ข้อความจริงอาจต่างไปบ้าง):

```text
Lap · batch of 2
P2-04   https://github.com/acme/shop/pull/58   [PARTIAL]
P2-07   https://github.com/acme/shop/pull/59   VERIFIED
Parked  none
Waiting P2-06 shares src/search/sort.ts with P2-04
```

## stop และ brake ตอน worker ยังทำงานอยู่

- `/pitwall:stop` ไม่เริ่ม worker ใหม่ ตัวที่รันอยู่จะทำ PR ให้เสร็จหรือ park แล้ว loop จะหยุดเมื่อไม่เหลือ worker
- `/pitwall:brake` หยุด worker ทุกตัวทันที และเซฟแต่ละ worktree เป็น WIP commit บน branch ของมัน (ถ้า hook ไม่ยอมก็เก็บเป็น stash) `/pitwall:drive` ครั้งถัดไปจะ resume แต่ละตัวใน worker ใหม่ ต่อจากขั้นที่ค้างไว้ ถ้า `parallel` ถูกตั้งกลับเป็น 1 แล้ว drive จะไม่ยอมรันและบอกชื่อ task ที่รออยู่

## วิธีเปิดใช้

ใน profile `.claude/agent-loop.md` ตั้งเพดานไว้ใต้ `agents per task` และระบุใต้ `level B` ว่าแต่ละ worktree รัน dev server ของตัวเองได้หรือไม่:

```markdown
## agents per task

`parallel: 2`

## level B (browser)

| | |
|---|---|
| dev server | `npm run dev` on port `3000` · `port: free` |
```

ถ้า backend รับ origin ได้แค่ตัวเดียว ให้ไม่ใส่ `port` หรือเขียน `port: fixed` จากนั้นรัน `/pitwall:doctor` ซึ่งจะ fail ถ้า `parallel` ไม่ใช่จำนวนเต็มตั้งแต่ 1 ขึ้นไป หรือ `port` ไม่ใช่ `fixed` หรือ `free` แล้ว commit profile เข้า base ก่อนรัน `/pitwall:drive` ครั้งถัดไป

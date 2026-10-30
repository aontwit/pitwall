---
playbook: readme
---

## pitwall คืออะไร

pitwall เป็น plugin ของ Claude Code ที่เอา backlog ของคุณมารันเป็น loop คุณวาง plan ครั้งเดียว และตอบคำถามที่ค้างอยู่ทั้งหมดครั้งเดียวตั้งแต่ต้น จากนั้น agent จะทำทีละ task ต่อ round พิสูจน์ว่าใช้ได้จริง ขอ verdict จาก verifier ที่ไม่ได้เขียนโค้ดนั้น แล้วเปิด PR คุณเป็นคน merge เอง เว้นแต่จะให้ loop merge เข้า dev branch ของคุณ (ดูด้านล่าง)

agent ที่ปล่อยให้ทำ queue อยู่คนเดียวมักพังซ้ำอยู่ไม่กี่แบบ คือถามคุณตอนตีสองแล้วนั่งรอ เห็น typecheck ผ่านก็เรียกว่า "เสร็จ" ตรวจงานตัวเอง หรือเดา business rule เอาเอง pitwall มีทางรับมือทุกข้อ

- `/pitwall:queue` ถามทุกเรื่องที่มีแต่คุณตัดสินได้ ถามครั้งเดียวเป็น tick box ระหว่างรัน agent จะลองทำเอง ใช้ค่า default ที่บันทึกไว้ หรือพัก task ไว้ก่อน ไม่มีการหยุดรอถาม
- `/pitwall:gauge` รัน check ของคุณ เปิดหน้าเว็บใน browser ให้ แล้วให้ขั้นตอนเป็นข้อๆ กับคุณเฉพาะส่วนที่เครื่องทำแทนไม่ได้
- ทุก PR ได้ verifier ตัวใหม่แบบ read-only ที่ผูกกับโค้ดชุดที่มันตรวจพอดี พอมี commit ใหม่ verdict นั้นก็เก่าไปแล้ว
- agent ไม่ force-push และไม่ push เข้า protected branch จะ merge ก็ต่อเมื่อคุณเปิด `merge: auto` เท่านั้น ในโหมดนี้มันจะ merge PR ของตัวเองเข้า dev branch ตาม git-flow เมื่อผ่านทุก gate ส่วน `main` กับ release branch ยังเป็นของคุณ ([auto merge](playbooks/auto-merge/))

## Loop

<ol class="steps">
<li><strong><a href="playbooks/init/">init</a>.</strong> อ่าน repo แล้วเขียน profile ให้ ทำครั้งเดียว</li>
<li><strong><a href="playbooks/plan/">plan</a>.</strong> สัมภาษณ์เป็น round สั้นๆ ทุกคำตอบลงไปอยู่ใน spec และ plan ได้ row เพิ่ม</li>
<li><strong><a href="playbooks/queue/">queue</a>.</strong> เลือก task ที่ agent ทำจบได้เอง และถามคำถามที่ค้างทั้งหมดครั้งเดียว</li>
<li><strong><a href="playbooks/drive/">drive</a> และ <a href="playbooks/lap/">lap</a>.</strong> ทำทีละ task ต่อ round (branch, เขียนโค้ด, พิสูจน์, review, verdict, PR) แล้วไป task ถัดไป</li>
<li><strong><a href="playbooks/merge-order/">merge-order</a>.</strong> บอกว่าควร merge PR ไหนก่อน คุณเป็นคนกดปุ่มเอง (ถ้าตั้ง <code>merge: auto</code> ตัว lap จะ merge เข้า dev branch เอง)</li>
</ol>

หยุดระหว่าง task ด้วย `/pitwall:stop` หรือหยุดทันทีด้วย `/pitwall:brake`

มีสองโหมดที่ปิดไว้จนกว่าคุณจะเปิดใน profile [Parallel laps](playbooks/parallel-laps/) (`parallel: 2` ขึ้นไป) รันหลาย task พร้อมกันใน batch เดียว แต่ละ task มี worktree และ branch ของตัวเอง ส่วน [Auto merge](playbooks/auto-merge/) (`merge: auto`) ให้ loop merge PR ที่ผ่าน verify แล้วเข้า dev branch แบบ git-flow ของคุณเอง โดย `main` กับ release branch ยังเป็นของคุณ

## ติดตั้ง

<ol class="steps">
<li><strong>เพิ่ม marketplace และ plugin</strong> ใน Claude Code</li>
</ol>

```text
/plugin marketplace add aontwit/pitwall
/plugin install pitwall@pitwall
```

<ol class="steps" start="2" style="counter-reset: step 1">
<li><strong>ตั้งค่าทีละ repo</strong> รัน <code class="cmd">/pitwall:init</code> ใน repo นั้น แล้ว commit <code>.claude/agent-loop.md</code> (และไฟล์ plan ถ้า init เขียนไว้) เข้า base branch</li>
<li><strong>Plan, queue, drive</strong> รัน <code class="cmd">/pitwall:plan</code> ถ้า plan ยังไม่มี row แล้วต่อด้วย <code class="cmd">/pitwall:queue</code> และ <code class="cmd">/pitwall:drive</code></li>
</ol>

ต้องมี GitHub repo, [`gh`](https://cli.github.com) ที่ login แล้ว และ `git`, `bash`, Node 18+ บนเครื่องที่รัน loop ถ้าจะ check ผ่าน browser ต้องมี dev server และ browser ที่ Claude สั่งงานได้ด้วย ถ้าจะติดตั้งให้ทั้งทีม (project scope) ดู README ฉบับเต็มด้านล่าง

## อ่านต่อ

- เพิ่งเริ่มใช้: [init](playbooks/init/) แล้วต่อด้วย [plan](playbooks/plan/)
- PR หน้าตาเป็นยังไง: [lap](playbooks/lap/#what-youll-see)
- agent ทำงานแต่ละแบบยังไง: playbook สำหรับ [แก้บั๊ก](playbooks/bug-fix/), [refactor](playbooks/move-only/) และ [feature](playbooks/feature/)
- ทำไมถึงออกแบบมาแบบนี้: อ่าน principle โดยเริ่มจาก [prove it works](principles/prove-it-works/)

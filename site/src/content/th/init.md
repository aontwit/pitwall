---
playbook: init
---

## ทำอะไร

`/pitwall:init` เตรียม repo ให้พร้อมใช้กับ loop มันอ่าน repo ก่อน ถามคุณเฉพาะสิ่งที่หาจากไฟล์ไม่ได้ แล้วเขียน profile `.claude/agent-loop.md` ที่ทุกคำสั่งอื่นใช้ทำงาน มันไม่ commit ไม่ push และไม่แก้ settings ของคุณ คุณ review profile แล้ว commit เอง

## ใช้เมื่อ

- repo กำลังจะรัน `/pitwall:queue` เป็นครั้งแรก
- stack เปลี่ยนไปจากที่ profile เขียนไว้ เช่นเปลี่ยน package manager (`/pitwall:init redo` จะเริ่มใหม่ทั้งหมด)
- `/pitwall:doctor` แจ้งว่ามี section ขาดไป (init จะเติมเฉพาะส่วนนั้น)

## ลองใช้

```text
/pitwall:init
```

ต้องมี `gh` ที่ login แล้ว ถ้าไม่มี init จะหยุดทันที

## ทำงานยังไง

<ol class="steps">
<li><strong>อ่าน</strong> ทุกอย่างอ่านจาก base branch ในแบบที่ loop จะเห็น ได้แก่คำสั่ง install และ check (จาก lockfile กับ scripts หรือจาก step ใน CI), base branch (branch ที่ work PR ถูก merge เข้าไป), protected branch, hook, รูปแบบ commit, dev server, plan และ tracker ทุกค่าจดที่มาไว้ด้วย</li>
<li><strong>ร่าง</strong> เติม template ของ profile ด้วยสิ่งที่อ่านมา รวมถึง model สองตัวที่ต่างกันสำหรับ review panel</li>
<li><strong>ถามครั้งเดียว</strong> ถามเป็น tick box ครั้งละไม่เกินสี่ข้อ คำตอบที่แนะนำอยู่บนสุด เรื่องที่ถามคือ tracker, ภาษา, base เมื่อมีตัวเลือกสองตัว, dev server กับ browser และ step ที่ต้องให้คนทำเท่านั้น ถ้า base ตั้งชื่อแบบ dev branch (<code>dev</code>, <code>development</code> หรือชื่อย่อระหว่างนั้นอย่าง <code>devel</code>) จะถามเพิ่มว่าใครเป็นคน merge ระหว่างคน (ค่า default และคำตอบที่แนะนำ) กับ loop ซึ่งจะ merge ได้เฉพาะ branch นั้น (<a href="../auto-merge/">auto merge</a>) base อื่นจะได้ <code>merge: human</code> โดยไม่ถาม</li>
<li><strong>เขียน</strong> เขียน profile และสร้าง <code>PLAN.md</code> ถ้า repo ไม่มีทั้ง tracker และ plan</li>
<li><strong>ตรวจ</strong> รัน <code class="cmd">/pitwall:doctor</code> แล้ว init ต้องจบด้วย "profile OK"</li>
</ol>

init ไม่เดาค่าทาง business เอง เช่นราคา limit หรือ credential

## จะเห็นอะไร

ตัวอย่างมาจาก repo สมมติชื่อ `acme/shop`

```text
Profile written: .claude/agent-loop.md · doctor: profile OK

Read from the repo
  install     pnpm install --frozen-lockfile     pnpm-lock.yaml
  checks      pnpm typecheck · pnpm lint · pnpm test   package.json scripts
  base        main                                last 30 merged work PRs
  commits     feat(scope): summary                .husky/commit-msg
  dev server  pnpm dev, port 5173                 vite.config.ts
Answered by you
  tracker none · languages English · browser Claude in Chrome
Defaults taken
  review panel: two different models
Written
  .claude/agent-loop.md · PLAN.md

Next: commit both files to main yourself, then /pitwall:plan
```

## ขั้นต่อไป

- commit `.claude/agent-loop.md` (และไฟล์ plan) เข้า base เอง loop ไม่ push เข้า base และ lap จะหยุดถ้าเจอไฟล์ที่ยัง untracked
- ถ้า plan ยังไม่มี row ให้รัน `/pitwall:plan` ถ้ามีแล้วให้รัน `/pitwall:queue`
- init อาจแจ้งรายการที่คุณต้องทำเอง คือเพิ่ม `permissions` ในไฟล์ settings, เอา profile ออกจากรายการ ignore ใน `.gitignore` หรือเพิ่ม marketplace entry ที่ clone ของเพื่อนร่วมทีมต้องใช้
- ถ้าเลือก `merge: auto` report จะระบุ permission rule หนึ่งข้อ คือ `Bash(node <absolute pitwall dir>/scripts/merge-pr.mjs:*)` พร้อม path จริง rule นี้ต้องอยู่ใน `.claude/settings.local.json` ของเครื่องนี้ ไม่ใช่ `.claude/settings.json` ที่แชร์กันทั้งทีม ให้คุณเพิ่มเอง ลบ deny rule ที่ match กับมันออก และแก้ path เมื่อ plugin update ย้ายตำแหน่งไป ส่วน `gh pr merge` ยังถูก deny อยู่เหมือนเดิม

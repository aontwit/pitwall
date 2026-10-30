---
playbook: doctor
---

## ทำอะไร

`/pitwall:doctor` ตรวจ profile `.claude/agent-loop.md` เทียบกับ contract ที่ทุกคำสั่งพึ่งอยู่ แล้วบอกชื่อ section ที่ขาดหรือผิด มันอ่านอย่างเดียว การแก้ต้องทำเองหรือผ่าน `/pitwall:init`

## ใช้เมื่อ

- คุณแก้ profile ด้วยมือ
- มีคำสั่งหยุดแล้วบอกว่า section หายไป
- repo เปลี่ยนเครื่องมือ เช่นจาก npm เป็น pnpm

## ลองใช้

```text
/pitwall:doctor
```

## ตรวจอะไรบ้าง

<ol class="steps">
<li><strong>Section ต่างๆ</strong> มี section ที่จำเป็นครบ (repo, git, checks, level B, states to build, repo-specific evidence, agents per task, repo rules, permissions, language) และไม่เหลือ placeholder <code>{{…}}</code> บรรทัด tracker ถูกต้อง <code>parallel</code> กับ <code>port</code> มีค่าที่ถูกต้องถ้าตั้งไว้ และ <code>merge</code> เป็น <code>human</code> หรือ <code>auto</code> ถ้าเป็น <code>merge: auto</code> row <code>dev branch</code> ต้องระบุ base ตัวเดียวกันนี้ ซึ่งต้องมีอยู่บน origin และต้องไม่ใช่ <code>main</code>, <code>master</code> หรือ release หรือ production line</li>
<li><strong>สิ่งที่ script มองไม่เห็น</strong> คำสั่ง install ยังตรงกับ lockfile บน base, check command ทุกตัวมีอยู่จริง, base branch มีอยู่บน remote, <code>gh</code> login อยู่ และเครื่องมือของ tracker เชื่อมต่อแล้ว</li>
</ol>

## จะเห็นอะไร

profile ที่ปกติดี:

```text
ok       repo
ok       git
ok       checks
ok       level B
…
optional multi-machine (not set)
doctor: profile OK (.claude/agent-loop.md)
```

profile ที่มีปัญหา (report อธิบายแต่ละบรรทัดไว้):

```text
MISSING  states to build
BAD      tracker: the section must say `tracker: clickup`, `tracker: github` or `tracker: none`
UNFILLED 1 line(s) still hold a {{…}} placeholder:
doctor: 3 problem(s) in .claude/agent-loop.md
```

ถ้าไม่มี profile เลย doctor จะบอกว่า repo นี้ยังไม่ได้ตั้งค่า pitwall และชี้ไปที่ `/pitwall:init`

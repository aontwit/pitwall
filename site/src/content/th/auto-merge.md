---
playbook: auto-merge
---

## ทำอะไร

ถ้าใส่ `merge: auto` ไว้ในส่วน `git` ของ profile ตอน sync ต้นทุก round loop จะ merge PR ที่ตัวเองเปิดและเสร็จแล้วเข้า dev branch ของคุณ base ต้องเป็น dev branch ตัวนั้น (แบบ git-flow คือ PR ชี้ไปที่ `dev` แล้วคนเป็นคน merge `dev` เข้า `main` หรือ release branch) loop ไม่มีวัน merge เข้า `main`, `master`, release branch หรือ production branch และ worker ใน lead mode ไม่ merge เลย

> Auto merge ยังพิสูจน์ไม่ครบ ยังไม่เคย merge PR ใน run จริงเลย ค่าเริ่มต้นคือปิดไว้ ถ้าตั้ง `merge: human` หรือไม่มีแถว `merge` คุณเป็นคน merge ทุก PR เอง

## sync ทำอะไรบ้าง

<ol class="steps">
<li><strong>เลือก PR ที่เข้าข่าย.</strong> เฉพาะ task PR ที่ loop นี้เปิดเองและยังเปิดอยู่ เรียงจากเก่าสุด ถ้าเป็น stack ก็ไล่จากตัวล่างสุด PR แบบ plan-sync, PR ของคุณเอง และของคนอื่น ยังเป็นหน้าที่ของคุณ PR ที่ worker ยังถืออยู่จะถูกข้ามจนกว่า worker จะส่งคืน</li>
<li><strong>เช็ก stop และ brake.</strong> พอมีการสั่ง <code class="cmd">/pitwall:stop</code> หรือ <code class="cmd">/pitwall:brake</code> แล้ว จะไม่ merge อะไรเพิ่มอีก</li>
<li><strong>ตัดสิน gate.</strong> PR ต้องได้ verdict VERIFIED (PARTIAL ไม่นับ) จาก verifier ตัวใหม่ที่ตรวจ code ปัจจุบันของ PR ส่วน "Not done yet" ต้องไม่มีช่องไหนที่ยังไม่ติ๊ก และ CI ต้องเขียวโดยรันบน head ปัจจุบันและ base ปัจจุบัน PR ที่เป็น PARTIAL แต่ติ๊กครบทุกช่องในภายหลัง หรือ verdict ที่ออกมาตั้งแต่ก่อน verifier จะมีคำถามเรื่อง เงิน / permission / ข้อมูลผู้ใช้ / การลบ จะได้รัน verifier ใหม่หนึ่งครั้งก่อน</li>
<li><strong>ดึง dev branch เข้ามา.</strong> ถ้า dev branch มี commit ที่ PR ยังไม่มี loop จะ merge commit พวกนั้นเข้า PR branch แล้ว push และตัดสิน PR ใหม่ใน round ถัด ๆ ไป หลัง CI รอบใหม่รันแล้ว ถ้าเป็นครั้งที่สาม หรือเจอ conflict ที่ loop ไม่มีสิทธิ์ resolve เอง จะ hold PR ไว้</li>
<li><strong>Merge.</strong> ผ่าน script ตัวเดียวคือ <code>merge-pr.mjs</code> โดยทำ merge commit ของ head ตัวที่ตัดสินไปแบบตรงตัว ไม่ใช้ <code>--admin</code> หรือ <code>--auto</code> เด็ดขาด จากนั้นอ่าน PR กลับมาเช็กว่า merge เข้า dev branch แล้วจริง</li>
<li><strong>ขยับ stack ต่อ.</strong> PR ลูกที่ stack อยู่บนตัวที่เพิ่ง merge จะถูกย้ายไปต่อบน dev branch และตัดสินใน round ถัด ๆ ไป หลังจาก CI ของมันรันบนนั้นแล้ว</li>
</ol>

หนึ่ง round ทำได้หนึ่ง action คือ merge หนึ่งครั้ง หรือ merge dev branch เข้า PR branch หนึ่งครั้ง ทุกการ merge ทำให้ dev branch ขยับ PR ตัวถัดไปจึงต้องตรวจใหม่อยู่แล้ว

## ที่คุณต้อง merge เองเสมอ

ต่อให้ผ่านทุก gate PR ก็ยังต้องให้คนตัดสินถ้า verifier เจอเรื่องเงิน ราคาหรือค่าธรรมเนียม, permission หรือ security, ข้อมูลผู้ใช้ หรือการลบ ใน diff หรือถ้า PR แก้ CI หรือตัว check เอง ได้แก่ workflow และ hook, `package.json` ไฟล์ไหนก็ตาม, config ของ ESLint, RuboCop หรือ TypeScript, baseline, profile หรือไฟล์ที่ check command ใน profile รัน

## สิ่งที่จะเห็น

การ merge หรือ PR ที่ถูก hold จะได้หนึ่งบรรทัดใน report ของ round (ข้อความจริงอาจต่างไปบ้าง):

```text
merged #58 into dev
#61 HOLD 3: e2e pending
#62 HOLD always-human: .github/workflows/ci.yml is CI, hook or repo-owner config
```

hold ที่ต้องให้คุณจัดการจะส่ง push notification หนึ่งครั้งด้วย ถ้าเกิดใน round ที่คุณไม่ได้สั่งเอง ส่วน hold ที่จบไปเอง เช่น check ที่ยังรันไม่เสร็จ จะมีแค่บรรทัดใน report PR อื่นที่ถูก hold จะรอคุณหรือรอ commit ถัดไปของมัน และ loop จะไม่แก้มันนอก task

## วิธีเปิดใช้

`/pitwall:init` จะถามว่าใครเป็นคน merge เมื่อ base ตั้งชื่อแบบ dev branch คือ `dev`, `development` หรือชื่อย่อที่อยู่ระหว่างสองตัวนี้อย่าง `devel` ถ้าจะตั้งเอง ให้ใส่ทั้งสองแถวในตาราง `git` ของ profile แล้วรัน `/pitwall:doctor` ซึ่งจะ fail ถ้า dev branch ไม่ใช่ base, ดูเหมือน `main` หรือ release line หรือไม่มีอยู่บน origin:

```markdown
| base | `dev` |
| merge | `merge: auto` |
| dev branch | `dev` |
```

จากนั้นเพิ่ม permission rule หนึ่งข้อที่ init บอกไว้ลงใน `.claude/settings.local.json` ของเครื่องนี้ โดยใช้ path จริงของโฟลเดอร์ `scripts/` ของ plugin: `Bash(node <absolute pitwall dir>/scripts/merge-pr.mjs:*)` ถ้าอัปเดต plugin แล้ว path เปลี่ยน ให้แก้ rule ตาม และลบ deny rule ที่ match กับมันออก `gh pr merge` เองยังถูก deny อยู่ และ init ไม่เขียนไฟล์ settings ให้เลย

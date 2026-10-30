---
playbook: lap
---

## ทำอะไร

`/pitwall:lap` รัน loop หนึ่ง round มันหยิบ task ถัดไปจาก queue มาทำบน branch ใหม่ พิสูจน์ว่าใช้ได้จริง ส่งให้ review และขอ verdict จาก verifier อิสระ แล้วเปิด pull request จากนั้นก็จบ หรือถ้า `/pitwall:drive` เป็นตัวสั่ง ก็จะตั้ง round ถัดไปไว้ lap ไม่ merge อะไรเลย ยกเว้น profile ตั้ง `merge: auto` ไว้ ตอน sync ต้น round ถึงจะ merge PR ที่เสร็จแล้วได้หนึ่งตัวเข้า dev branch ของคุณ (ดู [Auto merge](../auto-merge/))

## ใช้ตอนไหน

- อยากดู loop ทำงานสักหนึ่ง round ก่อนปล่อยให้มันวิ่งเอง
- เพิ่งแก้ profile หรือ playbook และอยากเห็น task หนึ่งตัวตั้งแต่ต้นจนจบ
- มี task ด่วนอยู่ตัวเดียว ถ้าใช้ `/pitwall:drive` มันจะทำต่อไปเรื่อย ๆ หลังจากนั้น

## ลองใช้

```text
/pitwall:queue
/pitwall:lap
```

รัน `/pitwall:queue` ก่อน lap หยิบ task จาก queue เท่านั้น และขั้น queue คือจุดที่ loop ถามคำถามทั้งหมดกับคุณไว้ล่วงหน้า

## หนึ่ง round ทำงานยังไง

<ol class="steps">
<li><strong>Sync.</strong> pull base ล่าสุด ติ๊กหรือเอาติ๊กออกจาก checkbox ของ PR ที่ code เปลี่ยนไปหลังจากผ่านแล้ว verify PR เก่าซ้ำหนึ่งตัว และจดว่า PR ไหน merge ไปแล้ว ถ้าตั้ง <code>merge: auto</code> ไว้ ขั้นนี้อาจ merge PR หนึ่งตัวเข้า dev branch ด้วย</li>
<li><strong>เลือก task.</strong> หยิบ task แรกที่ไม่ได้ถูก block ไม่ได้ park ยังไม่มี PR เปิดอยู่ และไม่ได้รอ merge ตัวอื่น ถ้าไม่เหลืออะไรแล้วก็ report แล้วจบ</li>
<li><strong>สร้าง branch.</strong> แตก branch ใหม่จาก base ตั้งชื่อตาม pattern ใน profile</li>
<li><strong>ลงมือทำ.</strong> research เขียน brief หกส่วน แล้วค่อยเขียน code task ใหญ่จะส่งให้ subagent ตาม role ของงาน lead อ่านทุก diff และ revert ไฟล์ไหนก็ตามที่อยู่นอก brief</li>
<li><strong>พิสูจน์และ review.</strong> <code class="cmd">/pitwall:gauge</code> รัน check ของคุณและเปิดหน้าเว็บทดสอบใน browser ทุก model ใน review panel ได้ prompt เดียวกัน แล้ว findings ของทุกตัวรวมเป็นตารางเดียว</li>
<li><strong>Verdict และ PR.</strong> verifier ตัวใหม่ที่อ่านได้อย่างเดียวตรวจ head ที่ commit แล้ว และผูก verdict ไว้กับ patch-id จากนั้นเปิด PR พร้อมหลักฐานทั้งหมด</li>
</ol>

task ที่ทำให้จบอย่างปลอดภัยไม่ได้จะถูก park งานจะเก็บไว้เป็น commit ในเครื่องที่ไม่ push มีบันทึกเหตุผลไว้ แล้ว round ก็ไปต่อที่ task ถัดไป task ที่ใช้เวลาเกิน 90 นาทีจะเปลี่ยนวิธีทำก่อน ถ้าเปลี่ยนไปสองครั้งแล้ว หรือครบ 180 นาที ก็จะ park

## สิ่งที่จะเห็น {#what-youll-see}

ตัวอย่างข้างล่างมาจาก repo สมมติชื่อ `acme/shop`

### Report ตอนจบ round

```text
Lap · P2-04 Sort search results by price
PR      https://github.com/acme/shop/pull/58   [PARTIAL]
Task    plan row P2-04 (tracker: none)
Gauge   PARTIAL: every A and B item passed, 1 C item left for a human
Edited  src/search/sort.ts · src/search/sort.test.ts · docs/plan/phase-2.md
Parked  none
```

### Pull request

<div class="example" data-label="PR #58 · [PARTIAL] Sort search results by price">

**What.** Sort search results by price, low to high and back. Plan row P2-04, playbook `feature`.

**Changes**
- the search page has a price sort, low to high and high to low
- results with the same price keep newest first

**Verify**

| Item | Level | Command / method | Result |
|---|---|---|---|
| typecheck | A | `pnpm typecheck` | ✅ 0 errors |
| unit tests | A | `pnpm test src/search` | ✅ 14 passed |
| search page | B | dev server `/search?q=lamp` @1366 | ✅ order correct both ways, console 0 errors |
| phone check | C | 1. search "lamp" on a phone 2. sort high → low → order is right | ⏳ |
| Verifier | — | general-purpose sonnet @3f9c2e1 patch 8d41b0c27a9e | ✅ PARTIAL |

**Decisions to confirm**
- Equal prices sort newest first · other option: by name · change it in `sortResults()`

**Agents used**
- Explore haiku · research → 6 files read
- general-purpose sonnet · coding → done
- review panel, 2 models · reviewing → 2 findings

**Review**
- act on (both models): an empty result list crashed the sort → fixed
- consider (one model): cache the sorted list → follow-up

**Not done yet (before merge)**
- [ ] C · on a phone: search "lamp", sort high → low, the order is right

</div>

### เมื่อ task ถูก park

```text
Parked P2-05 Pay with a saved card
Reason  the plan does not say what happens when the saved card has expired
Saved   commit "wip: P2-05 parked — …" on agent/p2-05-saved-card (not pushed)
Asked   the question is written into the plan's open questions on that branch
```

## Lead mode (รันหลาย lap พร้อมกัน) {#lead-mode-parallel-laps}

ถ้าตั้ง `parallel` ใน profile มากกว่า 1 lap จะแจก task แต่ละตัวใน batch ให้ worker คนละตัว แต่ละตัวมี worktree และ branch ของตัวเอง ทำงานยังไงและเปิดใช้ยังไง ดูที่ [Parallel laps](../parallel-laps/)

## merge อัตโนมัติ {#auto-merge}

ถ้าตั้ง `merge: auto` ใน profile ตอน sync ต้น round อาจ merge PR ที่เสร็จแล้วหนึ่งตัวเข้า dev branch ของคุณ เงื่อนไขทั้งหมดและวิธีเปิดใช้ ดูที่ [Auto merge](../auto-merge/)

## หยุดหรือปรับ

- `/pitwall:stop` ทำ task ที่ค้างอยู่ให้เสร็จ แล้วหยุด
- `/pitwall:brake` หยุดทันทีและเซฟงานเป็น WIP commit
- `/pitwall:drive` รัน lap ต่อกันไปเรื่อย ๆ จนกว่า queue จะว่าง
- profile `.claude/agent-loop.md` เป็นที่ตั้งค่า branch pattern, check command, review panel, agents per task, จำนวน task ที่รันพร้อมกัน, dev server และคนที่ merge

lap ไม่ force-push ไม่ push เข้า branch ที่ profile protect ไว้ และไม่ถามคำถามคุณกลาง round ครั้งเดียวที่มัน merge คือตอนตั้ง [`merge: auto`](../auto-merge/) โดย merge เข้า dev branch ผ่าน `merge-pr.mjs` เมื่อผ่านทุก gate

---
playbook: merge-order
---

## ทำอะไร

`/pitwall:merge-order` บอกว่า PR ที่เปิดอยู่ตัวไหนควร merge ก่อน และตัวที่เหลือต้องรอเพราะอะไร มันเรียง PR ที่ stack กันให้ parent มาก่อน child และให้ level กับ PR แต่ละตัว จากนั้นแก้สิ่งที่แก้ได้อย่างปลอดภัย คือ retarget child ที่ parent merge ไปแล้ว คง child ไว้เป็น draft และแก้ conflict ใน log กับ row ของ plan มันไม่ merge เอง คุณเป็นคนกดปุ่ม

ถ้าตั้ง [`merge: auto`](../auto-merge/) ไว้ ขั้น sync ตอนเริ่ม lap จะ merge PR ของ loop เองเข้า dev branch เมื่อผ่านทุก gate โดยใช้ลำดับเดียวกัน (ล่างสุดของแต่ละ stack ก่อน เป็น merge commit) ส่วนนี้เป็นงานของ lap แยกจากคำสั่งนี้

## ใช้เมื่อ

- มี PR ของ agent เปิดอยู่หลายตัว บางตัว stack อยู่บนตัวอื่น
- เพิ่ง merge ไปตัวหนึ่ง แล้วอยากรู้ว่าตัวต่อไปคืออะไร
- หลัง merge แล้ว PR ตัวอื่นเริ่ม conflict ใน plan

## ลองใช้

```text
/pitwall:merge-order          all your open PRs
/pitwall:merge-order 101      only the stack that holds #101
```

## ระดับ

| Level | ความหมาย |
|---|---|
| 🟢 | merge ได้เลย: อยู่บน base, check เขียว, ไม่มีอะไรค้าง, มี verdict ที่ผ่านที่โค้ดปัจจุบัน |
| 🟡 | merge ได้ แต่มีบางอย่างค้าง: มีข้อที่ยังไม่ติ๊ก หรือยังไม่มี verdict ที่โค้ดปัจจุบัน คุณตัดสินเองว่ารอไว้ทำหลัง merge ได้ไหม |
| ⏸ | รอ PR ตัวที่มัน stack ทับอยู่ |
| 🔴 | ติดอยู่: เป็น draft, มี conflict, check fail, มีคนขอ changes หรือ verdict ไม่ผ่าน |
| ⏳ | ยังมี check รันอยู่ |

## จะเห็นอะไร

ตัวอย่างมาจาก repo สมมติชื่อ `acme/shop`

```text
retarget: #59 → main (#58 merged)

Stack A — 3 PR (main ← #59 ← #60 ← #61)
| # | PR                        | Level | Pending              |
|---|---------------------------|-------|----------------------|
| 1 | #59 price filter          | 🟢    |                      |
| 2 | #60 filter chips          | ⏸     | waiting for #59      |
| 3 | #61 saved filters         | ⏸     | waiting for #60      |

Standalone
| # | PR                        | Level | Pending              |
|---|---------------------------|-------|----------------------|
| 1 | #62 lint batch 3          | 🟡    | needs re-verify      |

Next: merge #59 → then press "Delete branch" in that PR (GitHub moves #60 to main itself)
```

## ตอน merge

- ใช้ **Create a merge commit** ห้าม squash หรือ rebase PR ที่อยู่ใน stack เพราะ child จะเห็น commit ของ parent ซ้ำสองรอบแล้ว conflict
- merge ทีละตัว ตามลำดับ และเฉพาะ PR ที่ base ตรงกับ base ใน profile
- กด **Delete branch** ทันทีหลัง merge เพื่อให้ GitHub ย้าย child ไปไว้บน base ถ้าลืม สั่ง `/pitwall:merge-order` อีกรอบ มันจะ retarget ให้
- หลัง merge แล้ว PR ของ agent ตัวอื่นมักจะ conflict ใน log ของ plan สั่งคำสั่งนี้อีกรอบ หรือปล่อยให้ lap ถัดไปแก้ก็ได้

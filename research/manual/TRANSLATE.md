# Translation job brief (for translation agents)

You are given a LANGUAGE code (zu, st, ve or ts) and a list of chapter SLUGS.

1. Read in full: `research/manual/STYLE.md` (binding — "Markdown format" and "Translation rules")
   and `research/manual/glossary-<LANGUAGE>.md`. Use glossary terms consistently. If you coin a new
   term, add a row to the right glossary table marked "(check)". Other agents may edit the same
   glossary at the same time: if an Edit fails, re-read the file and retry.
2. If `content/manual/<LANGUAGE>/01-what-is-permaculture.md` exists, skim it to match register, and
   reuse EXACTLY its wording for the fixed labels: the callout labels (**Safety:** / **Tip:** /
   **Note:**), the "## Key points" heading, and the names of the ethics and 12 principles.
2b. RESUMING: an earlier run may have been interrupted. If `content/manual/<LANGUAGE>/<SLUG>.md`
   already exists, read it: keep the finished parts (check them against the English), then continue
   from where it stops and complete the chapter. Do not start over unless the partial text is bad.
3. For each SLUG translate `content/manual/en/<SLUG>.md` → `content/manual/<LANGUAGE>/<SLUG>.md`.
   - Keep the Markdown structure identical: same headings in the same order, same number of list
     items, same callouts (each "> " line, including "> - " bullet lines), same table rows and
     columns. Paragraphs may be split.
   - Translate everything: headings, callout labels (**Safety:**, **Tip:**, **Note:**), table cells,
     "Key points". Latin names stay in *italics*; numbers, units and legal Act names/numbers stay
     as in English (you may add a short local-language gloss after an Act name).
   - Plain spoken rural register, as an extension officer would explain it.
   - Long chapters: write in parts — Write the first part, then append further parts with Edit
     (anchor on the file's current last line). Never truncate or summarise.
4. Language specifics:
   - **st**: South African orthography (di-, ya, wa, tsh, kg), never Lesotho spelling (li-, ea, oa,
     tš, kh). A garden bed is "bethe ya serapa", never "bethe" alone.
   - **ve**: use ḓ ḽ ṅ ṋ ṱ wherever they belong. Do not copy vocabulary from `lib/locales/ve.ts`
     strings that look like another language.
   - **ts**: do not copy vocabulary from `lib/locales/ts.ts` (parts contain siSwati/isiZulu/Sepedi).
5. Verify each chapter's structure (replace LANG and the slug list):
   `cd /home/user/ImbewuField && node --import ./tests/register-alias.mjs -e "import('@/lib/manual').then(m=>{const fs=require('fs');const L='LANG';for(const s of ['SLUG1','SLUG2']){const f=l=>m.blockShape(m.parseManual(fs.readFileSync('content/manual/'+l+'/'+s+'.md','utf8'))).filter(x=>x!=='p').join(',');console.log(s, f('en')===f(L)?'OK':'MISMATCH\n en:'+f('en')+'\n '+L+':'+f(L))}})"`
   Fix every MISMATCH.
6. Edit no other files. Do not commit. Report briefly: files written, word counts, uncertain terms.

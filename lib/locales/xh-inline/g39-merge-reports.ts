// Unreviewed isiXhosa machine drafts keyed by the exact English (see index.ts).
const drafts: Record<string, string> = {
  // The design report after main's four-language stack (#1122) reworded these templates.
  "You have {count} saved reports — delete one to save this": "Unazo iingxelo ezigciniweyo ezi-{count} — cima enye ukuze ugcine le",
  "Zone name \"{zone}\" is a best-effort climate match, not a verified BRU→Bioresource Group crosswalk.": "Igama lommandla elithi \"{zone}\" lilingana kakhulu kangangoko nemozulu, alilolo udibaniso lwe-BRU→Bioresource Group oluqinisekisiweyo.",
  "This report keeps its original {language} text. Controls use your app language. Choose a report language before generating a new version.": "Le ngxelo igcina umbhalo wayo wokuqala ({language}). Izilawuli zisebenzisa ulwimi lwe-app yakho. Khetha ulwimi lwengxelo phambi kokwenza inguqulelo entsha.",
  "{count} of 7 areas have records · see what to add or review": "{count} kwiindawo ezi-7 zinerekhodi · jonga into onokuyongeza okanye ophonononga",
  "{count} staple plots (P1–P{count})": "iziza zezityalo eziyisiseko ezi-{count} (P1–P{count})",
  "a 1 m post throws a {length} m shadow": "intsika ye-1 m iphosa isithunzi se-{length} m",
  // Summary PDF footer: isiXhosa is an unreviewed draft like the other native languages.
  "Draft translation · not reviewed by a fluent speaker.": "Inguqulelo eyidrafti · ayihlolwanga ngumntu oluthetha kakuhle ulwimi.",
  // Report front matter (lib/report-structure.ts).
  "Figures": "Imifanekiso",
  "Figure {number} — {caption}": "Umfanekiso {number} — {caption}",
  "Figure not captioned": "Umfanekiso ongenankcazelo",
};

export default drafts;

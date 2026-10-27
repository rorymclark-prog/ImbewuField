// Unreviewed isiXhosa machine drafts keyed by the exact English (see index.ts).
const drafts: Record<string, string> = {
  // The farm report's singular templates after main's w23-06 count agreement (#1125). They follow
  // the plural drafts' count-neutral "label: {n}" form in g34.
  "{harvests} harvest / {sales} sale entry": "Imibhalo yesivuno: {harvests} / yentengiso: {sales}",
  "{n} local invoice is currently marked unpaid. It does not enter money received.": "I-invoyisi yasekhaya emakishwe njengengahlawulwanga okwangoku: {n}. Ayibalwa kwimali efunyenweyo.",
  "{n} available record has no usable event date and cannot enter period totals. Review the source record.": "Irekhodi ekhoyo engenamhla wesiganeko osebenzisekayo, engakwaziyo ukungena kwiitotali zexesha: {n}. Hlola irekhodi yomthombo.",
  "{n} harvest or sale entry has no usable quantity. Their weights and counts remain unavailable.": "Umbhalo wesivuno okanye wentengiso ongenabungakanani busebenzisekayo: {n}. Ubunzima namanani awo ahlala engafumaneki.",
  "{n} entry has a future date within this calendar selection. It remains included, as in Records; review its date before sharing.": "Umbhalo onomhla wexesha elizayo ngaphakathi kolu khetho lwekhalenda: {n}. Uyaqhubeka ubandakanyiwe, njengakwiiRekhodi; hlola umhla wawo phambi kokwabelana.",
  "{n} sale entry": "Umbhalo wentengiso: {n}",
  "{n} sale entries": "Imibhalo yentengiso: {n}",
  "{n} paid invoice": "I-invoyisi ehlawulweyo: {n}",
  "{n} paid invoices": "Ii-invoyisi ezihlawulweyo: {n}",
  "{n} expense entry; completeness unknown": "Umbhalo weendleko: {n}; ukupheleliswa akwaziwa",
  "{n} local invoice; current snapshot": "I-invoyisi yasekhaya: {n}; imeko yangoku",
};

export default drafts;

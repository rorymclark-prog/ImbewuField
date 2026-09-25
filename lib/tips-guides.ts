/** The English guidance remains beside the isiZulu draft because these cards describe records and money actions. */
export const TIPS_GUIDES = [
  {
    href: '/mentor',
    en: {
      title: 'Dictate a mentor visit and attach photos',
      text: 'In Mentor → Field team, choose the farmer and date. Tap the notes box and use the microphone on your phone keyboard. Record what you saw, what you did, and the next action with its owner and date. Add photos and captions, then save. AI cleanup is optional and can be switched off in Settings.',
      action: 'Open Mentor',
    },
    zu: {
      title: 'Rekhoda ngokukhuluma ukuvakasha kukameluleki bese ufaka izithombe',
      text: 'Ku-Mentor → Field team, khetha umlimi nosuku. Thepha ibhokisi lamanothi bese usebenzisa imakrofoni ekhibhodini yefoni yakho. Rekhoda okubonile, okwenzile, nesinyathelo esilandelayo nomuntu ozosithatha nosuku lwaso. Faka izithombe namagama azo (captions), bese uyalondoloza. Ukuhlanzwa yi-AI (AI cleanup) akuyimpoqo futhi kungavalwa ku-Settings.',
      action: 'Vula i-Mentor',
    },
  },
  {
    href: '/records?tab=sold',
    en: {
      title: 'Save a sale and its invoice',
      text: 'Open My Records, choose Sold and enter the crop, weight and amount received. Save sale & invoice opens the linked paid invoice. For several products or payment later, use Create an invoice.',
      action: 'Open My Records',
    },
    zu: {
      title: 'Gcina ukuthengisa ne-invoyisi yakhona',
      text: "Vula u-My Records, khetha u-Sold bese ufaka isilimo, isisindo nemali etholakele. U-'Save sale & invoice' uvula i-invoyisi ekhokhelwe exhunyiwe. Uma unemikhiqizo eminingana noma inkokhelo izokwenziwa kamuva, sebenzisa u-'Create an invoice'.",
      action: 'Vula u-My Records',
    },
  },
  {
    href: '/records?tab=charts',
    en: {
      title: 'Record fruit and nuts',
      text: 'Choose your orchard product when recording a harvest or sale. In Charts, use Orchard in to include fruit and nuts, or turn it off to compare annual crops.',
      action: 'Open harvest charts',
    },
    zu: {
      title: 'Rekhoda izithelo namantongomane',
      text: "Khetha umkhiqizo wakho wasengadini yezithelo (orchard) uma urekhoda isivuno noma ukuthengisa. Ku-Charts, sebenzisa u-'Orchard in' ukuze ufake izithelo namantongomane, noma uyicime ukuze uqhathanise izitshalo zonyaka.",
      action: 'Vula ama-Charts esivuno',
    },
  },
  {
    href: '/records?tab=charts',
    en: {
      title: 'Read your cash balance',
      text: 'Cash surplus is money received minus recorded spending for the selected period. Cash shortfall means spending was higher. Add missing costs before judging how the garden is doing.',
      action: 'Open money charts',
    },
    zu: {
      title: 'Funda ibhalansi yakho yemali',
      text: 'Imali eyinsalela (Cash surplus) yimali etholakele kukhishwa izindleko ezirekhodiwe zaleso sikhathi esikhethiwe. Ukushoda kwemali (Cash shortfall) kusho ukuthi izindleko zibe ngaphezu kwemali etholakele. Faka izindleko ezingekho ngaphambi kokwahlulela ukuthi ingadi iqhuba kanjani.',
      action: 'Vula ama-Charts emali',
    },
  },
  {
    href: '/invoice',
    en: {
      title: 'Put your identity on invoices',
      text: 'Add your farm name and logo in Account. In Invoice, complete your contact and banking details, then save, share the PDF or print.',
      action: 'Open Invoice',
    },
    zu: {
      title: 'Faka imininingwane yakho kuma-invoyisi',
      text: 'Faka igama lepulazi lakho nelogo ku-Account. Ku-Invoice, gcwalisa imininingwane yakho yokuxhumana neyasebhange, bese uyalondoloza, wabelane nge-PDF noma uyiphrinte.',
      action: 'Vula i-Invoice',
    },
  },
  {
    href: '/samples',
    en: {
      title: 'Practise without changing your work',
      text: 'Take the tour or choose a practice view. Use the menu to switch views or leave the practice workspace and return to your own records.',
      action: 'Choose a practice view',
    },
    zu: {
      title: 'Zijwayeze ngaphandle kokushintsha umsebenzi wakho',
      text: 'Thatha uhambo (tour) noma khetha ukubuka kokuzijwayeza (practice view). Sebenzisa imenyu ukushintsha phakathi kokubuka noma uphume endaweni yokuzijwayeza ukuze ubuyele kumarekhodi akho.',
      action: 'Khetha ukubuka kokuzijwayeza',
    },
  },
] as const;

/** The English guidance remains beside the isiZulu draft because these cards describe records and money actions.
 *
 * `level` is new (ux-19, wave 13 audit): every card here was mentor/charts/invoice-level reading
 * for a Simple-mode farmer, with no beginner-appropriate card at all. 'simple' cards are the five
 * everyday actions the finding names (find my land, add a harvest, ask Lima, take a photo, print
 * my plan); the rest stay 'full'. app/tips/page.tsx (not this track's file) does not yet filter
 * on this field — it still shows every card to everyone — so a Simple farmer sees all eleven until
 * that filter is added; noted in the PR body. */
export const TIPS_GUIDES = [
  {
    href: '/farmer',
    level: 'simple',
    en: {
      title: 'Find your land on the map',
      text: 'Open the map and search for your address, or drop a pin on your own plot. Save it so it shows up next time, with its climate and soil already read for you.',
      action: 'Open the map',
    },
    zu: {
      title: 'Thola umhlaba wakho kumephu',
      text: 'Vula imephu bese usesha ikheli lakho, noma uthinte indawo yepulazi lakho. Yilondoloze ukuze ivele ngesinye isikhathi, inesimo sezulu nomhlaba esifundiwe kakade.',
      action: 'Vula imephu',
    },
  },
  {
    href: '/records?tab=picked',
    level: 'simple',
    en: {
      title: 'Add a harvest',
      text: 'Open My Records and choose Picked. Pick the crop, enter the weight and save. Do this as soon as you pick, so you never have to remember a number later.',
      action: 'Open My Records',
    },
    zu: {
      title: 'Faka isivuno',
      text: 'Vula u-My Records bese ukhetha u-Picked. Khetha isilimo, ufake isisindo bese uyalondoloza. Kwenze lokhu ngokushesha ngemva kokuvuna, ukuze ungaphinde ukhohlwe inombolo kamuva.',
      action: 'Vula u-My Records',
    },
  },
  {
    href: '/farmer',
    level: 'simple',
    en: {
      title: 'Ask Lima about your land',
      text: 'On the map, open Ask Lima and type or speak your question — sizes, water, what to plant. Lima answers from the climate and soil already read for your saved place.',
      action: 'Ask Lima',
    },
    zu: {
      title: 'Buza uLima ngomhlaba wakho',
      text: 'Kumephu, vula u-Ask Lima bese ubhala noma ukhuluma umbuzo wakho — usayizi, amanzi, okulimayo. ULima uphendula ngokususelwa esimweni sezulu nomhlabathi osesifundiwe sendawo yakho elondoloziwe.',
      action: 'Buza uLima',
    },
  },
  {
    href: '/journal',
    level: 'simple',
    en: {
      title: 'Take a photo for your journal',
      text: 'Open the Field journal and add a note. Tap the camera to take or choose a photo, write a short caption, then save — a quick record of what the garden looks like today.',
      action: 'Open the Field journal',
    },
    zu: {
      title: 'Thatha isithombe sejenali yakho',
      text: 'Vula iJenali Yasensimu bese ufaka inothi. Thepha ikhamera ukuze uthathe noma ukhethe isithombe, ubhale igama elifushane, bese uyalondoloza — irekhodi elisheshayo lokubukeka kwengadi namuhla.',
      action: 'Vula iJenali Yasensimu',
    },
  },
  {
    href: '/cropplan',
    level: 'simple',
    en: {
      title: 'Print your production plan',
      text: 'Open your production plan to see what is due this month, bed by bed. Use your phone or browser’s print option to take a paper copy with you into the garden.',
      action: 'Open the production plan',
    },
    zu: {
      title: 'Phrinta uhlelo lwakho lokukhiqiza',
      text: 'Vula uhlelo lwakho lokukhiqiza ukuze ubone okudingeka kwenziwe ngale nyanga, umbhede ngomumbede. Sebenzisa inketho yokuphrinta yefoni noma yesiphequluli ukuze uthathe ikhophi ephepha uye ngayo engadini.',
      action: 'Vula uhlelo lokukhiqiza',
    },
  },
  {
    href: '/mentor',
    level: 'full',
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
    level: 'full',
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
    level: 'full',
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
    level: 'full',
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
    level: 'full',
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
    level: 'full',
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

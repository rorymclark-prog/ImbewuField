import type { MelQuestion, MelStage, MelTemplate } from './mel';

const option = (value: string, en: string, zu: string) => ({ value, en, zu });
const yes = [option('yes', 'Yes', 'Yebo'), option('no', 'No', 'Cha'), option('unsure', 'Not sure', 'Angiqiniseki')];
const skill = [option('0', 'Not yet', 'Angikakwazi'), option('1', 'With help', 'Ngosizo'), option('2', 'On my own', 'Ngokwami'), option('na', 'Not tried', 'Angikakuzami')];
const rating = [option('1', 'Very poor', 'Kubi kakhulu'), option('2', 'Poor', 'Kubi'), option('3', 'Okay', 'Kuyanelisa'), option('4', 'Good', 'Kuhle'), option('5', 'Very good', 'Kuhle kakhulu'), option('na', 'Not used / not applicable', 'Angikusebenzisanga / akungithinti')];
const choice = (id: string, en: string, zu: string, options = yes, privateAnswer = false): MelQuestion => ({ id, en, zu, kind: 'choice', options, private: privateAnswer });
const number = (id: string, en: string, zu: string, max?: number): MelQuestion => ({ id, en, zu, kind: 'number', ...(max === undefined ? {} : { max }) });
const text = (id: string, en: string, zu: string): MelQuestion => ({ id, en, zu, kind: 'text', private: true });
const core = [
  choice('growing_now', 'Are you growing food at the moment?', 'Ingabe utshala ukudla njengamanje?'),
  number('growing_m2', 'How many square metres are currently growing food? Leave blank if unknown.', 'Mangaki amamitha-skwele atshalwe ukudla njengamanje? Shiya kungagcwalisiwe uma ungazi.'),
  choice('water_reliable', 'In the last 30 days, was there enough water for your crops?', 'Ezinsukwini ezingu-30 ezedlule, ingabe amanzi abenele izitshalo zakho?'),
  number('harvest_kg_30d', 'How many kilograms did you harvest in the last 30 days? Use records if available.', 'Uvune amakhilogremu amangaki ezinsukwini ezingu-30 ezedlule? Sebenzisa amarekhodi uma ekhona.'),
  number('sales_r_30d', 'How many rand did you receive from crop sales in the last 30 days?', 'Uthole amarandi amangaki ngokuthengisa izitshalo ezinsukwini ezingu-30 ezedlule?'),
  number('home_food_days_7d', 'On how many of the last 7 days did your household eat food from this garden?', 'Ezinsukwini ezingu-7 ezedlule, umndeni wakho udle ukudla kwale nsimu ngezinsuku ezingaki?', 7),
  choice('mulching', 'Can you mulch a bed correctly?', 'Ungakwazi ukumboza umbhede wezitshalo ngendlela efanele?', skill),
  choice('crop_planning', 'Can you plan what to plant next?', 'Ungakwazi ukuhlela ukuthi uzotshala ini ngokulandelayo?', skill),
  choice('record_keeping', 'Can you record a harvest and its sale?', 'Ungakwazi ukubhala phansi isivuno nokuthengiswa kwaso?', skill),
  text('main_barrier', 'What is the biggest difficulty you face in the garden?', 'Iyiphi inkinga enkulu obhekene nayo engadini?'),
];
const support = [
  number('support_contacts_30d', 'How many support visits or calls did you receive from project staff in the last 30 days?', 'Uvakashelwe noma ushayelwe ucingo kangaki abasebenzi bephrojekthi ukuze bakusize ezinsukwini ezingu-30 ezedlule?', 100),
  choice('staff_help', 'How useful was the support from ACT / project staff?', 'Usizo lwabasebenzi be-ACT / bephrojekthi beluwusizo kangakanani?', rating, true),
  choice('staff_respect', 'How would you rate the respect shown by project staff?', 'Ungayilinganisa kanjani inhlonipho oyikhonjiswe abasebenzi bephrojekthi?', rating, true),
  choice('staff_followup', 'When you asked for help, did project staff follow up?', 'Lapho ucela usizo, ingabe abasebenzi bephrojekthi balandela isicelo sakho?', [...yes, option('na', 'I did not ask for help', 'Angizange ngicele usizo')], true),
  text('support_change', 'What should we change about the support? Please avoid naming people here.', 'Yini okufanele siyishintshe ngosizo? Sicela ungabizi amagama abantu lapha.'),
  text('next_action', 'What one change would help you most now?', 'Yiluphi ushintsho olulodwa olungakusiza kakhulu manje?'),
];
const practical = [
  choice('site_observation', 'Can you identify sun, shade and water flow on a site?', 'Ungakwazi ukubona ilanga, umthunzi nokugeleza kwamanzi endaweni?', skill),
  choice('soil_care', 'Can you prepare a bed and explain how to care for its soil?', 'Ungakwazi ukulungisa umbhede uchaze nokunakekelwa komhlabathi wawo?', skill),
  choice('propagation', 'Can you sow seeds and care for seedlings?', 'Ungakwazi ukuhlwanyela imbewu nokunakekela izithombo?', skill),
  core[7], core[8],
];
const app = [
  choice('app_use', 'Have you used ImbewuField in the last 30 days?', 'Uke wasebenzisa i-ImbewuField ezinsukwini ezingu-30 ezedlule?'),
  choice('app_find', 'Can you find the screen you need?', 'Ungakwazi ukuthola isikrini osidingayo?', skill),
  choice('app_record', 'Can you save a harvest or sale in the app?', 'Ungakwazi ukugcina isivuno noma ukuthengisa ku-app?', skill),
  choice('app_language', 'How clear is the language in the app?', 'Lucace kangakanani ulimi olusetshenziswa ku-app?', rating),
  choice('app_reading', 'How easy are the text and pictures to understand?', 'Kulula kangakanani ukuqonda umbhalo nezithombe?', rating),
  choice('app_access', 'What most often stops you using the app?', 'Yini evame ukukuvimbela ukusebenzisa i-app?', [option('none', 'Nothing', 'Akukho'), option('data', 'Data cost or signal', 'Izindleko zedatha noma isignali'), option('device', 'Phone or tablet access', 'Ukuthola ifoni noma ithebhulethi'), option('difficulty', 'I need help using it', 'Ngidinga usizo lokuyisebenzisa'), option('language', 'Language or reading', 'Ulimi noma ukufunda'), option('other', 'Something else', 'Okunye')]),
  text('app_problem', 'What did you try to do that did not work?', 'Yini ozame ukuyenza yangasebenza?'),
  text('app_change', 'What should we improve first?', 'Yini okufanele siyithuthukise kuqala?'),
];
const make = (stage: MelStage, en: string, zu: string, timing: string, questions: MelQuestion[]): MelTemplate => ({ stage, en, zu, timing, questions, version: 1 });
export const MEL_TEMPLATES: Record<MelStage, MelTemplate> = {
  baseline: make('baseline', 'Project baseline', 'Ukuhlola ekuqaleni kwephrojekthi', 'Before project support begins. Record a late baseline as retrospective.', [...core, text('goal', 'What do you hope to achieve through this project?', 'Yini othemba ukuyizuza ngale phrojekthi?')]),
  course_before: make('course_before', 'Before the in-person course', 'Ngaphambi kwesifundo esifundwa ndawonye', 'At the start of the course, before teaching.', practical),
  course_after: make('course_after', 'After the in-person course', 'Ngemva kwesifundo esifundwa ndawonye', 'On the final day. These are self-reported skills; use observed practical work separately.', [...practical, choice('course_clear', 'How clear were the explanations?', 'Izincazelo bezicace kangakanani?', rating), choice('course_practice', 'How useful were the practical activities?', 'Imisebenzi eyenziwe ngezandla ibiwusizo kangakanani?', rating), choice('course_language', 'Could you follow the language used by the trainer?', 'Ukwazile ukulandela ulimi olusetshenziswe umqeqeshi?'), text('course_change', 'What would make this course better?', 'Yini engenza lesi sifundo sibe ngcono?'), text('course_apply', 'What will you try first in your garden?', 'Yini ozoyizama kuqala engadini yakho?')]),
  midpoint: make('midpoint', 'Project midpoint', 'Ukuhlola phakathi nephrojekthi', 'Halfway through delivery, early enough to change support.', [...core, ...support]),
  closeout: make('closeout', 'Project closeout', 'Ukuhlola ekupheleni kwephrojekthi', 'At project completion, using the same recall periods as baseline.', [...core, ...support, choice('continue', 'Do you expect to keep growing after project support ends?', 'Ucabanga ukuthi uzoqhubeka nokutshala lapho usizo lwephrojekthi luphela?'), text('sustain', 'What support will you still need?', 'Yiluphi usizo osazoludinga?')]),
  app_midpoint: make('app_midpoint', 'App feedback · midpoint', 'Impendulo nge-app · phakathi', 'Alongside the midpoint review, as a separate optional form.', app),
  app_closeout: make('app_closeout', 'App feedback · closeout', 'Impendulo nge-app · ekupheleni', 'Repeat at closeout to check whether changes helped.', app),
};

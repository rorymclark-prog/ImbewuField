import type { IsiZuluSilentDeckDraftInput } from './course-deck-silent-drafts';
import { READING_7_SILENT_IMAGE_CUE } from './course-deck-silent-cues';

/** Accepted source-bound text only; image metadata is attached after rendering and proof. */
export type IsiZuluSilentDeckTextCandidate = Pick<IsiZuluSilentDeckDraftInput,
  'moduleId' | 'slide' | 'sourceHeading' | 'sourceEnglish' | 'correctedTitle' | 'correctedTarget' |
  'sourceHash' | 'targetHash' | 'reviewStatus' | 'audioBinding' | 'supplementalImageCue'>;

export const ISIZULU_SILENT_DECK_TEXT_CANDIDATES: readonly IsiZuluSilentDeckTextCandidate[] = [
  {
    "moduleId": "intro-permaculture",
    "slide": 14,
    "sourceHeading": "Integrate Rather Than Segregate",
    "sourceEnglish": [
      "Put each element where it works for its neighbours.",
      "A garden, fruit trees and a chicken run arranged so the chickens rotate through the beds after harvest is integration. Keep chickens away from crops being harvested for food. Fresh manure can carry germs. Ask an extension adviser how to manage the bed safely before edible crops return. The chickens can clean up pests and add fertility instead of sitting idle in a fixed pen.",
      "The same three things, fenced apart, do only their own job.",
      "Pick two or three principles that speak to your biggest problem and apply them hard. The rest become obvious as you go."
    ],
    "correctedTitle": "Hlanganisa, Ungahlukanisi",
    "correctedTarget": [
      "Beka into ngayinye lapho isiza khona izinto eziseduze nayo.",
      "Ingadi, izihlahla zezithelo nendawo yezinkukhu kungahlelwa ukuze izinkukhu zijikeleze emibhedeni ngemva kokuvuna. Gcina izinkukhu zingasondeli ezitshalweni ezivunelwa ukudliwa. Umquba omusha ungaba namagciwane. Ngaphambi kokutshala futhi ukudla okuzodliwa, cela umeluleki wezolimo akutshele ukuthi umbhede ungaphathwa kanjani ngokuphepha.",
      "Izinkukhu zingasiza ekudleni ezinye izinambuzane nasekufakeni umquba, esikhundleni sokuhlala zinganyakazi esibayeni esisodwa.",
      "Lezi zinto ezintathu uma zibiyelwe zahlukaniswa, ngayinye yenza umsebenzi wayo kuphela.",
      "Khetha izimiso ezimbili noma ezintathu ezihambisana nenkinga yakho enkulu, uzisebenzise. Ezinye uzoziqonda njengoba uqhubeka."
    ],
    "sourceHash": "2a52f920c0efd500f63cc1d0e5e44328c637e474c8a74c0e6dbb60a0987c01d0",
    "targetHash": "086a7963a524154bf7f983b2322983ed102aebd78a81cbab59b5b5cbcd1f3051",
    "reviewStatus": "unreviewed",
    "audioBinding": "none"
  },
  {
    "moduleId": "reading-landscape",
    "slide": 4,
    "sourceHeading": "Lesson 1: Where Rain Goes",
    "sourceEnglish": [
      "Before you harvest water, learn where it already goes.",
      "Watch from a safe place during heavy rain. When it is safe afterward, walk your land. Look for rills, places where water fans out, ponds, and where water leaves your property.",
      "Some excess water needs a safe route away so it does not cause damage."
    ],
    "correctedTitle": "Isifundo 1: Lapho Imvula Iya Khona",
    "correctedTarget": [
      "Ngaphambi kokuvuna amanzi, qala ufunde ukuthi asevele eya kuphi. Ngesikhathi semvula enkulu, bheka usemhlabeni ophephile. Hamba uhlole umhlaba kuphela uma sekuphephile ngemva kwemvula. Bheka imifudlana emincane, izindawo lapho amanzi esabalala khona, amachibi, nalapho ephuma khona emhlabeni wakho. Amanye amanzi amaningi adinga indlela ephephile yokuphuma ukuze angabangeli umonakalo."
    ],
    "sourceHash": "b11268a2dcf7909d3859cf33e97dca753939f10ce0c83cbae9defd2b760dc1e4",
    "targetHash": "5518f81a97a96e7c5f12e95443400b58c69f4fb25e72d592bf80a9e1e6658b9c",
    "reviewStatus": "unreviewed",
    "audioBinding": "none"
  },
  {
    "moduleId": "reading-landscape",
    "slide": 7,
    "sourceHeading": "Observe Water Before You Build",
    "sourceEnglish": [
      "Water picks up speed and erosive force as it runs downhill.",
      "There is no one placement rule for every slope. Observe where water moves and gathers.",
      "Poorly laid contours can increase erosion, and soil that takes in water slowly can hold too much. Choose any water works for the site and plan a safe route for excess water."
    ],
    "correctedTitle": "Bheka Amanzi Ngaphambi Kokwakha",
    "correctedTarget": [
      "Amanzi athola isivinini namandla okuguguleka komhlabathi njengoba ehla ngomthambeka. Awukho umthetho owodwa wokubeka izakhiwo zamanzi osebenza kuyo yonke imithambeka. Bheka lapho amanzi ehamba khona nalapho eqoqana khona. Imigqa ye-contour ebekwe kabi ingakhulisa ukuguguleka komhlabathi, kanti umhlabathi omunca amanzi kancane ungagcina amanzi amaningi kakhulu. Khetha izakhiwo zamanzi ezifanele indawo yakho, bese uhlela indlela ephephile yokuphuma kwamanzi amaningi."
    ],
    "sourceHash": "87212edf7482ab13f2163196ff17d8ea11242c40f31299a20f2c2a19d88dad99",
    "targetHash": "abab71a46623cbac731f27ad5cd6534679cc5eeedaf76b0e80724f9b752e4d7c",
    "reviewStatus": "unreviewed",
    "audioBinding": "none",
    "supplementalImageCue": READING_7_SILENT_IMAGE_CUE
  },
  {
    "moduleId": "food-forest",
    "slide": 7,
    "sourceHeading": "Read a Layered Planting Example",
    "sourceEnglish": [
      "The original Highveld example includes Wild Fig or pecan above lemon, naartjie and black mulberry.",
      "It places Cape gooseberry and Wild Medlar with vegetables, wild garlic, sweet potato and granadilla.",
      "Treat this as a layout example, not permission to plant every species. Check identity, frost tolerance, mature size and local restrictions first."
    ],
    "correctedTitle": "Funda Isibonelo Sokutshala Ngezendlalelo",
    "correctedTarget": [
      "Isibonelo sokuqala sase-Highveld sifaka i-Wild Fig noma i-pecan ngaphezu kukalamula, i-naartjie ne-black mulberry. Sihlanganisa i-Cape gooseberry ne-Wild Medlar nemifino, i-wild garlic, ubhatata ne-granadilla. Lesi yisibonelo sokuhlela kuphela; asiyona imvume yokutshala zonke izinhlobo zezitshalo ezisohlwini. Qinisekisa ukuthi isitshalo siyini, siyakwazi yini ukumelana nesithwathwa, sizoba sikhulu kangakanani nokuthi ayikho yini imingcele yendawo ngaphambi kokutshala."
    ],
    "sourceHash": "f6b21e56484270100291113f8426253f9aabe96087222915bc3a493bcab7a5df",
    "targetHash": "abf061237929d21d562839d67a578fca57c21d49cd4247a9585c51501b55ea34",
    "reviewStatus": "unreviewed",
    "audioBinding": "none"
  },
  {
    "moduleId": "food-forest",
    "slide": 11,
    "sourceHeading": "Check the Highveld Examples",
    "sourceEnglish": [
      "The original list includes pecan, walnut and indigenous fig; apple, pear, plum, black mulberry and loquat; rosemary, Wild Medlar, Cape gooseberry and Barbados cherry.",
      "This list is not a blanket recommendation. Check each plant against frost, soil, mature size and the approved local species list.",
      "Keep existing legal and project restrictions in force. Do not plant from a picture alone."
    ],
    "correctedTitle": "Hlola Izibonelo Zase-Highveld",
    "correctedTarget": [
      "Izibonelo zokuqala zifaka i-pecan, i-walnut ne-indigenous fig; i-apple, i-pear, i-plum, i-black mulberry ne-loquat; i-rosemary, i-Wild Medlar, i-Cape gooseberry ne-Barbados cherry. Lezi akuzona izincomo ezisebenza kuzo zonke izindawo. Check each plant against frost, soil, mature size and the approved local species list. Qhubeka ulandela imingcele ekhona yezomthetho neyephrojekthi; ungatshali isitshalo ngokubuka isithombe kuphela."
    ],
    "sourceHash": "5ba4359839d3beac6e20a9c32f3a23b9b14ee0b669de9d81426984580b51f5a2",
    "targetHash": "9d7c4985455d079169fbc70565b5fa5b57b1e0faef9c8fa69586b072ed8cc100",
    "reviewStatus": "unreviewed",
    "audioBinding": "none"
  },
  {
    "moduleId": "food-forest",
    "slide": 12,
    "sourceHeading": "Check the Warm-Region Examples",
    "sourceEnglish": [
      "The original warm-region examples include mango, avocado, Natal Mahogany, banana, pawpaw, litchi, Wild Fig, Barbados cherry and Wild Dagga.",
      "Marula, Mopane and baobab also appear in the Limpopo examples. Local suitability still needs checking.",
      "Useful trees are not automatically edible. Confirm identity and safe use; a landscape photograph is not a food-identification guide."
    ],
    "correctedTitle": "Hlola Izibonelo Zezifunda Ezifudumele",
    "correctedTarget": [
      "Izibonelo zokuqala zezindawo ezifudumele zihlanganisa i-mango, i-avocado, i-Natal Mahogany, i-banana, i-pawpaw, i-litchi, i-Wild Fig, i-Barbados cherry ne-Wild Dagga. I-Marula, i-Mopane ne-baobab nazo zikhona ezibonelweni zase-Limpopo. Hlola ukufaneleka kwendawo yangakini. Ukuba wusizo kwesihlahla akusho ukuthi singadliwa; qinisekisa ukuthi isitshalo siyini nokuthi siphephile yini ukusetshenziswa, ngoba isithombe sendawo asiwona umhlahlandlela wokuhlonza ukudla."
    ],
    "sourceHash": "59865300ad3c32e009ea04e0b90a1733de80d306ffcd9ce4c35b609d8cb0dfe7",
    "targetHash": "60151a3efff5a3a4392aae7fc9cb969cf1b165f3365ab2734b4f6dad1fce14b4",
    "reviewStatus": "unreviewed",
    "audioBinding": "none"
  }
];

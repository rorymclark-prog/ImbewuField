/**
 * Explicit isiZulu proposals for source strings absent from the comparison packets.
 * These remain unreviewed draft wording. Each source field must match the current English
 * catalog exactly before the extraction script applies its paired proposal.
 */
export interface CourseTranslationDraftOverride {
  source: string;
  proposal: string;
}

export const COURSE_TRANSLATION_DRAFT_OVERRIDES: {
  titles: Record<string, CourseTranslationDraftOverride>;
  quizQuestions: Record<string, CourseTranslationDraftOverride[]>;
} = {
  titles: {
    'intro-permaculture-l1': {
      source: 'The Three Ethics: Earth Care, People Care, Fair Share',
      proposal: 'Izimiso Ezintathu Zokuziphatha: Ukunakekela Umhlaba, Abantu Nokubuyisela Okusele',
    },
    'intro-permaculture-l2': {
      source: 'Twelve Principles: Designing with Nature',
      proposal: 'Izimiso Eziyishumi Nambili: Ukuklama Ngokusebenzisana Nemvelo',
    },
    'reading-landscape-l1': {
      source: 'Understanding Water Flow: Where Rain Goes on Your Land',
      proposal: 'Ukuqonda Ukugeleza Kwamanzi: Lapho Imvula Iya Khona Emhlabeni Wakho',
    },
    'reading-landscape-l2': {
      source: 'Sun Angles, Shade, and Aspect: Getting the Most from Sunlight',
      proposal: 'Indlela Ilanga Elihamba Ngayo, Umthunzi Nokuma Komthambeka: Ukusebenzisa Ukukhanya Kwelanga',
    },
    'reading-landscape-l3': {
      source: 'Wind, Frost, and Topography: Reading the Invisible Forces',
      proposal: 'Umoya, Isithwathwa Nokuma Komhlaba: Ukuqonda Amandla Angabonakali',
    },
    'reading-landscape-l4': {
      source: 'Making a Simple Site Map: Your Design Starts on Paper',
      proposal: 'Ukwenza Imephu Elula Yendawo: Uhlelo Lwakho Luqala Ephepheni',
    },
    'water-harvesting-l1': {
      source: 'Swales and Berms: Slowing Water on the Slope',
      proposal: 'Ama-swale Nama-berm: Ukubambezela Amanzi Agelezayo Emthambekeni',
    },
    'water-harvesting-l2': {
      source: 'Farm Dams and Ponds: Storing Water for the Dry Season',
      proposal: 'Amadamu Namachibi Epulazini: Ukugcina Amanzi Esikhathi Esomile',
    },
    'water-harvesting-l3': {
      source: 'Rainwater Tanks and Roof Catchment: Collecting and Protecting Water',
      proposal: 'Amathangi Amanzi Emvula Nokuwabamba Ophahleni: Ukuqoqa Nokuvikela Amanzi',
    },
    'soil-health-l1': {
      source: 'Understanding Your Soil: The Foundation of Everything',
      proposal: 'Ukuqonda Umhlabathi Wakho: Isisekelo Sako Konke',
    },
    'soil-health-l2': {
      source: 'Making and Using Compost',
      proposal: 'Ukwenza Nokusebenzisa I-compost',
    },
    'vegetables-staples-l1': {
      source: 'Preparing and Planting Your Beds',
      proposal: 'Ukulungisa Nokutshala Emibhedeni Yakho',
    },
    'vegetables-staples-l2': {
      source: 'Succession Planting and Intercropping',
      proposal: 'Ukutshala Ngokulandelana Nokuxuba Izitshalo',
    },
    'vegetables-staples-l3': {
      source: 'Staple Crops: Maize, Beans, and Root Vegetables',
      proposal: 'Izitshalo Eziyinhloko Zokudla: Ummbila, Ubhontshisi Nezitshalo Zezimpande',
    },
    'vegetables-staples-l4': {
      source: 'Observe and Manage Pests and Disease',
      proposal: 'Qaphela Futhi Ulawule Izinambuzane Nezifo',
    },
    'food-forest-l1': {
      source: 'The Seven Layers: How a Forest Feeds Itself',
      proposal: 'Izingqimba Eziyisikhombisa: Indlela Ihlathi Elizondla Ngayo',
    },
    'food-forest-l2': {
      source: 'Species Selection for South African Food Forests',
      proposal: 'Ukukhetha Izinhlobo Zezitshalo Zama-food forest ENingizimu Afrika',
    },
    'food-forest-l3': {
      source: 'Establishing a Food Forest: Observe and Adjust',
      proposal: 'Ukusungula I-food forest: Bheka Bese Ulungisa',
    },
    'small-livestock-l1': {
      source: 'Chickens in the System: Pest Control, Fertility, and Food',
      proposal: 'Izinkukhu Ohlelweni Lwepulazi: Ukulawula Izinambuzane, Ukuvunda Komhlabathi Nokudla',
    },
    'small-livestock-l2': {
      source: 'Bees: Pollination, Honey, and System Ecology',
      proposal: 'Izinyosi: Ukuthutha Impova, Uju Nokuphila Kwepulazi',
    },
    'small-livestock-l3': {
      source: 'Integrating Livestock Cycles: Nutrients Moving Through the Farm',
      proposal: 'Ukuhlanganisa Imijikelezo Yemfuyo: Izakhamzimba Ezihamba Epulazini',
    },
    'market-community-l1': {
      source: 'Record-Keeping: Knowing What Your Farm Is Actually Producing',
      proposal: 'Ukugcina Amarekhodi: Ukwazi Lokho Okukhiqizwa Yipulazi Lakho Ngempela',
    },
    'market-community-l2': {
      source: 'Selling Surplus: Where to Sell and How to Price',
      proposal: 'Ukuthengisa Umkhiqizo Osele: Lapho Ungathengisa Khona Nendlela Yokubeka Intengo',
    },
    'market-community-l3': {
      source: 'Building Community Food Networks: Strength in Numbers',
      proposal: 'Ukwakha Amanethiwekhi Okudla Omphakathi: Amandla Ngokubambisana',
    },
  },
  quizQuestions: {
    'small-livestock-l1': [
      {
        source: 'You want chickens to prepare an empty bed for replanting. When\'s the right time to put them in?',
        proposal: 'Ufuna izinkukhu zilungise umbhede ongenalutho ukuze uphinde utshale. Yisiphi isikhathi esifanele sokuzifaka kuwo?',
      },
      {
        source: 'Why are ducks better suited than chickens to an established food forest understorey?',
        proposal: 'Kungani amadada engase afaneleke kakhulu kunezinkukhu endaweni enezitshalo ezingaphansi kwe-food forest esesimile?',
      },
    ],
    'small-livestock-l2': [
      {
        source: 'Avocado trees flower but set little fruit. What should the farmer check about pollination?',
        proposal: 'Izihlahla zikakwatapheya ziyaqhakaza kodwa zibopha izithelo ezimbalwa. Yini okufanele umlimi ayihlole ngokuthuthwa kwempova?',
      },
      {
        source: 'A hive has swarmed repeatedly. What is the best next step?',
        proposal: 'Ikoloni lezinyosi liphume ngamaqoqo kaningi. Yisiphi isinyathelo esilandelayo esifanele?',
      },
    ],
    'small-livestock-l3': [
      {
        source: 'A farmer keeps guinea fowl. How should she manage ticks on her livestock?',
        proposal: 'Umlimi unezinyoni zama-guinea fowl. Kufanele alawule kanjani imikhaza emfuyweni yakhe?',
      },
      {
        source: 'Chickens have foraged behind the goats. What should the farmer do about goat worms?',
        proposal: 'Izinkukhu ziye zafuna ukudla endaweni yezimbuzi. Umlimi kufanele enzeni ngezikelemu zezimbuzi?',
      },
    ],
  },
};

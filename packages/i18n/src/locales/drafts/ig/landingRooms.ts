import type { Translation } from "../../fallback";

/* MACHINE DRAFT, 30 September 2026. Needs a native Igbo speaker's review
   (review-status.ts). The store badges, the slot times and the example
   agent's initials stay as English writes them. */
export const landingRoomsIg = {
  ai: {
    title: "Jụọ n'okwu dị mfe. Nweta ezigbo ebe.",
    body: "Jụọ n'asụsụ Bekee, Yorùbá, Hausa ma ọ bụ Igbo, n'okwu nke gị.",
    caption: "Mkparịta ụka ihe atụ",
    replay: "Kpọọ ọzọ",
    cta: "Jụọ onye enyemaka",
    you: "Gị",
    lawyer: "Jụọ onye ọka iwu tupu ị kwụọ ụgwọ",
    scripts: [
      {
        user: "Flat maka mgbazinye. Ego ole ka ọ ga-efu m ịbanye?",
        reply:
          "Lee abụọ na Vallo. N'otu ọ bụla, mkpokọta ego ịbanye na-agbakwunye ego nchekwa na ụgwọ onye nnọchiteanya, onye ọka iwu na nkwekọrịta ndepụta ahụ kwuru, ọ bụghị naanị mgbazinye.",
      },
      {
        user: "Ebe m ga-anọ na njedebe izu a",
        reply:
          "Ebe obibi abụọ a dị na Vallo. Mepee otu ka ị hụ abalị ndị tọgbọrọ chakoo na mkpokọta ego tupu i debe.",
      },
      {
        user: "Akwụkwọ ala a ọ dị mma?",
        reply:
          "Enweghị m ike ịgwa gị na akwụkwọ ala dị mma. Enwere m ike igosi gị ihe ndepụta ahụ kwuru, onye ọka iwu kwesịkwara ilele akwụkwọ ndị ahụ tupu ị kwụọ ụgwọ ọ bụla.",
      },
    ],
  },
  faq: {
    overline: "Ajụjụ",
    title: "Ajụjụ, a zara ha",
    body: "Azịza dị mkpirikpi. Ebe Enyemaka nwere ndị toro ogologo.",
    help: "Gaa na Ebe Enyemaka",
    groups: {
      property: "Mgbazinye na ịzụta",
      stays: "Ebe obibi na ngwa",
      money: "Ego na nchekwa",
    },
    items: [
      {
        key: "what",
        q: "Gịnị bụ Vallo?",
        a: "Ebe ị ga-agbazite, zụta ma ọ bụ nọrọ n'ofe Naịjirịa, na idebe tebụl. Ndị nwe ụlọ, ala, ụlọ ahịa, ọfịs, họtel, shortlet na ụlọ ọbịa na-edepụta ha, mkparịta ụka, nkwekọrịta na ịkwụ ụgwọ na-anọkwa n'otu akaụntụ.",
      },
      { key: "pay", q: "Kedu ka ịkwụ ụgwọ si arụ ọrụ?" },
      { key: "inspection", q: "M ga-akwụ ụgwọ iji leta ụlọ?" },
      /* NATIVE REVIEW (9 November 2026): the retired "What is the Vallo Guarantee?" stood
         here. Its slot is English's "standing" question, in English (its answer is a
         money constant, English in every locale) until a native reader translates it. */
      { key: "standing", q: "What stands behind my payment?" },
      {
        key: "lister",
        q: "Kedu ka m ga-esi mara onye nọ n'azụ ndepụta?",
        a: "Mmadụ na-eji aka enyocha arịrịọ onye nnọchiteanya ọ bụla tupu ha enwee ike ibipụta, ndepụta ọ bụla na-akpọkwa aha onye nọ n'azụ ya. Akara Enyochara na-apụta naanị mgbe onye na Vallo lelere kaadị njirimara onye nnọchiteanya ahụ.",
      },
      {
        key: "stays",
        q: "Enwere m ike idebe họtel na shortlet?",
        a: "Ee. Vallo Stays na-edepụta họtel, shortlet, ebe ezumike, ụlọ ọbịa na flat a na-elekọta, ụlọ nri na-anabatakwa ndebe tebụl. Ị na-ahụ ụbọchị ndị tọgbọrọ chakoo na mkpokọta ego tupu i debe.",
      },
      {
        key: "list",
        q: "Enwere m ike idepụta ihe onwunwe m?",
        a: "Ee, ihe ọ bụla ọ bụ: ime ụlọ, flat, ụlọ, ụlọ ahịa, ọfịs ma ọ bụ ala. Rịọ ịbụ onye nnọchiteanya, mmadụ na-ejikwa aka enyocha arịrịọ ọ bụla. Naanị ndị nnọchiteanya anabatara nwere ike ibipụta.",
      },
      { key: "payout", q: "Kedu ka ndị nwe ụlọ na ndị nnọchiteanya si enweta ego ha?" },
      { key: "refund", q: "Kedu ka nkwụghachi ego si arụ ọrụ?" },
      {
        key: "ai",
        q: "Gịnị ka onye enyemaka AI nwere ike ime?",
        a: "Ọ na-achọ otu ndepụta ị na-achọ, n'asụsụ Bekee, Yorùbá, Hausa ma ọ bụ Igbo, ma jikọọ ebe ọ bụla ọ kpọrọ aha. Ọ maara ihe ịbanye na-efu, ọ bụghị naanị mgbazinye. Ọ gaghị agwa gị na akwụkwọ ala dị mma: ọ na-ekwu ihe ndepụta kwuru ma zigaa gị n'aka onye ọka iwu.",
      },
      {
        key: "report",
        q: "Ọ bụrụ na ihe adịghị mma?",
        a: "Kọọ ndepụta ma ọ bụ mkparịta ụka ahụ site na menu dị n'akụkụ ya, ọ ga-agakwa n'aka otu Vallo maka nyocha.",
      },
      {
        key: "apps",
        q: "Enwere ngwa?",
        a: "Vallo na-arụ ọrụ n'ihe nchọgharị na ekwentị ma ọ bụ kọmputa ọ bụla, ị nwekwara ike itinye ya na ihuenyo ụlọ gị site na menu ihe nchọgharị. Ebe ngwa iPhone na Android dị, akara ụlọ ahịa ha na-apụta n'ibe a.",
      },
    ],
  },
  close: {
    title: "Chọta ebe ahụ. Debe ndekọ ahụ.",
    body: "Malite site n'ọchụchọ. Ozi ọ bụla, nkwekọrịta na ịkwụ ụgwọ mgbe nke ahụ gasịrị na-anọ na ndekọ.",
    join: "Mepụta akaụntụ gị",
    signIn: "Banye",
  },
  stack: {
    overline: "N'aka gị",
    title: "Oge anọ nke ịkwaga, dịka ị ga-ahụ ha.",
    body: "Ihe atụ sitere na ihuenyo ị ga-eji. Bugharịa ha.",
    hint: "Dọrọ kaadị, ma ọ bụ fechaa ya ka ị hụ nke na-esote.",
    prev: "Kaadị gara aga",
    next: "Kaadị na-esote",
    position: "{n} n'ime {total}",
    cards: {
      listing: {
        title: "Ụgwọ niile dị na kaadị",
        body: "Mkpokọta ego ịbanye na-agbakwunye ego nchekwa na ụgwọ onye nnọchiteanya, onye ọka iwu na nkwekọrịta ndepụta ahụ kwuru, ọ bụghị naanị mgbazinye.",
      },
      viewing: { title: "Dobe oge ileta ụlọ" },
      agent: {
        title: "Mara onye nọ n'azụ ya",
        body: "Ndepụta ọ bụla na-akpọ aha onye nọ n'azụ ya, mmadụ na-ejikwa aka enyocha arịrịọ onye nnọchiteanya ọ bụla tupu ha enwee ike ibipụta.",
      },
      pay: { title: "Kwụọ ụgwọ mgbe unu abụọ kwekọrịtara" },
    },
    ui: {
      example: "Ihe atụ",
      listingTitle: "Flat nwere ime ụlọ ihi ụra abụọ",
      place: "Lekki Phase 1, Legọs",
      rent: "Mgbazinye",
      perYear: "/afọ",
      moveIn: "Mkpokọta ego ịbanye",
      caution: "Nchekwa",
      agency: "Onye nnọchiteanya",
      legal: "Onye ọka iwu",
      agreement: "Nkwekọrịta",
      viewing: "Dobe oge ileta ụlọ",
      date: "Satọdee 4 Ọktoba",
      chosen: "Ahọrọla",
      open: "Mepere emepe",
      noFee: "Enweghị ụgwọ nyocha",
      agentRole: "Onye nnọchiteanya, Lekki",
      reviewed: "Mmadụ nyochara arịrịọ ahụ",
      named: "A kpọrọ aha ya na ndepụta ọ bụla",
      record: "A na-edekọ ozi",
      bank: "Ozugbo gaa n'ụlọ akụ ha",
    },
  },
  journey: {
    overline: "Site n'ọchụchọ ruo n'igodo",
    title: "Nzọụkwụ anọ, otu ndekọ",
    body: "Ọ dịghị ihe na-aga n'ihu ruo mgbe nzọụkwụ bu ya ụzọ gwụrụ.",
    steps: [
      { key: "find", label: "Chọta", title: "Chọta ebe ahụ", body: "Chọọ ụlọ, ala na ebe obibi n'ofe Naịjirịa, ya na mkpokọta ego ịbanye e dere tupu ị kpọọ onye ọ bụla." },
      { key: "inspect", label: "Leta", title: "Jiri anya gị hụ ya" },
      { key: "agree", label: "Kwekọrịta", title: "Kwekọrịta tupu a kwụọ ihe ọ bụla" },
      { key: "move", label: "Banye", title: "Kwụọ ụgwọ, banye" },
    ],
    screen: {
      search: "Chọọ na Legọs",
      inspection: "Nyocha",
      booked: "Edobere",
      you: "Gị",
      owner: "Onye nwe ya",
      approved: "Vallo nabatara ya",
      paid: "Akwụọla",
      theirBank: "Ozugbo gaa n'ụlọ akụ ha",
    },
  },
  bento: {
    overline: "Ihe dị n'ime",
    title: "Ihe niile ịkwaga chọrọ.",
    body: "Ọchụchọ, ebe obibi, onye enyemaka, nkwekọrịta na ozi, n'akụkụ ibe ha.",
    cards: {
      rent: { title: "Gbazite ma zụta", body: "Ụlọ, ala, ụlọ ahịa na ọfịs, ya na mkpokọta ego ịbanye e dere na kaadị." },
      stays: {
        body: "Họtel, shortlet na ụlọ ọbịa, ya na abalị ndị tọgbọrọ chakoo na mkpokọta ego tupu i debe.",
        chips: ["Họtel", "Shortlet", "Ụlọ ọbịa", "Ebe ezumike"],
      },
      ai: {
        body: "Jụọ n'asụsụ Bekee, Yorùbá, Hausa ma ọ bụ Igbo. Ọ na-akpọ aha naanị ebe dị na Vallo.",
        chips: ["Bekee", "Yorùbá", "Hausa", "Igbo"],
      },
      price: { title: "Price Check", body: "Ihe a na-akpọsa ebe ndị yiri ya dị nso, ma ọ bụ \"ezughị iji kwuo\" n'ụzọ doro anya." },
      agree: { title: "Nkwekọrịta na Nkwa", body: "Unu abụọ na-akwado nkwekọrịta tupu ịkwụ ụgwọ ọ bụla emepee." },
      messages: { title: "Ozi", body: "Mkparịta ụka ọ bụla gị na onye ndepụta na-anọ n'elu ikpo okwu, ya mere e nwere ndekọ." },
      feed: { title: "Gburugburu", body: "Ebe, ihe e dere na ndị mmadụ nọ gị nso, site n'otu akaụntụ ahụ." },
    },
  },
  worlds: {
    overline: "Họrọ akụkụ gị",
    property: {
      label: "Ụlọ",
      title: "Ebe ibi, ma ọ bụ inwe",
      body: "Gbazite kwa afọ ma ọ bụ zụta kpam kpam. A na-akpọ aha onye nnọchiteanya, nyocha na-ebu ụzọ tupu ego ọ bụla, nkwekọrịta na-anọkwa na ndekọ.",
      cta: "Chọgharịa ụlọ",
    },
    stays: {
      label: "Ebe obibi",
      title: "Ebe ịnọ n'abalị a",
      body: "Họtel, shortlet na ụlọ ọbịa kwa abalị, ya na ụbọchị ndị tọgbọrọ chakoo na mkpokọta ego tupu i debe.",
      cta: "Chọgharịa ebe obibi",
    },
    flip: "Gbanwee gaa",
  },
  map: {
    overline: "Ebe Vallo bi",
    title: "E wuru ya maka Naịjirịa niile",
    body: "Chọọ nke ọ bụla n'ime obodo ndị a, ma ọ bụ ebe ọ bụla ọzọ ị maara.",
    cities: "Obodo",
  },
} satisfies NonNullable<Translation["landingRooms"]>;

import type { Translation } from "../../fallback";

/* MACHINE DRAFT, 30 September 2026. Needs a native Hausa speaker's review
   (review-status.ts). The store badges, the slot times and the example
   agent's initials stay as English writes them. */
export const landingRoomsHa = {
  ai: {
    title: "Tambaya da kalmomi masu sauƙi. Sami ainihin wurare.",
    body: "Tambaya da Turanci, Yarbanci, Hausa ko Igbo, da kalmominka.",
    caption: "Misalin hira",
    replay: "Sake kunnawa",
    cta: "Tambayi mataimakin",
    you: "Kai",
    lawyer: "Tambayi lauya kafin ka biya",
    scripts: [
      {
        user: "Fulat na haya. Nawa zai ci ni in shiga?",
        reply:
          "Ga guda biyu a Vallo. A kan kowanne, jimlar kuɗin shiga tana haɗa ajiyar kariya da kuɗin wakili, na lauya da na yarjejeniya da jerin ya bayyana, ba haya kaɗai ba.",
      },
      {
        user: "Wurin zama a ƙarshen makon nan",
        reply:
          "Waɗannan masauki biyu suna kan Vallo. Buɗe ɗaya don ganin darare da ke babu kowa da cikakkiyar jimilla kafin ka yi ajiya.",
      },
      {
        user: "Takardar mallakar wannan fili tana da kyau?",
        reply:
          "Ba zan iya gaya maka cewa takardar mallaka tana da kyau ba. Zan iya nuna maka abin da jerin ya faɗa, kuma ya kamata lauya ya duba takardun kafin ka biya komai.",
      },
    ],
  },
  faq: {
    overline: "Tambayoyi",
    title: "Tambayoyi, an amsa",
    body: "Gajerun amsoshi. Cibiyar Taimako tana da dogayen.",
    help: "Ziyarci Cibiyar Taimako",
    groups: {
      property: "Haya da saye",
      stays: "Masauki da manhaja",
      money: "Kuɗi da tsaro",
    },
    items: [
      {
        key: "what",
        q: "Menene Vallo?",
        a: "Wuri ne na haya, saye ko zama a faɗin Najeriya, da ajiyar tebur. Gidaje, filaye, shaguna, ofisoshi, otal-otal, shortlet da gidajen baƙi mutanen da ke bayansu ne suke sanya su, kuma hira, yarjejeniya da biyan kuɗi suna zama a asusu ɗaya.",
      },
      { key: "pay", q: "Yaya biyan kuɗi ke aiki?" },
      { key: "inspection", q: "Shin zan biya don duba gida?" },
      /* NATIVE REVIEW (9 November 2026): the retired "What is the Vallo Guarantee?" stood
         here. Its slot is English's "standing" question, in English (its answer is a
         money constant, English in every locale) until a native reader translates it. */
      { key: "standing", q: "What stands behind my payment?" },
      {
        key: "lister",
        q: "Ta yaya zan san wanda ke bayan jeri?",
        a: "Mutum yana duba kowace takardar neman zama wakili da hannu kafin ya iya bugawa, kuma kowane jeri yana ambaton wanda ke bayansa. Alamar Tabbatacce tana bayyana ne kawai idan wani a Vallo ya duba katin shaidar wannan wakilin.",
      },
      {
        key: "stays",
        q: "Zan iya yin ajiyar otal da shortlet?",
        a: "Ee. Vallo Stays yana lissafa otal-otal, shortlet, wuraren shaƙatawa, gidajen baƙi da fulat masu hidima, kuma gidajen abinci suna karɓar ajiyar tebur. Kana ganin ranakun da ke babu kowa da cikakkiyar jimilla kafin ka yi ajiya.",
      },
      {
        key: "list",
        q: "Zan iya sanya kadarata?",
        a: "Ee, ko menene ita: ɗaki, fulat, gida, shago, ofis ko fili. Nemi zama wakili, kuma mutum yana duba kowace takardar nema da hannu. Wakilai da aka amince da su kaɗai ke iya bugawa.",
      },
      { key: "payout", q: "Ta yaya masu gida da wakilai ke samun kuɗinsu?" },
      { key: "refund", q: "Yaya mayar da kuɗi ke aiki?" },
      {
        key: "ai",
        q: "Me mataimakin AI zai iya yi?",
        a: "Yana binciken jeri iri ɗaya da kai, da Turanci, Yarbanci, Hausa ko Igbo, kuma yana haɗa kowane wurin da ya ambata. Ya san abin da shiga gida ke ci, ba haya kaɗai ba. Ba zai gaya maka cewa takardar mallakar fili tana da kyau ba: yana faɗin abin da jerin ya faɗa kuma yana tura ka wajen lauya.",
      },
      {
        key: "report",
        q: "Idan wani abu bai yi daidai ba fa?",
        a: "Kai rahoton jerin ko hirar daga menu da ke gefensa, kuma zai je wurin ƙungiyar Vallo don dubawa.",
      },
      {
        key: "apps",
        q: "Akwai manhaja?",
        a: "Vallo yana aiki a burauza a kowace waya ko kwamfuta, kuma kana iya ƙara shi a allon gidanka daga menu na burauza. Inda manhajojin iPhone da Android suke, alamominsu na shago suna bayyana a wannan shafi.",
      },
    ],
  },
  close: {
    title: "Nemo wurin. Riƙe rikodin.",
    body: "Fara da bincike. Kowane saƙo, yarjejeniya da biyan kuɗi bayan haka suna zama a rikodi.",
    join: "Ƙirƙiri asusunka",
    signIn: "Shiga",
  },
  stack: {
    overline: "A hannunka",
    title: "Lokuta huɗu na ƙaura, kamar yadda za ka gan su.",
    body: "Misalai daga allon da za ka yi amfani da su. Motsa su.",
    hint: "Ja kati, ko ka kaɗa shi don ganin na gaba.",
    prev: "Katin baya",
    next: "Katin gaba",
    position: "{n} cikin {total}",
    cards: {
      listing: {
        title: "Kowane kuɗi a kan katin",
        body: "Jimlar kuɗin shiga tana haɗa ajiyar kariya da kuɗin wakili, na lauya da na yarjejeniya da jerin ya bayyana, ba haya kaɗai ba.",
      },
      viewing: { title: "Yi ajiyar duba gida" },
      agent: {
        title: "San wanda ke bayansa",
        body: "Kowane jeri yana ambaton wanda ke bayansa, kuma mutum yana duba kowace takardar neman zama wakili da hannu kafin ya iya bugawa.",
      },
      pay: { title: "Biya idan ku biyu kun yarda" },
    },
    ui: {
      example: "Misali",
      listingTitle: "Fulat mai ɗakunan kwana biyu",
      place: "Lekki Phase 1, Legas",
      rent: "Haya",
      perYear: "/shekara",
      moveIn: "Jimlar kuɗin shiga",
      caution: "Kariya",
      agency: "Wakili",
      legal: "Lauya",
      agreement: "Yarjejeniya",
      viewing: "Yi ajiyar duba gida",
      date: "Asabar 4 ga Oktoba",
      chosen: "An zaɓa",
      open: "A buɗe",
      noFee: "Babu kuɗin dubawa",
      agentRole: "Wakili, Lekki",
      reviewed: "Mutum ya duba takardar nema",
      named: "An ambace shi a kowane jeri",
      record: "Ana adana saƙonni a rikodi",
      bank: "Kai tsaye zuwa bankinsu",
    },
  },
  journey: {
    overline: "Daga bincike zuwa makulli",
    title: "Matakai huɗu, rikodi ɗaya",
    body: "Babu abin da ke ci gaba har sai matakin da ke gabansa ya kammala.",
    steps: [
      { key: "find", label: "Nemo", title: "Nemo wurin", body: "Bincika gidaje, filaye da masauki a faɗin Najeriya, tare da jimlar kuɗin shiga a rubuce kafin ka kira kowa." },
      { key: "inspect", label: "Duba", title: "Gani da idonka" },
      { key: "agree", label: "Yarda", title: "Ku yarda kafin a biya komai" },
      { key: "move", label: "Shiga", title: "Biya, ka shiga" },
    ],
    screen: {
      search: "Bincika Legas",
      inspection: "Dubawa",
      booked: "An yi ajiya",
      you: "Kai",
      owner: "Mai gida",
      approved: "Vallo ya amince",
      paid: "An biya",
      theirBank: "Kai tsaye zuwa bankinsu",
    },
  },
  bento: {
    overline: "Abin da ke ciki",
    title: "Duk abin da ƙaura ke buƙata.",
    body: "Bincike, masauki, mataimaki, yarjejeniyoyi da saƙonni, gefe da gefe.",
    cards: {
      rent: { title: "Haya da saye", body: "Gidaje, filaye, shaguna da ofisoshi, tare da jimlar kuɗin shiga a kan katin." },
      stays: {
        body: "Otal-otal, shortlet da gidajen baƙi, tare da darare da ke babu kowa da cikakkiyar jimilla kafin ka yi ajiya.",
        chips: ["Otal-otal", "Shortlet", "Gidajen baƙi", "Wuraren shaƙatawa"],
      },
      ai: {
        body: "Tambaya da Turanci, Yarbanci, Hausa ko Igbo. Yana ambaton wuraren da ke kan Vallo kaɗai.",
        chips: ["Turanci", "Yarbanci", "Hausa", "Igbo"],
      },
      price: { title: "Price Check", body: "Abin da ake tallata wurare makamantan wannan a kusa, ko \"babu isasshen bayani\" kai tsaye." },
      agree: { title: "Yarjejeniyoyi da Garanti", body: "Ku biyu kuna tabbatar da yarjejeniya kafin kowane biyan kuɗi ya buɗe." },
      messages: { title: "Saƙonni", body: "Kowace hira da mai sanarwa tana zama a dandali, don haka akwai rikodi." },
      feed: { title: "Kewaye", body: "Wurare, rubuce-rubuce da mutane kusa da kai, daga asusu ɗaya." },
    },
  },
  worlds: {
    overline: "Zaɓi ɓangarenka",
    property: {
      label: "Gidaje",
      title: "Wurin zama, ko na mallaka",
      body: "Yi haya na shekara ko ka saya gaba ɗaya. Ana ambaton wakilin, dubawa tana zuwa kafin kowane kuɗi, kuma yarjejeniya tana kan rikodi.",
      cta: "Bincika gidaje",
    },
    stays: {
      label: "Masauki",
      title: "Wurin kwana yau da dare",
      body: "Otal-otal, shortlet da gidajen baƙi na dare, tare da ranakun da ke babu kowa da cikakkiyar jimilla kafin ka yi ajiya.",
      cta: "Bincika masauki",
    },
    flip: "Juya zuwa",
  },
  map: {
    overline: "Inda Vallo yake",
    title: "An gina shi don Najeriya baki ɗaya",
    body: "Bincika kowane ɗaya daga cikin waɗannan birane, ko duk inda ka sani.",
    cities: "Birane",
  },
} satisfies NonNullable<Translation["landingRooms"]>;

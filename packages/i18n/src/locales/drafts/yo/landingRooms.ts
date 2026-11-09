import type { Translation } from "../../fallback";

/* MACHINE DRAFT, 30 September 2026. Needs a native Yoruba speaker's review
   (review-status.ts). The store badges, the slot times and the example
   agent's initials stay as English writes them. */
export const landingRoomsYo = {
  ai: {
    title: "Béèrè ní ọ̀rọ̀ tí ó rọrùn. Rí ibi gidi.",
    body: "Béèrè ní Gẹ̀ẹ́sì, Yorùbá, Hausa tàbí Igbo, ní ọ̀rọ̀ ara rẹ.",
    caption: "Àpẹẹrẹ ìfọ̀rọ̀wérọ̀",
    replay: "Tún un ṣe",
    cta: "Béèrè lọ́wọ́ olùrànlọ́wọ́",
    you: "Ìwọ",
    lawyer: "Béèrè lọ́wọ́ agbẹjọ́rò kí o tó san owó",
    scripts: [
      {
        user: "Fúláàtì fún háyà. Èló ni yóò ná mi láti wọlé?",
        reply:
          "Àwọn méjì nìyí lórí Vallo. Lórí ọ̀kọ̀ọ̀kan, àpapọ̀ owó ìwọlé ní owó ìkìlọ̀ àti owó aṣojú, agbẹjọ́rò àti àdéhùn tí àkọsílẹ̀ sọ nínú, kì í ṣe háyà nìkan.",
      },
      {
        user: "Ibi tí màá dé sí ní òpin ọ̀sẹ̀ yìí",
        reply:
          "Àwọn ibùgbé méjì yìí wà lórí Vallo. Ṣí ọ̀kan láti rí àwọn alẹ́ tí ó ṣófo àti àpapọ̀ owó kí o tó ṣe ìfipamọ́.",
      },
      {
        user: "Ṣé ìwé ẹ̀tọ́ ilẹ̀ yìí dára?",
        reply:
          "Mi ò lè sọ fún ọ pé ìwé ẹ̀tọ́ kan dára. Mo lè fi ohun tí àkọsílẹ̀ náà sọ hàn ọ́, agbẹjọ́rò sì yẹ kí ó wo àwọn ìwé náà kí o tó san owó kankan.",
      },
    ],
  },
  faq: {
    overline: "Ìbéèrè",
    title: "Ìbéèrè, pẹ̀lú ìdáhùn",
    body: "Ìdáhùn kúkúrú. Ibùdó Ìrànlọ́wọ́ ní àwọn gígùn.",
    help: "Lọ sí Ibùdó Ìrànlọ́wọ́",
    groups: {
      property: "Háyà àti rírà",
      stays: "Ibùgbé àti áàpù",
      money: "Owó àti ààbò",
    },
    items: [
      {
        key: "what",
        q: "Kí ni Vallo?",
        a: "Ibi láti yá, rà tàbí dé sí káàkiri Nàìjíríà, àti láti ṣe ìfipamọ́ tábìlì. Àwọn ènìyàn tí ó ni ilé, ilẹ̀, ṣọ́ọ̀bù, ọ́fíìsì, hótẹ́ẹ̀lì, shortlet àti ilé àlejò ló ń kéde wọn, ìfọ̀rọ̀wérọ̀, àdéhùn àti ìsanwó sì ń wà nínú àkọọ́lẹ̀ kan.",
      },
      { key: "pay", q: "Báwo ni ìsanwó ṣe ń ṣiṣẹ́?" },
      { key: "inspection", q: "Ṣé màá san owó láti wo ilé?" },
      {
        key: "lister",
        q: "Báwo ni màá ṣe mọ ẹni tí ó wà lẹ́yìn àkọsílẹ̀ kan?",
        a: "Ènìyàn kan ń yẹ gbogbo ìbéèrè aṣojú wò pẹ̀lú ọwọ́ kí wọ́n tó lè tẹ̀ jáde, gbogbo àkọsílẹ̀ sì ń dárúkọ ẹni tí ó wà lẹ́yìn rẹ̀. Àmì Tí a fọwọ́sí ń hàn nìkan nígbà tí ẹnì kan ní Vallo bá ti ṣàyẹ̀wò káàdì ìdánimọ̀ aṣojú náà.",
      },
      {
        key: "stays",
        q: "Ṣé mo lè ṣe ìfipamọ́ hótẹ́ẹ̀lì àti shortlet?",
        a: "Bẹ́ẹ̀ni. Vallo Stays ń kéde hótẹ́ẹ̀lì, shortlet, ibi ìsinmi, ilé àlejò àti fúláàtì olùtọ́jú, àwọn ilé oúnjẹ sì ń gba ìfipamọ́ tábìlì. O ń rí àwọn ọjọ́ tí ó ṣófo àti àpapọ̀ owó kí o tó ṣe ìfipamọ́.",
      },
      {
        key: "list",
        q: "Ṣé mo lè kéde ohun ìní mi?",
        a: "Bẹ́ẹ̀ni, ohunkóhun tí ó bá jẹ́: yàrá, fúláàtì, ilé, ṣọ́ọ̀bù, ọ́fíìsì tàbí ilẹ̀. Béèrè láti di aṣojú, ènìyàn kan sì ń yẹ gbogbo ìbéèrè wò pẹ̀lú ọwọ́. Àwọn aṣojú tí a gbà wọlé nìkan ló lè tẹ̀ jáde.",
      },
      { key: "payout", q: "Báwo ni àwọn onílé àti aṣojú ṣe ń gba owó wọn?" },
      { key: "refund", q: "Báwo ni dídá owó padà ṣe ń ṣiṣẹ́?" },
      {
        key: "ai",
        q: "Kí ni olùrànlọ́wọ́ AI lè ṣe?",
        a: "Ó ń wá àwọn àkọsílẹ̀ kan náà tí o ń wá, ní Gẹ̀ẹ́sì, Yorùbá, Hausa tàbí Igbo, ó sì ń so gbogbo ibi tí ó dárúkọ mọ́ ìjápọ̀. Ó mọ iye tí wíwọlé ń ná, kì í ṣe háyà nìkan. Kò ní sọ fún ọ pé ìwé ẹ̀tọ́ ilẹ̀ dára: ó ń sọ ohun tí àkọsílẹ̀ sọ, ó sì ń rán ọ lọ sọ́dọ̀ agbẹjọ́rò.",
      },
      {
        key: "report",
        q: "Bí nǹkan kan kò bá dà bí ó ti yẹ ńkọ́?",
        a: "Fi ìròyìn àkọsílẹ̀ tàbí ìfọ̀rọ̀wérọ̀ náà ránṣẹ́ láti inú àtòjọ lẹ́gbẹ̀ẹ́ rẹ̀, yóò sì lọ sọ́dọ̀ ẹgbẹ́ Vallo fún àyẹ̀wò.",
      },
      {
        key: "apps",
        q: "Ṣé áàpù wà?",
        a: "Vallo ń ṣiṣẹ́ nínú aṣàwákiri lórí fóònù tàbí kọ̀ǹpútà èyíkéyìí, o sì lè fi kún ojú ìbẹ̀rẹ̀ fóònù rẹ láti inú àtòjọ aṣàwákiri. Níbi tí áàpù iPhone àti Android bá wà, àmì ìtajà wọn ń hàn lórí ojú ewé yìí.",
      },
    ],
  },
  close: {
    title: "Rí ibi náà. Pa àkọsílẹ̀ mọ́.",
    body: "Bẹ̀rẹ̀ pẹ̀lú ìwádìí. Gbogbo ìránṣẹ́, àdéhùn àti ìsanwó lẹ́yìn rẹ̀ ń wà nínú àkọsílẹ̀.",
    join: "Ṣẹ̀dá àkọọ́lẹ̀ rẹ",
    signIn: "Wọlé",
  },
  stack: {
    overline: "Lọ́wọ́ rẹ",
    title: "Àkókò mẹ́rin nínú ìṣílọ, bí o ṣe máa rí wọn.",
    body: "Àpẹẹrẹ láti inú àwọn ojú tí o máa lò. Gbé wọn káàkiri.",
    hint: "Fa káàdì kan, tàbí gbá a láti rí èyí tí ó kàn.",
    prev: "Káàdì tí ó ṣáájú",
    next: "Káàdì tí ó kàn",
    position: "{n} nínú {total}",
    cards: {
      listing: {
        title: "Gbogbo owó lórí káàdì náà",
        body: "Àpapọ̀ owó ìwọlé ní owó ìkìlọ̀ àti owó aṣojú, agbẹjọ́rò àti àdéhùn tí àkọsílẹ̀ sọ nínú, kì í ṣe háyà nìkan.",
      },
      viewing: { title: "Ṣètò wíwo ilé" },
      agent: {
        title: "Mọ ẹni tí ó wà lẹ́yìn rẹ̀",
        body: "Gbogbo àkọsílẹ̀ ń dárúkọ ẹni tí ó wà lẹ́yìn rẹ̀, ènìyàn kan sì ń yẹ gbogbo ìbéèrè aṣojú wò pẹ̀lú ọwọ́ kí wọ́n tó lè tẹ̀ jáde.",
      },
      pay: { title: "Sanwó nígbà tí ẹ̀yin méjèèjì bá fẹnukò" },
    },
    ui: {
      example: "Àpẹẹrẹ",
      listingTitle: "Fúláàtì oní yàrá ìsùn méjì",
      place: "Lekki Phase 1, Èkó",
      rent: "Háyà",
      perYear: "/ọdún",
      moveIn: "Àpapọ̀ owó ìwọlé",
      caution: "Ìkìlọ̀",
      agency: "Aṣojú",
      legal: "Agbẹjọ́rò",
      agreement: "Àdéhùn",
      viewing: "Ṣètò wíwo ilé",
      date: "Àbámẹ́ta 4 Oṣù Kẹwàá",
      chosen: "A ti yàn án",
      open: "Ó ṣí",
      noFee: "Kò sí owó àyẹ̀wò",
      agentRole: "Aṣojú, Lekki",
      reviewed: "Ènìyàn kan yẹ ìbéèrè wò",
      named: "A dárúkọ rẹ̀ lórí gbogbo àkọsílẹ̀",
      record: "A ń pa ìránṣẹ́ mọ́ sínú àkọsílẹ̀",
      bank: "Tààrà sí báńkì wọn",
    },
  },
  journey: {
    overline: "Láti ìwádìí dé kọ́kọ́rọ́",
    title: "Ìgbésẹ̀ mẹ́rin, àkọsílẹ̀ kan",
    body: "Kò sí ohun tí ń tẹ̀síwájú títí ìgbésẹ̀ tí ó ṣáájú rẹ̀ yóò fi parí.",
    steps: [
      { key: "find", label: "Wá", title: "Wá ibi náà", body: "Wá ilé, ilẹ̀ àti ibùgbé káàkiri Nàìjíríà, pẹ̀lú àpapọ̀ owó ìwọlé tí a kọ sílẹ̀ kí o tó pe ẹnikẹ́ni." },
      { key: "inspect", label: "Wò ó", title: "Fojú ara rẹ rí i" },
      { key: "agree", label: "Fẹnukò", title: "Fẹnukò kí a tó san ohunkóhun" },
      { key: "move", label: "Wọlé", title: "Sanwó, kí o sì wọlé" },
    ],
    screen: {
      search: "Wá ní Èkó",
      inspection: "Àyẹ̀wò",
      booked: "A ti ṣètò",
      you: "Ìwọ",
      owner: "Onílé",
      approved: "Vallo ti fọwọ́sí",
      paid: "A ti san",
      theirBank: "Tààrà sí báńkì wọn",
    },
  },
  bento: {
    overline: "Ohun tí ó wà nínú",
    title: "Gbogbo ohun tí ìṣílọ nílò.",
    body: "Ìwádìí, ibùgbé, olùrànlọ́wọ́, àdéhùn àti ìránṣẹ́, lẹ́gbẹ̀ẹ́ ara wọn.",
    cards: {
      rent: { title: "Háyà àti rírà", body: "Ilé, ilẹ̀, ṣọ́ọ̀bù àti ọ́fíìsì, pẹ̀lú àpapọ̀ owó ìwọlé lórí káàdì." },
      stays: {
        body: "Hótẹ́ẹ̀lì, shortlet àti ilé àlejò, pẹ̀lú àwọn alẹ́ tí ó ṣófo àti àpapọ̀ owó kí o tó ṣe ìfipamọ́.",
        chips: ["Hótẹ́ẹ̀lì", "Shortlet", "Ilé àlejò", "Ibi ìsinmi"],
      },
      ai: {
        body: "Béèrè ní Gẹ̀ẹ́sì, Yorùbá, Hausa tàbí Igbo. Ó ń dárúkọ àwọn ibi tí ó wà lórí Vallo nìkan.",
        chips: ["Gẹ̀ẹ́sì", "Yorùbá", "Hausa", "Igbo"],
      },
      price: { title: "Price Check", body: "Iye tí a ń polówó àwọn ibi tí ó jọra nítòsí, tàbí \"kò tó láti sọ\" ní gbangba." },
      agree: { title: "Àdéhùn àti Ìdánilójú", body: "Ẹ̀yin méjèèjì ń fi àdéhùn múlẹ̀ kí ìsanwó kankan tó ṣí." },
      messages: { title: "Ìránṣẹ́", body: "Gbogbo ìfọ̀rọ̀wérọ̀ pẹ̀lú olùkéde ń wà lórí pẹpẹ, nítorí náà àkọsílẹ̀ wà." },
      feed: { title: "Àyíká", body: "Àwọn ibi, ìfìwéránṣẹ́ àti ènìyàn nítòsí rẹ, láti inú àkọọ́lẹ̀ kan náà." },
    },
  },
  worlds: {
    overline: "Yan ẹ̀gbẹ́ rẹ",
    property: {
      label: "Ilé",
      title: "Ibi láti gbé, tàbí láti ní",
      body: "Yá lọ́dọọdún tàbí rà á pátápátá. A ń dárúkọ aṣojú, àyẹ̀wò ń ṣáájú owó kankan, àdéhùn sì wà nínú àkọsílẹ̀.",
      cta: "Ṣàwárí àwọn ilé",
    },
    stays: {
      label: "Ibùgbé",
      title: "Ibi láti sùn lálẹ́ òní",
      body: "Hótẹ́ẹ̀lì, shortlet àti ilé àlejò fún alẹ́ kan, pẹ̀lú àwọn ọjọ́ tí ó ṣófo àti àpapọ̀ owó kí o tó ṣe ìfipamọ́.",
      cta: "Ṣàwárí ibùgbé",
    },
    flip: "Yí sí",
  },
  map: {
    overline: "Ibi tí Vallo wà",
    title: "A kọ́ ọ fún gbogbo Nàìjíríà",
    body: "Wá èyíkéyìí nínú àwọn ìlú wọ̀nyí, tàbí ibikíbi mìíràn tí o mọ̀.",
    cities: "Àwọn ìlú",
  },
} satisfies NonNullable<Translation["landingRooms"]>;

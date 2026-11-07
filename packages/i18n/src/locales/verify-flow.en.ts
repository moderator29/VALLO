/**
 * THE VERIFICATION FLOW'S GRADE 1 WORDS (Platform Grade 1, P0.3, November
 * 2026): the "what will happen" intro, each step's eyebrow, the review's
 * Change. English only, its own namespace, so no translation is invented;
 * the other locales read the English until a native speaker translates it.
 * The steps' own titles and hints stay in `experienceAccount.kyc`.
 */
export const verifyFlowEn = {
  introEyebrow: "Identity check",
  introTitle: "Verify your identity",
  introBody:
    "Vallo checks every lister before their first deal, so renters, guests and buyers know exactly who they are dealing with.",
  introNeedTitle: "What you'll need",
  introNeedId: "A photo of your ID: an international passport, a driver's licence, a NIN slip or card, or a voter's card",
  introNeedSelfie: "A quick live selfie, taken on this screen",
  introNeedAddress: "Proof of address dated in the last 3 months, such as a utility bill",
  introPrivacy:
    "Your documents are private. Only Vallo's verification team sees them, and they never appear on your listings or profile.",
  introTime: "About five minutes. A person checks it, most within one working day, and we tell you either way.",
  introStart: "Start",
  introResume: "Continue where you left off",
  close: "Close",
  change: "Change",
  /* The steps Grade 1 adds or rewords. The rest keep their words in
     `experienceAccount.kyc.steps`. */
  steps: {
    "id-country": {
      title: "Which country issued your ID?",
      hint: "This decides which documents we can accept.",
    },
    "id-type": {
      title: "Which document will you use?",
      hint: "Choose one you have with you now. You will photograph it next.",
    },
    "identity-document": {
      title: "Photograph your ID",
      hint: "Lay it flat on a dark surface in good light. All four corners inside the frame, no glare on the photo or the numbers.",
    },
    review: {
      title: "Review and send",
      hint: "Check every photo and answer. Nothing is sent until you press the button on this screen.",
    },
  },
  country: {
    search: "Search by country name",
    popular: "Popular",
    all: "All countries",
    none: "No country matches that. Check the spelling.",
  },
  capture: {
    front: "Front of document",
    back: "Back of document",
    guide: "Keep all four corners inside the frame",
    rotate: "Rotate guide",
    takePhoto: "Take a photo",
    uploadInstead: "Upload instead",
    shutter: "Take the photo",
    checkTitle: "Check your capture",
    checkHint: "Check every edge and all the text. Retake if anything is cut off, blurry or covered by glare.",
    zoom: "Zoom in",
    zoomClose: "Close",
    retake: "Retake",
    usePhoto: "Use photo",
    saving: "Saving",
    captured: "Captured",
    denied: "Camera access is off for Vallo. Turn it on in your phone's settings, or upload a photo instead.",
    unavailable: "This phone cannot open the camera here. Upload a photo instead.",
    failed: "That photo did not save. Check your connection and try again.",
    signInFirst: "Sign in again to keep going. Nothing you have done here is lost.",
    fileType: "That file is not {formats}. Choose one of those instead.",
    fileSize: "That file is over {size}. Take a photo instead, or choose a smaller file.",
  },
  backOptional: "If your NIN is a card, photograph the back as well. A paper slip has no back to add.",
  review: {
    document: "Document",
    country: "Issued in",
    finalTitle: "Final step: nothing is sent yet",
    finalBody: "Your photos are saved on Vallo, but no one can see them until you press Send for review below.",
  },
  gaps: {
    country: "The country that issued your ID",
    back: "A photo of the back of your ID",
  },
  /* Sections, not the step's own title: the eyebrow says where you are in
     the flow (reference R18: THE BASICS, LOCATION, FINISH). */
  eyebrows: {
    "id-country": "Identity",
    "id-type": "Identity",
    "identity-document": "Identity",
    selfie: "Selfie",
    "address-document": "Address",
    "business-question": "Business",
    "business-details": "Business",
    consent: "Agreements",
    review: "Finish",
  },
};

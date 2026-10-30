/**
 * OUTBOUND MAIL IN THE MEMBER'S OWN LANGUAGE (recommendation A11).
 *
 * The words of the account, security and booking emails, moved out of the
 * builders in `apps/web/src/lib/email/messages.ts` unchanged, so a builder
 * can be asked for Hausa, Yoruba or Igbo and still fall back to English for a
 * string a translation lacks (`withFallback`). `{name}`-style placeholders are
 * filled by the builder. The English output is byte for byte what it was.
 *
 * Every security email in another language also carries one plain English
 * line (`securityInEnglish`), so anybody helping the reader can see what it
 * is about.
 */
export const mailEn = {
  common: {
    hello: "Hello {name}.",
    helloThere: "Hello there.",
    moneySafety:
      "Keep your chats and your payments inside Vallo, and pay only after you have inspected the property.",
    alwaysSent: "This is a security notice. It is always sent and it cannot be switched off.",
    rows: {
      when: "When",
      device: "Device",
      near: "Near",
      stay: "Stay",
      dates: "Dates",
      length: "Length",
      guests: "Guests",
      arriving: "Arriving",
      theirNumber: "Their number",
      totalForStay: "Total for the stay",
      status: "Status",
      estate: "Estate",
      gettingIn: "Getting in",
      securityDesk: "Security desk",
      gateCode: "Gate code",
    },
    partyJoin: "{first} and {second}",
  },
  verificationCode: {
    subject: "{code} is your Vallo code",
    preheader: "It works once and expires in {minutes} minutes.",
    heading: "Your Vallo code",
    lead: "{hello} Here is your code.",
    expiry: "It works once and expires in {minutes} minutes.",
    note: "If you did not ask for this, ignore this email.",
    footerWhy: "Sent because a code was requested for this address.",
    footerNever: "Vallo will never ask you for this code.",
    securityInEnglish: "Vallo sign-in code. It works once. Vallo will never ask you for it.",
  },
  passwordReset: {
    subject: "Your Vallo password reset code",
    preheader: "It works once and expires in {minutes} minutes.",
    heading: "Reset your password",
    lead: "{hello} Enter this code in Vallo to set a new password.",
    codeExpiry: "It works once and expires in {minutes} minutes. Not you? Ignore this email.",
    button: "Set a new password",
    linkExpiry: "The link expires in {minutes} minutes and works once, in the browser you asked from.",
    codeInstead: "Opening this somewhere else, or in your mail app? Type this code instead:",
    codeOnly: "Type this code on the reset screen:",
    codeWhere: "Enter it at {url}. It works on any device, once, for {minutes} minutes.",
    note: "If this was not you, ignore this email. Your password has not changed.",
    footerWhy: "Sent because a password reset was requested for this address.",
    securityInEnglish: "Vallo password reset. If you did not ask for it, ignore this email.",
  },
  passwordChanged: {
    subject: "Your Vallo password was changed",
    preheaderAt: "Changed {at}. If this was not you, set a new one now.",
    preheader: "If this was not you, set a new password now.",
    heading: "Your password was changed",
    lead: "{hello} The password on your Vallo account has been changed.",
    ifYou: "If that was you, there is nothing to do and you can ignore this message.",
    ifNot: "If it was not you, somebody else knows your password. Set a new one now, before anything else.",
    button: "Set a new password",
    note: "Vallo will never ask you for your password, by phone, by message or by email. If somebody does, it is not us.",
    footerWhy: "You are receiving this because the password on this address was changed.",
    securityInEnglish: "Security notice: the password on this Vallo account was changed.",
  },
  newDeviceSignIn: {
    subject: "New sign-in to your Vallo account",
    whoNear: "{device} near {place}",
    placeOnly: "A device near {place}",
    preheaderWho: "{who} signed in.",
    preheaderWhoAt: "{who} signed in on {at}.",
    preheader: "A device your account has not seen before signed in.",
    heading: "New sign-in",
    lead: "{hello} Somebody signed in to your Vallo account from a device it has not seen before.",
    ifYou: "If that was you, there is nothing to do and you can ignore this message.",
    ifNot: "If it was not you, set a new password first, then remove the device from your account.",
    button: "Review your devices",
    note: "Vallo will never ask you for your password or a sign-in code, by phone, by message or by email.",
    footerWhy: "You are receiving this because a device signed in to this account for the first time.",
    securityInEnglish: "Security notice: a new device signed in to this Vallo account.",
  },
  bookingConfirmed: {
    subject: "Booking confirmed",
    preheader: "{range}, {nights}. The host confirmed your dates.",
    heading: "Booking confirmed",
    lead: "{hello} The host confirmed your booking, so {range} is yours.",
    gate: "Here is how to get in when you arrive.",
    arriving:
      "We have sent {name} their own copy of the dates and the arrival details, so they have everything they need at the gate.",
    inApp: "Your booking now shows as confirmed in the app, where you can find the details and message the host.",
    button: "View my booking",
    note: "Plans changed? You can cancel from your bookings before the stay begins.",
    footerWhy: "You are receiving this because you booked a stay on Vallo.",
  },
  bookingCancelled: {
    subject: "Booking cancelled",
    preheader: "Your stay for {range} is cancelled and the dates are released.",
    heading: "Booking cancelled",
    lead: "{hello} This booking is now cancelled, and the dates have been released.",
    status: "Cancelled",
    nothingLeft:
      "There is nothing left for you to do. The booking stays in your history for your records, and you are free to book other dates whenever you are ready.",
    button: "Find another place",
    note: "If you did not expect this cancellation, contact support from the app and a person will look into it.",
    footerWhy: "You are receiving this because of a change to your Vallo booking.",
  },
  bookingRefunded: {
    subjectRefund: "{amount} refund on its way to your card",
    subjectCancelled: "Stay cancelled",
    preheaderRefund: "{title} is cancelled; {refund} of {paid} comes back.",
    headingRefund: "Refund on its way",
    headingCancelled: "Stay cancelled",
    lead: "{hello} A person at Vallo has cancelled this stay and released the dates.",
    paid: "You had paid",
    goingBack: "Going back to your card",
    kept: "Kept by the host",
    refundRoute:
      "A refund goes back to the card or bank account you paid with, through our payment processor. Banks usually show it within 5 to 10 working days.",
    nothingTaken:
      "Nothing has been taken from you beyond what you had already paid for this stay, and the booking stays in your history for your records.",
    buttonRefund: "Open your bookings",
    buttonCancelled: "Find another place",
    note: "If this amount does not look right to you, reply to support with the reference above and a person will go through it with you.",
    footerWhy: "You are receiving this because of a change to your Vallo booking.",
  },
};

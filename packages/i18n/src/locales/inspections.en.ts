/**
 * Inspection report copy (SW11). Moved from:
 *   - lib/inspections/report.ts (ROOM_COPY)
 *   - lib/bookings/instant-pay.ts (INSTANT_ROOM_COPY)
 */

export const roomCopyEn = {
  exterior: { title: "Exterior", detail: "Building structure, compound, security, parking" },
  interior: { title: "Interior", detail: "Rooms, walls, ceilings, doors, windows" },
  kitchen: { title: "Kitchen", detail: "Cabinets, appliances, plumbing, ventilation" },
  bathrooms: { title: "Bathrooms", detail: "Fixtures, tiles, water pressure, drainage" },
  utilities: { title: "Utilities", detail: "Power, water, internet, AC" },
  appliances: { title: "Appliances", detail: "Fridge, cooker, washing machine, others" },
  safety: { title: "Safety", detail: "Smoke detectors, fire safety, locks, security" },
  overall: { title: "Overall condition", detail: "General notes and photos" },
};

export const instantRoomCopyEn = {
  action: "Book and pay",
  bodyTemplate:
    "This is the hotel's own price. Book now and pay by card on the next screen; the payment goes straight to the hotel. Your room is held for {minutes} minutes while you pay.",
};

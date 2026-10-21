import type { Translation } from "../../fallback";
import { passcodeIg } from "./passcode";
import { deskIg } from "./desk";
import { publicMetaIg } from "./publicMeta";
import { hostWorkspaceIg } from "./hostWorkspace";
import { frontDoorIg } from "./frontDoor";
import { landingRoomsIg } from "./landingRooms";
import { trustDoorsIg } from "./trustDoors";
import { shapeIg } from "./shape";
import { afterTheGateIg } from "./afterTheGate";
import { trustVisibleIg } from "./trustVisible";
import { platformIg } from "./platform";
import { priceCheckIg } from "./priceCheck";
import { landlordIg } from "./landlord";
import { cryptoPayIg } from "./cryptoPay";
import { arrivalCheckIg } from "./arrivalCheck";
import { reelIg } from "./reel";
import { mailIg } from "./mail";
import { compliancePepIg } from "./compliancePep";
import { complianceRiskIg } from "./complianceRisk";
import { complianceBeneficialOwnershipIg } from "./complianceBeneficialOwnership";
import { visitIg } from "./visit";
import { memberFlowsIg } from "./memberFlows";

/**
 * Every machine-drafted namespace for this locale, laid under the locale
 * file by `withFallback`. MACHINE DRAFTS, NOT FINAL: each namespace here is
 * recorded as `machine-draft` in `review-status.ts` until a native speaker
 * has read it.
 */
export const igDrafts = {
  passcode: passcodeIg,
  desk: deskIg,
  publicMeta: publicMetaIg,
  hostWorkspace: hostWorkspaceIg,
  frontDoor: frontDoorIg,
  landingRooms: landingRoomsIg,
  trustDoors: trustDoorsIg,
  shape: shapeIg,
  afterTheGate: afterTheGateIg,
  trustVisible: trustVisibleIg,
  platform: platformIg,
  priceCheck: priceCheckIg,
  landlord: landlordIg,
  cryptoPay: cryptoPayIg,
  arrivalCheck: arrivalCheckIg,
  reel: reelIg,
  mail: mailIg,
  compliancePep: compliancePepIg,
  complianceRisk: complianceRiskIg,
  complianceBeneficialOwnership: complianceBeneficialOwnershipIg,
  visit: visitIg,
  memberFlows: memberFlowsIg,
} satisfies Translation;

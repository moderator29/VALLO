import type { Translation } from "../../fallback";
import { passcodeYo } from "./passcode";
import { deskYo } from "./desk";
import { publicMetaYo } from "./publicMeta";
import { hostWorkspaceYo } from "./hostWorkspace";
import { frontDoorYo } from "./frontDoor";
import { landingRoomsYo } from "./landingRooms";
import { trustDoorsYo } from "./trustDoors";
import { shapeYo } from "./shape";
import { afterTheGateYo } from "./afterTheGate";
import { trustVisibleYo } from "./trustVisible";
import { platformYo } from "./platform";
import { priceCheckYo } from "./priceCheck";
import { landlordYo } from "./landlord";
import { cryptoPayYo } from "./cryptoPay";
import { arrivalCheckYo } from "./arrivalCheck";
import { reelYo } from "./reel";
import { mailYo } from "./mail";
import { compliancePepYo } from "./compliancePep";
import { complianceRiskYo } from "./complianceRisk";
import { complianceBeneficialOwnershipYo } from "./complianceBeneficialOwnership";
import { visitYo } from "./visit";
import { memberFlowsYo } from "./memberFlows";

/**
 * Every machine-drafted namespace for this locale, laid under the locale
 * file by `withFallback`. MACHINE DRAFTS, NOT FINAL: each namespace here is
 * recorded as `machine-draft` in `review-status.ts` until a native speaker
 * has read it.
 */
export const yoDrafts = {
  passcode: passcodeYo,
  desk: deskYo,
  publicMeta: publicMetaYo,
  hostWorkspace: hostWorkspaceYo,
  frontDoor: frontDoorYo,
  landingRooms: landingRoomsYo,
  trustDoors: trustDoorsYo,
  shape: shapeYo,
  afterTheGate: afterTheGateYo,
  trustVisible: trustVisibleYo,
  platform: platformYo,
  priceCheck: priceCheckYo,
  landlord: landlordYo,
  cryptoPay: cryptoPayYo,
  arrivalCheck: arrivalCheckYo,
  reel: reelYo,
  mail: mailYo,
  compliancePep: compliancePepYo,
  complianceRisk: complianceRiskYo,
  complianceBeneficialOwnership: complianceBeneficialOwnershipYo,
  visit: visitYo,
  memberFlows: memberFlowsYo,
} satisfies Translation;

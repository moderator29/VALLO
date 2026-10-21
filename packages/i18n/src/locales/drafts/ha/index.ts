import type { Translation } from "../../fallback";
import { passcodeHa } from "./passcode";
import { deskHa } from "./desk";
import { publicMetaHa } from "./publicMeta";
import { hostWorkspaceHa } from "./hostWorkspace";
import { frontDoorHa } from "./frontDoor";
import { landingRoomsHa } from "./landingRooms";
import { trustDoorsHa } from "./trustDoors";
import { shapeHa } from "./shape";
import { afterTheGateHa } from "./afterTheGate";
import { trustVisibleHa } from "./trustVisible";
import { platformHa } from "./platform";
import { priceCheckHa } from "./priceCheck";
import { landlordHa } from "./landlord";
import { cryptoPayHa } from "./cryptoPay";
import { arrivalCheckHa } from "./arrivalCheck";
import { reelHa } from "./reel";
import { mailHa } from "./mail";
import { compliancePepHa } from "./compliancePep";
import { complianceRiskHa } from "./complianceRisk";
import { complianceBeneficialOwnershipHa } from "./complianceBeneficialOwnership";
import { visitHa } from "./visit";
import { memberFlowsHa } from "./memberFlows";

/**
 * Every machine-drafted namespace for this locale, laid under the locale
 * file by `withFallback`. MACHINE DRAFTS, NOT FINAL: each namespace here is
 * recorded as `machine-draft` in `review-status.ts` until a native speaker
 * has read it.
 */
export const haDrafts = {
  passcode: passcodeHa,
  desk: deskHa,
  publicMeta: publicMetaHa,
  hostWorkspace: hostWorkspaceHa,
  frontDoor: frontDoorHa,
  landingRooms: landingRoomsHa,
  trustDoors: trustDoorsHa,
  shape: shapeHa,
  afterTheGate: afterTheGateHa,
  trustVisible: trustVisibleHa,
  platform: platformHa,
  priceCheck: priceCheckHa,
  landlord: landlordHa,
  cryptoPay: cryptoPayHa,
  arrivalCheck: arrivalCheckHa,
  reel: reelHa,
  mail: mailHa,
  compliancePep: compliancePepHa,
  complianceRisk: complianceRiskHa,
  complianceBeneficialOwnership: complianceBeneficialOwnershipHa,
  visit: visitHa,
  memberFlows: memberFlowsHa,
} satisfies Translation;

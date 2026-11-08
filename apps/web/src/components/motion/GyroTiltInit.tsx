"use client";

import { useEffect } from "react";
import { startGyroTilt } from "@/lib/motion/gyro-tilt";

export function GyroTiltInit() {
  useEffect(() => startGyroTilt(), []);
  return null;
}

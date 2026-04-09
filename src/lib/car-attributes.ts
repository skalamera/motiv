/** Fixed pick lists for garage UI and AI car imagery. */

export const CAR_BODY_TYPES = [
  "Coupe",
  "Sedan",
  "Convertible",
  "SUV",
  "Pick-up",
  "Hatchback",
] as const;

export const CAR_DRIVETRAINS = ["4WD", "AWD", "FWD", "RWD"] as const;

export type CarBodyType = (typeof CAR_BODY_TYPES)[number];
export type CarDrivetrain = (typeof CAR_DRIVETRAINS)[number];

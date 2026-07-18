// Plain TypeScript interfaces describing our data shapes (see docs/DATA_MODEL.md).
// These aren't Angular-specific — just types the services and components share.

export interface PlayerCharacter {
  id: string;
  partyId: string;
  name: string;
  /** Signed integer added to a d20 roll, e.g. 3, 0, -1. */
  initiativeModifier: number;
}

export interface Party {
  id: string;
  name: string;
  pcIds: string[];
}

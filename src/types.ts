import {
  LovelaceCard,
  LovelaceCardConfig,
} from "custom-card-helpers/dist/types";

export interface CardHelpers {
  createCardElement(config: LovelaceCardConfig): LovelaceCard;
}

declare global {
  interface Window {
    loadCardHelpers(): Promise<CardHelpers>;
    customCards?: CustomCardEntry[];
  }
}
interface CustomCardEntry {
  type: string;
  name?: string;
  description?: string;
  preview?: boolean;
  documentationURL?: string;
}

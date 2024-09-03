import { LovelaceCard, LovelaceCardConfig } from "custom-card-helpers/dist/types";

export interface CardHelpers {
  createCardElement(config: LovelaceCardConfig): LovelaceCard;
}

declare global {
  interface Window {
    loadCardHelpers(): Promise<CardHelpers>;
  }
}
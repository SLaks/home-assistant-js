import { css, unsafeCSS } from "lit";

export const desktopMode = unsafeCSS`(min-width: 1165px)`;
export const mobileMode = unsafeCSS`(max-width: 1164px)`;
export const veryMobileMode = unsafeCSS`(max-width: 429px)`;

/** Classes that are used by multiple components. */
export const utilityClasses = css`
  .SetBackgroundColor {
    --gender-background: color-mix(
      in lab,
      transparent 30%,
      var(--gender-color)
    );
  }
`;

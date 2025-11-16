/// <reference types="vite/client" />

interface Calendly {
  initBadgeWidget: (options: {
    url: string;
    text: string;
    color: string;
    textColor: string;
    branding: boolean;
  }) => void;
  initPopupWidget: (options: {
    url: string;
  }) => void;
}

interface Window {
  Calendly?: Calendly;
}

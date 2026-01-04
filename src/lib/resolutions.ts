export type ResolutionGroup = "Desktop" | "Mobile";

export type ResolutionOption = {
  value: string;
  label: string;
  group: ResolutionGroup;
};

export const DEFAULT_RESOLUTION = "1920x1080";

export const RESOLUTION_OPTIONS: ResolutionOption[] = [
  {
    value: "1920x1080",
    label: "Standard Full HD (Desktop)",
    group: "Desktop",
  },
  {
    value: "1366x768",
    label: "Widescreen Laptop",
    group: "Desktop",
  },
  {
    value: "1536x864",
    label: "High-Resolution Laptop",
    group: "Desktop",
  },
  {
    value: "1280x720",
    label: "Small Desktop Monitor",
    group: "Desktop",
  },
  {
    value: "1024x768",
    label: "Minimum Supported Desktop Viewport",
    group: "Desktop",
  },
  {
    value: "414x896",
    label: "iPhone XR, iPhone 11",
    group: "Mobile",
  },
  {
    value: "390x844",
    label: "iPhone 12, iPhone 13, iPhone 14",
    group: "Mobile",
  },
  {
    value: "375x812",
    label: "iPhone X, iPhone XS",
    group: "Mobile",
  },
  {
    value: "360x800",
    label: "Standard Android Phone",
    group: "Mobile",
  },
  {
    value: "320x568",
    label: "iPhone SE, Small Devices",
    group: "Mobile",
  },
];

const ALLOWED_RESOLUTIONS = new Set(RESOLUTION_OPTIONS.map((option) => option.value));

const LEGACY_RESOLUTION_MAP: Record<string, string> = {
  "Desktop Standard": "1920x1080",
  "Desktop Large": "1920x1080",
  Laptop: "1366x768",
  Tablet: "1024x768",
  Mobile: "375x812",
};

export const normalizeResolution = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  const mapped = LEGACY_RESOLUTION_MAP[trimmed] || trimmed;
  if (ALLOWED_RESOLUTIONS.has(mapped)) {
    return mapped;
  }
  return null;
};

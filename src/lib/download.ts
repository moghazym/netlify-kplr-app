
export function triggerDownload(downloadUrl: string, fileName?: string) {
  try {
    // Create an anchor and click it to trigger the browser download behavior
    const link = document.createElement("a");
    link.href = downloadUrl;
    if (fileName) link.download = fileName;
    // Some browsers require the link to be in the document
    document.body.appendChild(link);
    link.click();
    link.remove();
  } catch (err) {
    // Fallback: open in new tab/window so user can manually save
    // This may be blocked by pop-up blockers in some browsers.
    try {
      window.open(downloadUrl, "_blank");
    } catch (e) {
      // Last resort: set location
      window.location.href = downloadUrl;
    }
  }
}

export default triggerDownload;

export type PlatformId = "windows" | "mac-arm" | "mac-intel";

/**
 * Detect the user's likely platform (Windows / macOS ARM / macOS Intel).
 * This mirrors the logic previously in the Download page but is
 * centralized so it can be reused elsewhere.
 */
export function detectPlatform(): PlatformId {
  if (typeof window === "undefined") return "windows";

  const nav = window.navigator;
  const uaRaw = nav.userAgent || "";
  const ua = uaRaw.toLowerCase();
  const platform = (nav.platform || "").toLowerCase();

  // Check for Windows first
  if (platform.includes("win") || ua.includes("windows")) {
    return "windows";
  }

  // Check for macOS
  const isMac =
    platform.includes("mac") || ua.includes("mac os") || ua.includes("macos");
  if (isMac) {
    const navWithUAData = nav as Navigator & {
      userAgentData?: {
        platform?: string;
        architecture?: string;
        getHighEntropyValues?: (
          hints: string[]
        ) => Promise<{ architecture?: string }>;
      };
    };

    if (navWithUAData.userAgentData?.architecture) {
      const arch = navWithUAData.userAgentData.architecture.toLowerCase();
      if (arch.includes("arm") || arch === "arm64") return "mac-arm";
      if (arch.includes("x86") || arch.includes("x64")) return "mac-intel";
    }

    const armIndicators = [
      "arm64",
      "aarch64",
      "apple silicon",
      "apple m1",
      "apple m2",
      "apple m3",
      "apple m4",
    ];

    const hasArmIndicator = armIndicators.some((indicator) =>
      ua.includes(indicator)
    );
    if (hasArmIndicator) return "mac-arm";

    // Default to ARM for modern Macs as a safer default
    return "mac-arm";
  }

  return "windows";
}

export interface CameraScannerController {
  stop(): void;
  destroy(): void;
}

interface DetailedScanResult {
  data: string;
}

interface ScannerInstance {
  start(): Promise<void>;
  stop(): void;
  destroy(): void;
}

type ScannerConstructor = new (
  video: HTMLVideoElement,
  onDecode: (result: string | DetailedScanResult) => void,
  options: {
    preferredCamera: "environment";
    returnDetailedScanResult: true;
    highlightScanRegion: true;
    highlightCodeOutline: true;
    maxScansPerSecond: number;
  },
) => ScannerInstance;

export type ScannerModuleLoader = () => Promise<{ default: ScannerConstructor }>;

async function loadQrScanner() {
  // qr-scanner ships its own declarations. The ignore keeps an existing local
  // checkout typecheckable before npm ci installs the newly locked dependency.
  /* eslint-disable @typescript-eslint/ban-ts-comment -- local checkout may precede npm ci */
  // @ts-ignore -- installed by the package lock in clean/CI environments
  return import("qr-scanner") as Promise<{ default: ScannerConstructor }>;
  /* eslint-enable @typescript-eslint/ban-ts-comment */
}

export async function startQrCamera(
  video: HTMLVideoElement,
  onDecode: (token: string) => void,
  loadScanner: ScannerModuleLoader = loadQrScanner,
): Promise<CameraScannerController> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new DOMException("Camera APIs are unavailable", "NotSupportedError");
  }

  const { default: QrScanner } = await loadScanner();
  const scanner = new QrScanner(
    video,
    (result) => {
      const token = typeof result === "string" ? result : result.data;
      if (token.trim()) onDecode(token.trim());
    },
    {
      preferredCamera: "environment",
      returnDetailedScanResult: true,
      highlightScanRegion: true,
      highlightCodeOutline: true,
      maxScansPerSecond: 5,
    },
  );
  try {
    await scanner.start();
  } catch (error) {
    scanner.stop();
    scanner.destroy();
    throw error;
  }

  let stopped = false;
  return {
    stop() {
      if (stopped) return;
      stopped = true;
      scanner.stop();
    },
    destroy() {
      if (!stopped) {
        stopped = true;
        scanner.stop();
      }
      scanner.destroy();
    },
  };
}

export interface PassVerificationResult {
  ok: boolean;
  data: {
    outcome?: string;
    passengerName?: string;
    error?: string | { message?: string };
  };
}

export async function verifyScannedPass(input: {
  fetcher: typeof fetch;
  tripId: string;
  mode: "BOARDING" | "ALIGHTING";
  token: string;
}): Promise<PassVerificationResult> {
  const endpoint =
    input.mode === "BOARDING"
      ? `/api/trips/${input.tripId}/scan`
      : `/api/trips/${input.tripId}/alight`;
  const body =
    input.mode === "BOARDING"
      ? { token: input.token }
      : { mode: "QR", token: input.token };
  const response = await input.fetcher(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { ok: response.ok, data: await response.json() };
}

import { useEffect, useRef, useState } from 'react';

// Define Quagga interface based on actual usage in the code
interface QuaggaInstance {
  init: (config: unknown, callback: (err: unknown) => void) => Promise<void>;
  start: () => void;
  stop: () => void;
  isRunning: () => boolean;
  onDetected: (callback: (result: { codeResult: { code: string | null } }) => void) => { removeAllListeners: () => void };
  offDetected: (callback: (result: unknown) => void) => void;
  decodeSingle: (options: unknown) => Promise<{ codeResult: { code: string | null } | null }>;
}

// Import quagga dynamically to avoid SSR issues
let Quagga: QuaggaInstance | null = null;

async function loadQuagga() {
  if (!Quagga) {
    const { default: quaggaModule } = await import('quagga');
    Quagga = quaggaModule;
  }
  return Quagga;
}

export function useBarcodeScanner(
  onBarcodeDetected: (barcode: string) => void,
  options: {
    delayBetweenScans?: number; // ms
    onError?: (error: Error) => void;
    onScanComplete?: () => void;
  } = {}
) {
  const {
    delayBetweenScans = 1500, // Prevent duplicate scans
    onError,
    onScanComplete
  } = options;

  const videoRef = useRef<HTMLVideoElement>(null);
  const lastScanTime = useRef<number>(0);
  const isScanning = useRef<boolean>(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isScanningState, setIsScanningState] = useState(false);

  // Initialize Quagga
  useEffect(() => {
    async function initScanner() {
      try {
        await loadQuagga();
        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to load Quagga:', error);
        setIsInitialized(false);
        onError?.(error as Error);
      }
    }

    initScanner();

    // Cleanup
    return () => {
      if (Quagga && Quagga.isRunning()) {
        Quagga.stop();
      }
    };
  }, [onError]);

  // Start/stop scanning based on initialization
  useEffect(() => {
    if (!isInitialized || !videoRef.current) return;

    let onDetectedHandler: { removeAllListeners: () => void } | null = null;

    const startScanning = async () => {
      if (isScanning.current) return;

      try {
        isScanning.current = true;
        setIsScanningState(true);

        await loadQuagga(); // Ensure Quagga is loaded

        if (!Quagga) {
          throw new Error('Quagga is not loaded');
        }
        Quagga.init({
          inputStream: {
            name: 'Live',
            type: 'LiveStream',
            target: videoRef.current,
            constraints: {
              width: 640,
              height: 480,
              facingMode: 'environment', // Prefer rear camera
            },
          },
          locator: {
            patchSize: 'medium',
            halfSample: true,
          },
          numOfWorkers: navigator.hardwareConcurrency || 2,
          decoder: {
            readers: ['ean_reader', 'ean_8_reader', 'upc_reader', 'upc_e_reader', 'code_128_reader'],
          },
          locate: true,
        }, (err: unknown) => {
            if (err) {
              console.error('Quagga initialization error:', err);
              isScanning.current = false;
              setIsScanningState(false);
              onError?.(err as Error);
              return;
            }

            if (!Quagga) {
              throw new Error('Quagga is not loaded');
            }
            Quagga.start();

            // Register scan listener
            onDetectedHandler = Quagga.onDetected((result: { codeResult: { code: string | null } }) => {
              const now = Date.now();

              // Prevent duplicate scans within delay period
              if (now - lastScanTime.current < delayBetweenScans) {
                return;
              }

              const code = result.codeResult.code;
              if (code) {
                lastScanTime.current = now;

                // Vibrate briefly on successful scan (if supported)
                if ('vibrate' in navigator) {
                  navigator.vibrate?.(50);
                }

                onBarcodeDetected(code);
                onScanComplete?.();
              }
            });
          })
          .catch((error: unknown) => {
            console.error('Failed to start scanning:', error);
            isScanning.current = false;
            setIsScanningState(false);
            onError?.(error as Error);
          });
      } catch (error) {
        console.error('Failed to start scanning:', error);
        isScanning.current = false;
        setIsScanningState(false);
        onError?.(error as Error);
      }
    };

    if (videoRef.current) {
      startScanning();
    }

    // Cleanup
    return () => {
      if (Quagga && Quagga.isRunning()) {
        Quagga.stop();
        if (onDetectedHandler) {
          onDetectedHandler.removeAllListeners();
        }
      }
      isScanning.current = false;
      setIsScanningState(false);
    };
  }, [isInitialized, delayBetweenScans, onBarcodeDetected, onError, onScanComplete]);

  // Manual scan trigger (for testing or manual initiation)
  const scanOnce = async () => {
    if (!isInitialized || !videoRef.current || !Quagga) return;

    try {
      // Take a single snapshot and decode
      const result = await Quagga.decodeSingle({
        inputStream: {
          constraints: {
            width: 640,
            height: 480,
            facingMode: 'environment',
          },
        },
        decoder: {
          readers: ['ean_reader', 'ean_8_reader', 'upc_reader', 'upc_e_reader', 'code_128_reader'],
        },
      });

      if (result && result.codeResult) {
        const code = result.codeResult.code;
        if (code) {
          onBarcodeDetected(code);
          onScanComplete?.();
        }

        // Vibrate on success
        if ('vibrate' in navigator) {
          navigator.vibrate?.(50);
        }
      }
    } catch (error) {
      console.error('Manual scan failed:', error);
      onError?.(error as Error);
    }
  };

  // Toggle scanning state
  const toggleScanning = () => {
    if (!Quagga) return;

    if (Quagga.isRunning()) {
      Quagga.stop();
      setIsScanningState(false);
    } else if (videoRef.current) {
      Quagga.start();
      setIsScanningState(true);
    }
  };

  return {
    videoRef,
    isInitialized,
    isScanning: isScanningState,
    scanOnce,
    toggleScanning,
  };
}
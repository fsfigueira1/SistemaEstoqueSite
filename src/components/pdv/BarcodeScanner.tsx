import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle2, Loader, ScanBarcode } from 'lucide-react';

export function BarcodeScanner({
  onProductFound,
  onProductNotFound,
  onError
}: {
  onProductFound: (product: any) => void;
  onProductNotFound: (barcode: string) => void;
  onError?: (error: Error) => void;
}) {
  const [scannerStatus, setScannerStatus] = useState<{
    scanning: boolean;
    lastScan?: string;
    scanningError?: Error
  }>({
    scanning: false,
    lastScan: undefined,
    scanningError: undefined
  });

  const {
    videoRef,
    isInitialized,
    isScanning,
    scanOnce,
    toggleScanning
  } = useBarcodeScanner(
    async (barcode: string) => {
      setScannerStatus(prev => ({
        ...prev,
        lastScan: barcode,
        scanningError: undefined
      }));

      try {
        // Use existing service method to get product by barcode
        const response = await fetch(`/api/products?search=${encodeURIComponent(barcode)}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.products && data.products.length > 0) {
          const product = data.products[0];
          onProductFound(product);
          setScannerStatus(prev => ({
            ...prev,
            scanning: false // Stop scanning after successful detection
          }));
        } else {
          onProductNotFound(barcode);
          setScannerStatus(prev => ({
            ...prev,
            scanning: true // Continue scanning
          }));
        }
      } catch (error) {
        console.error('Error fetching product:', error);
        onError?.(error as Error);
        setScannerStatus(prev => ({
          ...prev,
          scanningError: error as Error,
          scanning: true // Continue scanning despite error
        }));
      }
    },
    {
      delayBetweenScans: 2000, // 2 seconds between scans
      onError: (error) => {
        console.error('Scanner error:', error);
        setScannerStatus(prev => ({
          ...prev,
          scanningError: error,
          scanning: true
        }));
        onError?.(error);
      },
      onScanComplete: () => {
        // Optional: play success sound or show visual feedback
      }
    }
  );

  // Handle cleanup on unmount
  // useEffect(() => {
  //   return () => {
  //     if (isScanning) {
  //       toggleScanning();
  //     }
  //   };
  // }, [isScanning, toggleScanning]);

  if (!isInitialized) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Inicializando Scanner...</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <Loader className="h-8 w-8" />
          <CardDescription className="mt-4 text-center">
            Carregando biblioteca de leitura de código de barras...
          </CardDescription>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Scanner de Código de Barras</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={toggleScanning}
            className="flex items-center gap-2"
          >
            {isScanning ? 'Parar' : 'Iniciar'}
            <ScanBarcode className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="relative">
        {/* Video element for camera feed */}
        <video
          ref={videoRef}
          className="w-full h-96 object-cover rounded bg-gray-100"
          playsInline
          style={{ backgroundColor: '#000' }}
        />

        {/* Status overlay */}
        {scannerStatus.lastScan && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-md text-center max-w-xs whitespace-nowrap overflow-hidden text-ellipsis">
            Último scan: {scannerStatus.lastScan}
          </div>
        )}

        {/* Error overlay */}
        {scannerStatus.scanningError && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-red-500/80 text-white px-4 py-2 rounded-md text-center max-w-xs">
            Erro: {scannerStatus.scanningError.message}
          </div>
        )}

        {/* Success feedback */}
        {scannerStatus.lastScan && !scannerStatus.scanning && !scannerStatus.scanningError && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-green-500/80 text-white px-4 py-2 rounded-md text-center">
            Produto encontrado!
          </div>
        )}
      </CardContent>
      {(!isScanning || scannerStatus.scanningError) && (
        <div className="flex justify-center items-center mt-4 space-x-3">
          <Button
            onClick={scanOnce}
            disabled={isScanning || !videoRef.current}
            className="flex items-center gap-2"
          >
            Escanear Uma Vez
            <ScanBarcode className="h-4 w-4" />
          </Button>

          {!isScanning && (
            <Button
              variant="outline"
              onClick={toggleScanning}
              className="flex items-center gap-2"
            >
              Escanear Continuamente
              <ScanBarcode className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}

      {isScanning && !scannerStatus.lastScan && (
        <div className="flex justify-center items-center mt-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <ScanBarcode className="h-4 w-4" />
            <span>Aguardando código de barras...</span>
          </div>
        </div>
      )}
    </Card>
  );
}
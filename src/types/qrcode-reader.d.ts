declare module "qrcode-reader" {    // Serve a src/__test__/06_qrcode-scan.test.ts per l'import del modulo
  class QrCode {
      callback: (err: Error | null, value: { result: string }) => void;
      decode(bitmap: unknown): void;
  }
  export = QrCode;
}

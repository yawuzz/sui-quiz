// Buffer polyfill (bazı paketler Buffer bekler)
import { Buffer } from "buffer";
if (!(globalThis as any).Buffer) {
  (globalThis as any).Buffer = Buffer;
}

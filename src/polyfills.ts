// Tarayıcıda Node "Buffer" için polyfill
import { Buffer } from "buffer";
if (!(globalThis as any).Buffer) {
  (globalThis as any).Buffer = Buffer;
}

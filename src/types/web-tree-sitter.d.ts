// Minimal stub to satisfy TS
declare interface EmscriptenModule {
  onRuntimeInitialized?: () => void;
  [prop: string]: any;
}

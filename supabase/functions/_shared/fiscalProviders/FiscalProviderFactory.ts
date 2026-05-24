import type { FiscalProvider } from "./FiscalProvider.ts";
import { MockFiscalProvider } from "./MockFiscalProvider.ts";

const mockInstance = new MockFiscalProvider();

export class FiscalProviderFactory {
  static create(providerKey?: string | null): FiscalProvider {
    const key = providerKey?.trim().toLowerCase() || "mock";
    switch (key) {
      case "mock":
        return mockInstance;
      case "tecnospeed":
      case "nuvem_fiscal":
      case "integra_notas":
        // TODO Fase 3: implementações reais
        console.warn(`[fiscal] Provider ${key} não implementado; usando mock.`);
        return mockInstance;
      default:
        return mockInstance;
    }
  }
}

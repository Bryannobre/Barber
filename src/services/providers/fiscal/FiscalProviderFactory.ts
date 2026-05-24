import type { FiscalProvider } from "./FiscalProvider";
import { MockFiscalProvider } from "./MockFiscalProvider";
import type { FiscalProviderKey } from "./types";

const mockProvider = new MockFiscalProvider();

/**
 * Factory de provedores fiscais.
 * Fase 3: registrar TecnoSpeed, Nuvem Fiscal, IntegraNotas.
 */
export class FiscalProviderFactory {
  static create(providerKey?: string | null): FiscalProvider {
    const key = (providerKey?.trim().toLowerCase() || "mock") as FiscalProviderKey;

    switch (key) {
      case "mock":
        return mockProvider;
      case "tecnospeed":
      case "nuvem_fiscal":
      case "integra_notas":
        // TODO Fase 3: retornar implementação real (apenas em Edge Function)
        console.warn(`[Fiscal] Provider "${key}" ainda não disponível; usando mock.`);
        return mockProvider;
      default:
        return mockProvider;
    }
  }

  static listAvailable(): { value: FiscalProviderKey; label: string; implemented: boolean }[] {
    return [
      { value: "mock", label: "Mock (desenvolvimento)", implemented: true },
      { value: "tecnospeed", label: "TecnoSpeed", implemented: false },
      { value: "nuvem_fiscal", label: "Nuvem Fiscal", implemented: false },
      { value: "integra_notas", label: "Integra Notas", implemented: false },
    ];
  }
}

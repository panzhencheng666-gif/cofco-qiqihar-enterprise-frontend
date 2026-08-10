import type {
  SupplyAccount,
  SupplyInputSet,
  SupplyInputSetCommand,
  SupplyInputWorkspace,
  SupplyManualInputCommand,
  SupplyRunCommand,
  SupplySourceReleaseCommand,
} from "../../domain/supplyAccount";

export interface SupplyAccountRepository {
  find(criteria: {
    productCode: string;
    regionCode: string;
    periodCode: string;
    resultState?: string;
    version?: number;
  }): Promise<readonly SupplyAccount[]>;
  loadInputWorkspace(criteria: {
    productCode: string;
    regionCode: string;
    periodCode: string;
  }): Promise<SupplyInputWorkspace>;
  approveManualInput(command: SupplyManualInputCommand): Promise<void>;
  releaseSource(command: SupplySourceReleaseCommand): Promise<void>;
  createInputSet(command: SupplyInputSetCommand): Promise<SupplyInputSet>;
  run(command: SupplyRunCommand): Promise<SupplyAccount>;
}

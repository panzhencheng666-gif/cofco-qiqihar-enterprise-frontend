import type { SupplyAccount, SupplyRunCommand } from "../../domain/supplyAccount";

export interface SupplyAccountRepository {
  find(criteria: {
    productCode: string;
    regionCode: string;
    marketingYear: string;
    resultState?: string;
    version?: number;
  }): Promise<readonly SupplyAccount[]>;
  run(command: SupplyRunCommand): Promise<SupplyAccount>;
}

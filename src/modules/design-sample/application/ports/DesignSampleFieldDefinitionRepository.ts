import type {
  DesignSampleContext,
  DesignSampleFieldContract,
} from "../../domain/designSampleFieldContract";

export interface DesignSampleFieldDefinitionRepository {
  getDefinition(context: DesignSampleContext): Promise<DesignSampleFieldContract>;
}

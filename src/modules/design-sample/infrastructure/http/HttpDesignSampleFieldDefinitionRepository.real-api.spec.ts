import { FetchHttpClient } from "../../../../shared/api/HttpClient";
import { HttpDesignSampleFieldDefinitionRepository } from "./HttpDesignSampleFieldDefinitionRepository";

const acceptanceBaseUrl = process.env["DESIGN_SAMPLE_METADATA_ACCEPTANCE_URL"];

describe.runIf(acceptanceBaseUrl !== undefined)(
  "design sample metadata real API acceptance",
  () => {
    it("parses the backend-owned contract without a local field matrix", async () => {
      const repository = new HttpDesignSampleFieldDefinitionRepository(
        new FetchHttpClient(acceptanceBaseUrl),
      );

      const definition = await repository.getDefinition({
        domainCode: "MARKET",
        productCode: "CORN",
        objectTypeCode: "TRADER",
      });

      expect(definition.contractVersion).toBe("design-sample-fields-v1");
      expect(definition.supportedContexts).toHaveLength(27);
      expect(definition.observationFields.map(({ code }) => code)).toEqual(
        expect.arrayContaining(["MKT_PURCHASE_BASE_PRICE", "MKT_SALE_BASE_PRICE"]),
      );
    });
  },
);

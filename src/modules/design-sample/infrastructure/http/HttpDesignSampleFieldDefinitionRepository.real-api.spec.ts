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

      expect(definition.contractVersion).toBe("design-sample-fields-v3");
      expect(definition.supportedContexts).toContainEqual(
        expect.objectContaining({
          domainCode: "MARKET",
          productCode: "CORN",
          objectTypeCode: "TRADER",
        }),
      );
      expect(definition.identityFields.map(({ code }) => code)).toEqual(
        expect.arrayContaining([
          "DSP_NAME",
          "DSP_REGION_CODE",
          "DSP_LONGITUDE",
          "DSP_LATITUDE",
        ]),
      );
      expect(definition.observationFields).toEqual([]);
    });
  },
);

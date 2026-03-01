import {
  MOCK_PAGES,
  STEP_DELAYS,
  getRandomThoughtDelay,
  type MockPageResult,
} from "./mock-discovery";

export type DiscoveryStepEvent =
  | { type: "visiting"; pageUrl: string }
  | { type: "agent_thought"; pageUrl: string; thought: string }
  | {
      type: "fields_discovered";
      pageUrl: string;
      fields: MockPageResult["fields"];
      pagePurpose: string;
    }
  | {
      type: "schema_inferred";
      pageUrl: string;
      schema: MockPageResult["inferredSchema"];
    }
  | { type: "script_generated"; pageUrl: string; script: string }
  | {
      type: "data_extracted";
      pageUrl: string;
      data: Record<string, unknown>;
    }
  | { type: "page_complete"; pageUrl: string }
  | { type: "error"; pageUrl: string; error: string };

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function* runDiscoveryForPage(
  pageUrl: string,
  mode: "mock" | "live",
  _baseUrl?: string,
): AsyncGenerator<DiscoveryStepEvent> {
  if (mode === "live") {
    // Placeholder for real BrowserUse integration
    yield { type: "error", pageUrl, error: "Live mode not yet implemented" };
    return;
  }

  // Mock mode — use hardcoded data with realistic delays
  const mockData = MOCK_PAGES[pageUrl];
  if (!mockData) {
    yield {
      type: "error",
      pageUrl,
      error: `No mock data for page: ${pageUrl}`,
    };
    return;
  }

  // Step 1: Visiting
  yield { type: "visiting", pageUrl };
  await delay(STEP_DELAYS.visiting);

  // Step 2: Agent thoughts (analyzing)
  for (const thought of mockData.agentThoughts) {
    yield { type: "agent_thought", pageUrl, thought };
    await delay(getRandomThoughtDelay());
  }

  // Step 3: Fields discovered
  await delay(STEP_DELAYS.analyzing);
  yield {
    type: "fields_discovered",
    pageUrl,
    fields: mockData.fields,
    pagePurpose: mockData.pagePurpose,
  };

  // Step 4: Schema inferred
  await delay(STEP_DELAYS.schema);
  yield {
    type: "schema_inferred",
    pageUrl,
    schema: mockData.inferredSchema,
  };

  // Step 5: Script generated
  await delay(STEP_DELAYS.script);
  yield {
    type: "script_generated",
    pageUrl,
    script: mockData.extractionScript,
  };

  // Step 6: Data extracted
  await delay(STEP_DELAYS.extraction);
  yield {
    type: "data_extracted",
    pageUrl,
    data: mockData.extractedData,
  };

  // Step 7: Page complete
  yield { type: "page_complete", pageUrl };
}

export const DEFAULT_PAGES = [
  { pageUrl: "/uv-robot", pageName: "UV Robot" },
  { pageUrl: "/tug-robot", pageName: "TUG Fleet Monitor" },
  { pageUrl: "/environmental", pageName: "Environmental Monitoring" },
  { pageUrl: "/ehr", pageName: "Room Scheduling" },
  { pageUrl: "/agent", pageName: "Agent Dashboard" },
];

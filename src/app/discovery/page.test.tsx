import { render, screen, fireEvent } from "@testing-library/react";
import DiscoveryDashboard from "./page";

// Mock convex/react useQuery
const mockUseQuery = jest.fn();
jest.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

// Mock fetch for API calls
global.fetch = jest.fn();

describe("Discovery Dashboard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseQuery.mockReturnValue(undefined);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
  });

  describe("Initial Render", () => {
    it("renders the dashboard header", () => {
      render(<DiscoveryDashboard />);
      expect(screen.getByText("Dynamic Schema Discovery")).toBeInTheDocument();
    });

    it("renders the description text", () => {
      render(<DiscoveryDashboard />);
      expect(
        screen.getByText(
          "AI agents explore dashboards and create database tables in real-time",
        ),
      ).toBeInTheDocument();
    });

    it("renders the Start Discovery button", () => {
      render(<DiscoveryDashboard />);
      expect(screen.getByText("Start Discovery")).toBeInTheDocument();
    });

    it("renders the Reset button", () => {
      render(<DiscoveryDashboard />);
      expect(screen.getByText("Reset")).toBeInTheDocument();
    });

    it("renders mock mode toggle selected by default", () => {
      render(<DiscoveryDashboard />);
      const mockBtn = screen.getByText("Mock");
      expect(mockBtn).toBeInTheDocument();
      expect(mockBtn).toHaveStyle({ background: "#3b82f6" });
    });

    it("renders live mode toggle", () => {
      render(<DiscoveryDashboard />);
      expect(screen.getByText("Live")).toBeInTheDocument();
    });

    it("renders Convex Dashboard link", () => {
      render(<DiscoveryDashboard />);
      const link = screen.getByText(/Convex Dashboard/);
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", "https://dashboard.convex.dev");
      expect(link).toHaveAttribute("target", "_blank");
    });
  });

  describe("Page Cards", () => {
    it("shows 5 page cards", () => {
      render(<DiscoveryDashboard />);
      expect(screen.getByText("UV Robot")).toBeInTheDocument();
      expect(screen.getByText("TUG Fleet Monitor")).toBeInTheDocument();
      expect(screen.getByText("Environmental")).toBeInTheDocument();
      expect(screen.getByText("Room Scheduling")).toBeInTheDocument();
      expect(screen.getByText("Agent Dashboard")).toBeInTheDocument();
    });

    it("shows page URLs", () => {
      render(<DiscoveryDashboard />);
      expect(screen.getByText("/uv-robot")).toBeInTheDocument();
      expect(screen.getByText("/tug-robot")).toBeInTheDocument();
      expect(screen.getByText("/environmental")).toBeInTheDocument();
      expect(screen.getByText("/ehr")).toBeInTheDocument();
      expect(screen.getByText("/agent")).toBeInTheDocument();
    });

    it("shows all pages as Pending initially", () => {
      render(<DiscoveryDashboard />);
      const pendingBadges = screen.getAllByText("Pending");
      expect(pendingBadges).toHaveLength(5);
    });
  });

  describe("Progress Display", () => {
    it("shows 0/5 progress initially", () => {
      render(<DiscoveryDashboard />);
      expect(screen.getByText(/Progress:/)).toBeInTheDocument();
      expect(screen.getByText("0")).toBeInTheDocument();
    });
  });

  describe("Activity Log", () => {
    it("shows empty state message", () => {
      render(<DiscoveryDashboard />);
      expect(
        screen.getByText(/Click.*Start Discovery.*to begin/),
      ).toBeInTheDocument();
    });

    it("renders Live Activity Log header", () => {
      render(<DiscoveryDashboard />);
      expect(screen.getByText("Live Activity Log")).toBeInTheDocument();
    });
  });

  describe("Mode Toggle", () => {
    it("switches to live mode when clicked", () => {
      render(<DiscoveryDashboard />);
      const liveBtn = screen.getByText("Live");
      fireEvent.click(liveBtn);
      expect(liveBtn).toHaveStyle({ background: "#3b82f6" });
    });

    it("switches back to mock mode", () => {
      render(<DiscoveryDashboard />);
      const liveBtn = screen.getByText("Live");
      const mockBtn = screen.getByText("Mock");
      fireEvent.click(liveBtn);
      fireEvent.click(mockBtn);
      expect(mockBtn).toHaveStyle({ background: "#3b82f6" });
    });
  });

  describe("Reset", () => {
    it("calls discovery-reset API when Reset clicked", async () => {
      render(<DiscoveryDashboard />);
      const resetBtn = screen.getByText("Reset");
      fireEvent.click(resetBtn);
      // fetch should be called with /api/discovery-reset
      expect(global.fetch).toHaveBeenCalledWith("/api/discovery-reset", {
        method: "POST",
      });
    });
  });

  describe("Convex Hydration", () => {
    it("hydrates pages from Convex session data", () => {
      mockUseQuery
        .mockReturnValueOnce({
          _id: "session123",
          mode: "mock",
          status: "completed",
          completedAt: Date.now(),
          elapsedMs: 15000,
        })
        .mockReturnValueOnce([
          {
            pageUrl: "/uv-robot",
            pageName: "UV Robot",
            status: "complete",
            discoveredFields: [{ name: "battery" }, { name: "health" }],
          },
          {
            pageUrl: "/tug-robot",
            pageName: "TUG Fleet",
            status: "analyzing",
            discoveredFields: [{ name: "trips" }],
          },
        ])
        .mockReturnValueOnce([
          {
            level: "info",
            message: "Session started",
            timestamp: Date.now(),
          },
        ]);

      render(<DiscoveryDashboard />);
      expect(screen.getByText("UV Robot")).toBeInTheDocument();
      expect(screen.getByText("Complete")).toBeInTheDocument();
    });
  });
});

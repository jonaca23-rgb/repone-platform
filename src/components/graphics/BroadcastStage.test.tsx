// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BroadcastStage } from "./BroadcastStage";

afterEach(cleanup);

describe("BroadcastStage", () => {
  it("scales the 1920x1080 stage to the window once it has measured it", async () => {
    Object.assign(window, { innerWidth: 1280, innerHeight: 720 });
    render(
      <BroadcastStage>
        <p>Graphic</p>
      </BroadcastStage>,
    );
    const stage = screen.getByTestId("broadcast-stage");
    expect(stage.style.width).toBe("1920px");
    expect(stage.style.height).toBe("1080px");
    expect(stage.style.transform).toContain("scale(0.666");
    expect(stage.style.visibility).toBe("visible");
    Object.assign(window, { innerWidth: 3840, innerHeight: 2160 });
    await act(async () => window.dispatchEvent(new Event("resize")));
    expect(stage.style.transform).toContain("scale(2)");
  });
});

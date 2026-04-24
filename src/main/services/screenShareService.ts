import { desktopCapturer, type NativeImage } from "electron";
import type { ScreenObservation, ScreenSource, Viewport } from "../../shared/types";

interface CapturerSourceLike {
  id: string;
  name: string;
  display_id?: string;
  thumbnail: Pick<NativeImage, "isEmpty" | "toDataURL" | "getSize">;
}

export class ScreenShareService {
  private selectedSource?: ScreenSource;

  async listSources(thumbnailSize: Viewport = { width: 360, height: 220 }): Promise<ScreenSource[]> {
    const sources = await desktopCapturer.getSources({
      types: ["screen", "window"],
      thumbnailSize,
      fetchWindowIcons: true
    });
    return sources.map(mapDesktopSource).filter((source) => source.name.trim().length > 0);
  }

  async start(sourceId?: string): Promise<ScreenObservation> {
    const sources = await this.listSources({ width: 480, height: 270 });
    const source =
      sources.find((candidate) => candidate.id === sourceId) ??
      sources.find((candidate) => candidate.type === "screen") ??
      sources[0];

    if (!source) {
      throw new Error("No screen or window sources are available.");
    }

    this.selectedSource = source;
    return this.observe();
  }

  stop(): void {
    this.selectedSource = undefined;
  }

  isSharing(): boolean {
    return Boolean(this.selectedSource);
  }

  getSelectedSource(): ScreenSource | undefined {
    return this.selectedSource;
  }

  async observe(): Promise<ScreenObservation> {
    if (!this.selectedSource) {
      throw new Error("Screen share has not started.");
    }

    const sources = await desktopCapturer.getSources({
      types: ["screen", "window"],
      thumbnailSize: { width: 1600, height: 1000 },
      fetchWindowIcons: false
    });
    const source = sources.find((candidate) => candidate.id === this.selectedSource?.id);
    if (!source) {
      throw new Error(`Selected screen source is no longer available: ${this.selectedSource.name}`);
    }
    if (source.thumbnail.isEmpty()) {
      throw new Error(`Selected screen source returned an empty thumbnail: ${this.selectedSource.name}`);
    }

    const size = source.thumbnail.getSize();
    return {
      environment: "screen-share",
      screenshot: source.thumbnail.toDataURL(),
      viewport: { width: size.width, height: size.height },
      sourceId: source.id,
      sourceName: source.name,
      timestamp: new Date().toISOString()
    };
  }

  async observeSource(sourceId: string): Promise<ScreenObservation> {
    const sources = await desktopCapturer.getSources({
      types: ["screen", "window"],
      thumbnailSize: { width: 1600, height: 1000 },
      fetchWindowIcons: false
    });
    const source = sources.find((candidate) => candidate.id === sourceId);
    if (!source) {
      throw new Error(`Screen source is no longer available: ${sourceId}`);
    }
    if (source.thumbnail.isEmpty()) {
      throw new Error(`Screen source returned an empty thumbnail: ${source.name}`);
    }
    const size = source.thumbnail.getSize();
    return {
      environment: "screen-share",
      screenshot: source.thumbnail.toDataURL(),
      viewport: { width: size.width, height: size.height },
      sourceId: source.id,
      sourceName: source.name,
      timestamp: new Date().toISOString()
    };
  }

  async observeSources(sourceIds: string[]): Promise<ScreenObservation[]> {
    const uniqueIds = [...new Set(sourceIds.filter(Boolean))];
    const observations: ScreenObservation[] = [];
    for (const sourceId of uniqueIds) {
      observations.push(await this.observeSource(sourceId));
    }
    return observations;
  }
}

export function mapDesktopSource(source: CapturerSourceLike): ScreenSource {
  return {
    id: source.id,
    name: source.name,
    type: source.id.startsWith("screen:") ? "screen" : "window",
    displayId: source.display_id || undefined,
    thumbnail: source.thumbnail.isEmpty() ? undefined : source.thumbnail.toDataURL()
  };
}

import React, { useEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  useVideoConfig,
  useCurrentFrame,
  useDelayRender,
  interpolate,
  Easing,
  Audio,
  staticFile,
  Img,
  spring,
} from "remotion";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import usaData from "../../../data/usa.json";
import antarcticaData from "../../../data/antarctica.json";
import storyboard from "./storyboard.json";
import timestamps from "./voiceover-usa-antartica-timestamps.json";
import { COLORS } from "./color";
import { SubscribeAnimation } from "./SubscribeAnimation";

interface WordEntry {
  word: string;
  frame_start: number;
  frame_end: number;
}

const allWords = timestamps.words as WordEntry[];

const Caption: React.FC<{ frame: number }> = ({ frame }) => {
  const activeWord = allWords.find(
    (w) => frame >= w.frame_start && frame < w.frame_end
  );

  if (!activeWord) return null;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 300,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 100,
        pointerEvents: "none",
      }}
    >
      <span
        style={{
          fontFamily: "'Poppins', sans-serif",
          fontWeight: 900,
          fontSize: "84px",
          lineHeight: 1.2,
          color: "#FFFF00",
          WebkitTextStroke: "4px #000000",
          textShadow: "6px 6px 0px #000000",
          display: "inline-block",
        }}
      >
        {activeWord.word}
      </span>
    </div>
  );
};

interface CameraKeyframe {
  frame: number;
  center: [number, number];
  zoom: number;
  pitch: number;
  bearing: number;
  easing?: string;
}

function getCameraPosition(frame: number, kf: CameraKeyframe[]) {
  if (kf.length === 0) return { center: [0, 0] as [number, number], zoom: 3, pitch: 0, bearing: 0 };
  if (frame <= kf[0].frame) return kf[0];
  if (frame >= kf[kf.length - 1].frame) return kf[kf.length - 1];

  for (let i = 0; i < kf.length - 1; i++) {
    const a = kf[i], b = kf[i + 1];
    if (frame >= a.frame && frame <= b.frame) {
      const ease = b.easing === "quadInOut" ? Easing.inOut(Easing.quad) : undefined;
      const o = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const, easing: ease };

      return {
        center: [
          interpolate(frame, [a.frame, b.frame], [a.center[0], b.center[0]], o),
          interpolate(frame, [a.frame, b.frame], [a.center[1], b.center[1]], o)
        ] as [number, number],
        zoom: interpolate(frame, [a.frame, b.frame], [a.zoom, b.zoom], o),
        pitch: interpolate(frame, [a.frame, b.frame], [a.pitch, b.pitch], o),
        bearing: interpolate(frame, [a.frame, b.frame], [a.bearing, b.bearing], o)
      };
    }
  }
  return kf[0];
}

export const UsaAntarticaComp: React.FC = () => {
  const { width, height } = useVideoConfig();
  const frame = useCurrentFrame();

  // --- POSITION CUSTOMIZATION: Change coordinates [longitude, latitude] below to move the Rank 4 label ---
  const rankFourCoords: [number, number] = [-73.0, -25.0];

  // Countdown based on the active scene travel times (counting up from 0 to target duration)
  const getCountdownValue = (): { value: number; suffix: string } | null => {
    // Walking (Scene 3 & 4): frames 217 to 313
    if (frame >= 217 && frame <= 313) {
      const val = Math.round(interpolate(frame, [217, 313], [0, 125], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }));
      return { value: val, suffix: " Days" };
    }
    // Car (Scene 5 & 6): frames 321 to 385
    if (frame >= 321 && frame <= 385) {
      const val = Math.round(interpolate(frame, [321, 385], [0, 6], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }));
      return { value: val, suffix: " Days" };
    }
    // Ship (Scene 7 & 8): frames 396 to 464
    if (frame >= 396 && frame <= 464) {
      const val = Math.round(interpolate(frame, [396, 464], [0, 17], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }));
      return { value: val, suffix: " Days" };
    }
    // Plane (Scene 9 & 10): frames 478 to 562
    if (frame >= 478 && frame <= 562) {
      const val = Math.round(interpolate(frame, [478, 562], [0, 14], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }));
      return { value: val, suffix: " Hours" };
    }
    // B2 Bomber (Scene 11 & 12): frames 578 to 650
    if (frame >= 578 && frame <= 650) {
      const val = Math.round(interpolate(frame, [578, 650], [0, 8], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }));
      return { value: val, suffix: " Hours" };
    }
    // Hypersonic Missile (Scene 13 & 14): frames 663 to 769
    if (frame >= 663 && frame <= 769) {
      const val = Math.round(interpolate(frame, [663, 769], [0, 30], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }));
      return { value: val, suffix: " Mins" };
    }
    return null;
  };

  const countdown = getCountdownValue();
  const mapContainer = useRef<HTMLDivElement>(null);
  const { delayRender, continueRender } = useDelayRender();
  const [handle] = useState(() => delayRender("Loading map..."));
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const lastState = useRef("");

  useEffect(() => {
    if (!mapContainer.current) return;
    const mapStyle = {
      version: 8 as const,
      sources: {
        satellite: {
          type: "raster" as const,
          tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
          tileSize: 256,
        },
        "usa-src": {
          type: "geojson" as const,
          data: usaData as any
        },
        "antarctica-src": {
          type: "geojson" as const,
          data: antarcticaData as any
        },
        "route-src": {
          type: "geojson" as const,
          data: {
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: []
            }
          } as any
        }
      },
      layers: [
        { id: "satellite", type: "raster" as const, source: "satellite", minzoom: 0, maxzoom: 22 },
        // USA highlights
        {
          id: "usa-fill",
          type: "fill" as const,
          source: "usa-src",
          paint: { "fill-color": COLORS.usaFill, "fill-opacity": 0 }
        },
        {
          id: "usa-border-glow",
          type: "line" as const,
          source: "usa-src",
          paint: { "line-color": "#ffffff", "line-width": 8, "line-blur": 4, "line-opacity": 0 }
        },
        {
          id: "usa-border-core",
          type: "line" as const,
          source: "usa-src",
          paint: { "line-color": "#ffffff", "line-width": 2, "line-opacity": 0 }
        },
        // Antarctica highlights
        {
          id: "antarctica-fill",
          type: "fill" as const,
          source: "antarctica-src",
          paint: { "fill-color": COLORS.antarticaFill, "fill-opacity": 0 }
        },
        {
          id: "antarctica-border-glow",
          type: "line" as const,
          source: "antarctica-src",
          paint: { "line-color": "#ffffff", "line-width": 8, "line-blur": 4, "line-opacity": 0 }
        },
        {
          id: "antarctica-border-core",
          type: "line" as const,
          source: "antarctica-src",
          paint: { "line-color": "#ffffff", "line-width": 2, "line-opacity": 0 }
        },
        // Route layers (Crisp non-glowing dashed line as requested)
        {
          id: "route-core",
          type: "line" as const,
          source: "route-src",
          layout: {
            "line-cap": "round" as const,
            "line-join": "round" as const
          },
          paint: {
            "line-color": "#ffffff",
            "line-width": 14,
            "line-opacity": 1.0,
            "line-dasharray": [0.01, 2.5]
          }
        }
      ]
    };

    const mapInstance = new maplibregl.Map({
      container: mapContainer.current,
      style: mapStyle,
      interactive: false,
      fadeDuration: 0,
      center: [-95.71, 37.09],
      zoom: 3.5,
      attributionControl: false,
      canvasContextAttributes: { preserveDrawingBuffer: true }
    });

    mapInstance.on("load", () => {
      setMap(mapInstance);
      let resolved = false;
      const resolveLoad = () => {
        if (resolved) return;
        resolved = true;
        continueRender(handle);
      };
      
      const timeoutId = setTimeout(() => {
        resolveLoad();
      }, 4000); // 4 seconds fallback

      mapInstance.once("idle", () => {
        clearTimeout(timeoutId);
        resolveLoad();
      });
    });

    return () => {};
  }, [continueRender, handle]);

  // Hiker position (Scene 3 & 4: frames 217 to 313)
  const getManPosition = (): [number, number] => {
    const start: [number, number] = [-80.19, 25.76]; // Miami
    const end: [number, number] = [-80.19, -75.0]; // Antarctica
    if (frame < 217) return start;
    const p = interpolate(frame, [217, 313], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.25, 0.1, 0.25, 1.0)
    });
    return [
      start[0] + p * (end[0] - start[0]),
      start[1] + p * (end[1] - start[1])
    ];
  };

  const manCoords = getManPosition();

  // Car position (Scene 5 & 6: frames 321 to 385)
  const getCarPosition = (): [number, number] => {
    const start: [number, number] = [-80.19, 25.76];
    const end: [number, number] = [-80.19, -75.0];
    if (frame < 321) return start;
    const p = interpolate(frame, [321, 385], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.25, 0.1, 0.25, 1.0)
    });
    return [
      start[0] + p * (end[0] - start[0]),
      start[1] + p * (end[1] - start[1])
    ];
  };

  const carCoords = getCarPosition();

  // Ship position (Scene 7 & 8: frames 396 to 464)
  const getShipPosition = (): [number, number] => {
    const start: [number, number] = [-80.19, 25.76];
    const end: [number, number] = [-80.19, -75.0];
    if (frame < 396) return start;
    const p = interpolate(frame, [396, 464], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.25, 0.1, 0.25, 1.0)
    });
    return [
      start[0] + p * (end[0] - start[0]),
      start[1] + p * (end[1] - start[1])
    ];
  };

  const shipCoords = getShipPosition();

  // Plane position (Scene 9 & 10: frames 478 to 562)
  const getPlanePosition = (): [number, number] => {
    const start: [number, number] = [-80.19, 25.76];
    const end: [number, number] = [-80.19, -75.0];
    if (frame < 478) return start;
    const p = interpolate(frame, [478, 562], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.25, 0.1, 0.25, 1.0)
    });
    return [
      start[0] + p * (end[0] - start[0]),
      start[1] + p * (end[1] - start[1])
    ];
  };

  const planeCoords = getPlanePosition();

  // Bomber position (Scene 11 & 12: frames 578 to 650)
  const getBomberPosition = (): [number, number] => {
    const start: [number, number] = [-80.19, 25.76];
    const end: [number, number] = [-80.19, -75.0];
    if (frame < 578) return start;
    const p = interpolate(frame, [578, 650], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.25, 0.1, 0.25, 1.0)
    });
    return [
      start[0] + p * (end[0] - start[0]),
      start[1] + p * (end[1] - start[1])
    ];
  };

  const bomberCoords = getBomberPosition();

  // Missile position (Scene 13 & 14: frames 663 to 769)
  const getMissilePosition = (): [number, number] => {
    const start: [number, number] = [-80.19, 25.76];
    const end: [number, number] = [-80.19, -75.0];
    if (frame < 663) return start;
    const p = interpolate(frame, [663, 769], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.25, 0.1, 0.25, 1.0)
    });
    return [
      start[0] + p * (end[0] - start[0]),
      start[1] + p * (end[1] - start[1])
    ];
  };

  const missileCoords = getMissilePosition();

  useEffect(() => {
    if (!map) return;

    let camera = getCameraPosition(frame, storyboard.cameraKeyframes as CameraKeyframe[]);

    const stateKey = `${camera.center[0]}-${camera.center[1]}-${camera.zoom}-${camera.pitch}-${camera.bearing}`;
    if (lastState.current !== stateKey) {
      map.jumpTo(camera);
      map.triggerRepaint();
      lastState.current = stateKey;
    }

    // Dynamic highlights
    const usaOpacity = 0.65;
    const antarcticaOpacity = frame < 120 ? 0 : interpolate(frame, [120, 200], [0, 0.65], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

    map.setPaintProperty("usa-fill", "fill-opacity", usaOpacity);
    map.setPaintProperty("usa-border-glow", "line-opacity", usaOpacity * 0.5);
    map.setPaintProperty("usa-border-core", "line-opacity", usaOpacity);

    map.setPaintProperty("antarctica-fill", "fill-opacity", antarcticaOpacity);
    map.setPaintProperty("antarctica-border-glow", "line-opacity", antarcticaOpacity * 0.5);
    map.setPaintProperty("antarctica-border-core", "line-opacity", antarcticaOpacity);

    // Keep route line visible USA -> Antarctica
    const lineSource = map.getSource("route-src") as maplibregl.GeoJSONSource;
    if (lineSource) {
      if (frame >= 30 && frame < 209) {
        // Grow slanted route line during Scene 1-2
        const p = interpolate(frame, [30, 209], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.inOut(Easing.quad),
        });
        const start = [-80.19, 25.76];
        const end = [0.0, -75.0];
        const lon = start[0] + p * (end[0] - start[0]);
        const lat = start[1] + p * (end[1] - start[1]);
        lineSource.setData({
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [start, [lon, lat]]
          }
        });
      } else if (frame >= 209) {
        // Vertical straight route line for Scene 3 onwards
        const start = [-80.19, 25.76];
        const end = [-80.19, -75.0];
        lineSource.setData({
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [start, end]
          }
        });
      } else {
        lineSource.setData({
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: []
          }
        });
      }
    }

  }, [frame, map, manCoords]);

  // Project USA text label
  const getUsaLabelProjected = () => {
    if (!map) return null;
    if (frame < 10 || frame > 240) return null;
    const projected = map.project([-100.0, 40.0]);
    const opacity = interpolate(frame, [10, 30, 220, 240], [0, 1, 1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp"
    });
    return { x: projected.x, y: projected.y, opacity };
  };

  // Project walking man (Scene 3 & 4)
  const getManProjected = () => {
    if (!map || frame < 217 || frame > 313) return null;
    const projected = map.project(manCoords);
    return { x: projected.x, y: projected.y };
  };

  // Project car (Scene 5 & 6)
  const getCarProjected = () => {
    if (!map || frame < 321 || frame > 385) return null;
    const projected = map.project(carCoords);
    return { x: projected.x, y: projected.y };
  };

  // Project ship (Scene 7 & 8)
  const getShipProjected = () => {
    if (!map || frame < 396 || frame > 464) return null;
    const projected = map.project(shipCoords);
    return { x: projected.x, y: projected.y };
  };

  // Project plane (Scene 9 & 10)
  const getPlaneProjected = () => {
    if (!map || frame < 478 || frame > 562) return null;
    const projected = map.project(planeCoords);
    return { x: projected.x, y: projected.y };
  };

  // Project B2 bomber (Scene 11 & 12)
  const getBomberProjected = () => {
    if (!map || frame < 578 || frame > 650) return null;
    const projected = map.project(bomberCoords);
    return { x: projected.x, y: projected.y };
  };

  // Project hypersonic missile (Scene 13 & 14)
  const getMissileProjected = () => {
    if (!map || frame < 663 || frame > 769) return null;
    const projected = map.project(missileCoords);
    return { x: projected.x, y: projected.y };
  };

  // Project rank 4 label (visible from Scene 3 onwards, starting frame 217 to the end)
  const getRankFourProjected = () => {
    if (!map || frame < 217) return null;
    const projected = map.project(rankFourCoords);
    return { x: projected.x, y: projected.y };
  };

  const usaLabel = getUsaLabelProjected();
  const manScreen = getManProjected();
  const carScreen = getCarProjected();
  const shipScreen = getShipProjected();
  const planeScreen = getPlaneProjected();
  const bomberScreen = getBomberProjected();
  const missileScreen = getMissileProjected();
  const rankFourScreen = getRankFourProjected();



  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* Voiceover audio */}
      <Audio src={staticFile("voiceover/voiceover-usa-antartica.mp3")} volume={1} />

      <div
        ref={mapContainer}
        style={{
          position: "absolute",
          width: `${width}px`,
          height: `${height}px`,
        }}
      />

      {/* USA Mainland Text Label */}
      {usaLabel && (
        <div
          style={{
            position: "absolute",
            top: usaLabel.y,
            left: usaLabel.x,
            transform: "translate(-50%, -50%)",
            opacity: usaLabel.opacity,
            pointerEvents: "none",
            zIndex: 10,
          }}
        >
          <span
            style={{
              fontFamily: "'Poppins', sans-serif",
              fontWeight: 900,
              fontSize: "64px",
              color: "#ffffff",
              textShadow: "0 0 10px rgba(0,0,0,0.9), 0 0 20px rgba(0,0,0,0.8)",
            }}
          >
            USA
          </span>
        </div>
      )}

      {/* Walking Hiker Avatar */}
      {manScreen && (
        <div
          style={{
            position: "absolute",
            top: manScreen.y,
            left: manScreen.x,
            transform: "translate(-50%, -85%)",
            pointerEvents: "none",
            zIndex: 20,
          }}
        >
          <Img
            src={staticFile("images/american-rich-man.png")}
            style={{
              width: "120px",
              height: "120px",
              objectFit: "contain",
              filter: "drop-shadow(0px 8px 16px rgba(0,0,0,0.6))"
            }}
          />
        </div>
      )}

      {/* Driving Car Avatar */}
      {carScreen && (
        <div
          style={{
            position: "absolute",
            top: carScreen.y,
            left: carScreen.x,
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
            zIndex: 20,
          }}
        >
          <Img
            src={staticFile("images/car.png")}
            style={{
              width: "160px",
              height: "160px",
              objectFit: "contain",
              filter: "drop-shadow(0px 6px 12px rgba(0,0,0,0.6))"
            }}
          />
        </div>
      )}

      {/* Cruise Ship Avatar */}
      {shipScreen && (
        <div
          style={{
            position: "absolute",
            top: shipScreen.y,
            left: shipScreen.x,
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
            zIndex: 20,
          }}
        >
          <Img
            src={staticFile("images/ship.png")}
            style={{
              width: "180px",
              height: "180px",
              objectFit: "contain",
              filter: "drop-shadow(0px 6px 12px rgba(0,0,0,0.6))"
            }}
          />
        </div>
      )}

      {/* Plane Avatar */}
      {planeScreen && (
        <div
          style={{
            position: "absolute",
            top: planeScreen.y,
            left: planeScreen.x,
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
            zIndex: 20,
          }}
        >
          <Img
            src={staticFile("images/airplane.png")}
            style={{
              width: "180px",
              height: "180px",
              objectFit: "contain",
              filter: "drop-shadow(0px 8px 16px rgba(0,0,0,0.6))"
            }}
          />
        </div>
      )}

      {/* B2 Bomber Avatar */}
      {bomberScreen && (
        <div
          style={{
            position: "absolute",
            top: bomberScreen.y,
            left: bomberScreen.x,
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
            zIndex: 20,
          }}
        >
          <Img
            src={staticFile("images/b2-bomber.png")}
            style={{
              width: "180px",
              height: "180px",
              objectFit: "contain",
              filter: "drop-shadow(0px 8px 16px rgba(0,0,0,0.6))"
            }}
          />
        </div>
      )}

      {/* Hypersonic Missile Avatar */}
      {missileScreen && (
        <div
          style={{
            position: "absolute",
            top: missileScreen.y,
            left: missileScreen.x,
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
            zIndex: 20,
          }}
        >
          <Img
            src={staticFile("images/hypersonic-missile.png")}
            style={{
              width: "260px",
              height: "260px",
              objectFit: "contain",
              filter: "drop-shadow(0px 8px 16px rgba(0,0,0,0.6))"
            }}
          />
        </div>
      )}

      {/* Dynamic Journey Countdown Overlay Style 2 */}
      {rankFourScreen && countdown && (
        <div
          style={{
            position: "absolute",
            top: rankFourScreen.y,
            left: rankFourScreen.x,
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
            zIndex: 30,
          }}
        >
          <span
            style={{
              fontFamily: "'Poppins', sans-serif",
              fontWeight: 900,
              fontSize: "140px",
              lineHeight: 1,
              letterSpacing: "0.02em",
              color: "#ffffff",
              WebkitTextStroke: "5px #000000",
              textShadow: "8px 8px 0px #000000",
              display: "inline-block",
              whiteSpace: "nowrap",
            }}
          >
            {countdown.value}
            <span style={{ fontSize: "65px", verticalAlign: "super", marginLeft: "8px", WebkitTextStroke: "3px #000000" }}>
              {countdown.suffix}
            </span>
          </span>
        </div>
      )}

      {/* Youtube Subscribe lower-third */}
      <SubscribeAnimation startFrame={784} />

      <Caption frame={frame} />
    </AbsoluteFill>
  );
};

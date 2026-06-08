import React from "react";
import {
  useCurrentFrame,
  interpolate,
  Easing,
  spring,
  Img,
  staticFile,
} from "remotion";

interface SubscribeAnimationProps {
  startFrame?: number;
}

export const SubscribeAnimation: React.FC<SubscribeAnimationProps> = ({
  startFrame = 784,
}) => {
  const frame = useCurrentFrame();
  const localFrame = frame - startFrame;

  if (frame < startFrame) return null;

  // Slide in from bottom center and fade out at the end
  const slideY = interpolate(localFrame, [0, 20, 50, 66], [200, 0, 0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const opacity = interpolate(localFrame, [0, 10, 50, 66], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Press at frame 24 to 28, release and spring bounce from frame 28 onwards
  let buttonScale = 1;
  if (localFrame >= 24 && localFrame < 28) {
    buttonScale = interpolate(localFrame, [24, 28], [1, 0.9], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.quad),
    });
  } else if (localFrame >= 28) {
    const spr = spring({
      frame: localFrame - 28,
      fps: 30,
      config: {
        damping: 12,
        mass: 0.5,
        stiffness: 100,
      },
    });
    buttonScale = interpolate(spr, [0, 1], [0.9, 1.0]);
  }

  const isSubscribed = localFrame >= 28;

  // Hand animation coordinates relative to the button
  let handY = 300;
  let handX = 100;
  let handOpacity = 0;
  let handScale = 1;

  if (localFrame >= 16 && localFrame < 24) {
    // Slide in from bottom right to button
    handY = interpolate(localFrame, [16, 24], [300, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.quad),
    });
    handX = interpolate(localFrame, [16, 24], [100, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.quad),
    });
    handOpacity = interpolate(localFrame, [16, 20], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  } else if (localFrame >= 24 && localFrame < 28) {
    // Tap down (click press)
    handY = 0;
    handX = 0;
    handOpacity = 1;
    handScale = interpolate(localFrame, [24, 28], [1, 0.85], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  } else if (localFrame >= 28 && localFrame < 38) {
    // Slide back down offscreen
    handY = interpolate(localFrame, [28, 38], [0, 300], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.in(Easing.quad),
    });
    handX = interpolate(localFrame, [28, 38], [0, 100], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.in(Easing.quad),
    });
    handOpacity = interpolate(localFrame, [32, 38], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    handScale = interpolate(localFrame, [28, 32], [0.85, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }

  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: `translate(-50%, -50%) translateY(${slideY}px)`,
        opacity: opacity,
        display: "flex",
        alignItems: "center",
        backgroundColor: "#ffffff",
        borderRadius: "56px",
        padding: "24px 40px",
        boxShadow: "0px 24px 54px rgba(0,0,0,0.3)",
        gap: "30px",
        zIndex: 90,
        pointerEvents: "none",
        minWidth: "820px",
      }}
    >
      {/* Avatar (Hardcoded - Change your logo image path here) */}
      <Img
        src={staticFile("images/youtube-logo.jpg")}
        style={{
          width: "110px",
          height: "110px",
          borderRadius: "50%",
          border: "1px solid #e0e0e0",
        }}
      />

      {/* Text Details (Hardcoded - Change Channel Name & Subscribers count here) */}
      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, fontFamily: "'Poppins', sans-serif" }}>
        <span style={{ fontWeight: 800, fontSize: "40px", color: "#0f0f0f", lineHeight: 1.2 }}>
          GeoDiary
        </span>
        <span style={{ fontWeight: 500, fontSize: "28px", color: "#606060", marginTop: "4px" }}>
          87 subscribers
        </span>
      </div>

      {/* Subscribe Button (Starts Red, turns Grey on Subscribe) */}
      <div
        style={{
          width: "260px",
          height: "76px",
          borderRadius: "38px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: isSubscribed ? "#f2f2f2" : "#ff0000",
          color: isSubscribed ? "#0f0f0f" : "#ffffff",
          fontWeight: 700,
          fontSize: "30px",
          fontFamily: "'Poppins', sans-serif",
          transform: `scale(${buttonScale})`,
          transition: "background-color 0.1s ease",
          border: isSubscribed ? "1px solid #ccc" : "none",
        }}
      >
        {isSubscribed ? "Subscribed" : "Subscribe"}
      </div>

      {/* Clicking Hand Pointer */}
      {handOpacity > 0 && (
        <div
          style={{
            position: "absolute",
            right: "170px",
            top: "50%",
            transform: `translate(50%, -30%) translate(${handX}px, ${handY}px) scale(${handScale}) rotate(-15deg)`,
            opacity: handOpacity,
            fontSize: "76px",
            zIndex: 100,
          }}
        >
          👆
        </div>
      )}
    </div>
  );
};
